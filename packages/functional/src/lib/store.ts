import { okAsync, type ResultAsync } from "neverthrow";
import { Mutex } from "./mutex";

export class Store {
  private map = new Map<string, unknown>();
  private file: Bun.BunFile;
  private isLoaded = false;
  private mutex = new Mutex();

  constructor(path: string) {
    this.file = Bun.file(path);
  }

  get<T>(key: string): T | undefined {
    if (!this.isLoaded) {
      throw new Error("Store is not loaded");
    }
    return this.map.get(key) as T | undefined;
  }

  batchSet(values: Map<string, unknown | null>): Promise<void> {
    for (const [key, value] of values) {
      if (value === null) {
        this.map.delete(key);
      } else {
        this.map.set(key, value);
      }
    }
    return this.save();
  }

  set(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
    console.log("set", key, value);
    return this.save();
  }

  delete(key: string): Promise<void> {
    this.map.delete(key);
    return this.save();
  }

  fetch<T, E extends Error>(
    key: string,
    fetcher: () => ResultAsync<T, E>
  ): ResultAsync<T, E> {
    if (!this.isLoaded) {
      throw new Error("Store is not loaded");
    }
    if (this.map.has(key)) {
      return okAsync(this.map.get(key) as T);
    }
    return fetcher().map(async (value) => {
      await this.set(key, value);
      return value;
    });
  }

  async load() {
    if (await this.file.exists()) {
      const file = await this.file.json().catch(() => ({}));
      for (const [key, value] of Object.entries(file)) {
        this.map.set(key, value);
      }
    }
    this.isLoaded = true;
  }

  async save() {
    await this.mutex.runExclusive(async () => {
      await this.file.write(
        JSON.stringify(Object.fromEntries(this.map), null, 2)
      );
    });
  }
}
