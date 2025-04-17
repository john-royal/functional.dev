export class Store extends Map<string, unknown> {
  private file: Bun.BunFile;
  private isLoaded = false;
  private isTouched = false;

  constructor(path: string) {
    super();
    this.file = Bun.file(path);
  }

  set(key: string, value: unknown): this {
    super.set(key, value);
    this.isTouched = true;
    return this;
  }

  async fetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (!this.isLoaded) {
      await this.load();
    }
    if (this.has(key)) {
      return this.get(key) as T;
    }
    const value = await fetcher();
    this.set(key, value);
    return value;
  }

  async load() {
    if (await this.file.exists()) {
      const cache = await this.file.json();
      for (const [key, value] of Object.entries(cache)) {
        this.set(key, value);
      }
    }
    this.isLoaded = true;
  }

  async save() {
    if (this.isTouched) {
      await this.file.write(JSON.stringify(Object.fromEntries(this)));
      this.isTouched = false;
    }
  }
}
