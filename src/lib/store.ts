import { Mutex } from "./mutex";
import { parse, serialize } from "./superjson";

export interface IStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  entries(): Promise<[string, unknown][]>;
}

export class JSONStore implements IStore {
  private readonly file: Bun.BunFile;
  private state: Record<string, unknown> = {};

  private readonly mutex = new Mutex();

  constructor(path: string) {
    this.file = Bun.file(path);
  }

  async entries(): Promise<[string, unknown][]> {
    return Object.entries(this.state);
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.state[key] as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.state[key] = value;
    await this.save();
  }

  async delete(key: string): Promise<void> {
    delete this.state[key];
    await this.save();
  }

  async load() {
    if (await this.file.exists()) {
      const text = await this.file.text();
      this.state = parse(text) as Record<string, unknown>;
    }
  }

  private async save() {
    await this.mutex.runExclusive(async () => {
      await this.file.write(JSON.stringify(serialize(this.state), null, 2));
    });
  }
}
