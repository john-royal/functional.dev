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
    await this.save();
    return value;
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
