import { isENOENT } from "./utils";

export class Cache {
  private file: Bun.BunFile;
  private value = new Map<string, unknown>();
  private isTouched = false;
  private promises: Promise<unknown>[] = [];

  constructor(path: string) {
    this.file = Bun.file(path);
  }

  async load() {
    try {
      const cache = await this.file.json();
      for (const [key, value] of Object.entries(cache)) {
        this.value.set(key, value);
      }
    } catch (error) {
      if (!isENOENT(error)) {
        console.error("Failed to load cache", error);
      }
    }
  }

  get<T>(key: string) {
    return this.value.get(key) as T;
  }

  set<T>(key: string, value: T) {
    this.isTouched = true;
    if (this.isPromise(value)) {
      this.promises.push(
        value
          .then((res) => this.value.set(key, res))
          .catch((err) => {
            console.error(`Failed to set key "${key}" from promise`, err);
          })
      );
    } else {
      this.value.set(key, value);
    }
  }

  private isPromise(value: unknown): value is Promise<unknown> {
    return typeof value === "object" && value !== null && "then" in value;
  }

  async save() {
    if (!this.isTouched) return;
    if (this.promises.length > 0) {
      await Promise.all(this.promises);
    }
    await this.file.write(
      JSON.stringify(Object.fromEntries(this.value), null, 2)
    );
    this.isTouched = false;
  }

  async wrap<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached) return Promise.resolve(cached);
    const res = await fn();
    this.set(key, res);
    return res;
  }
}
