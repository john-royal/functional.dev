import { okAsync, type ResultAsync } from "neverthrow";

export class Store extends Map<string, unknown> {
  private file: Bun.BunFile;
  private isLoaded = false;
  private isTouched = false;

  constructor(path: string) {
    super();
    this.file = Bun.file(path);
  }

  get<T>(key: string): T | undefined {
    return super.get(key) as T | undefined;
  }

  set(key: string, value: unknown): this {
    super.set(key, value);
    this.isTouched = true;
    return this;
  }

  fetch<T, E extends Error>(
    key: string,
    fetcher: () => ResultAsync<T, E>
  ): ResultAsync<T, E> {
    if (this.has(key)) {
      return okAsync(this.get(key) as T);
    }
    return fetcher().andThen((value) => {
      this.set(key, value);
      return okAsync(value);
    });
  }

  async load() {
    if (await this.file.exists()) {
      // console.log(`[functional] Loading store from ${this.file.name}`);
      const file = await this.file.json();
      for (const [key, value] of Object.entries(file)) {
        // console.log(`[functional] Loading ${key}`);
        this.set(key, value);
        // console.log(this.get(key));
      }
    }
    this.isLoaded = true;
  }

  async save() {
    if (this.isTouched) {
      await this.file.write(JSON.stringify(Object.fromEntries(this), null, 2));
      this.isTouched = false;
    }
  }
}
