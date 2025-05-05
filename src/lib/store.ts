import { Mutex } from "./mutex";
import { serde } from "./serde";

export interface IStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export class JSONStore implements IStore {
  private readonly file: Bun.BunFile;
  private state: Record<string, unknown> = {};

  private readonly loadPromise: Promise<void>;
  private readonly mutex = new Mutex();

  constructor(path: string) {
    this.file = Bun.file(path);
    this.loadPromise = this.load();
  }

  async entries(): Promise<[string, unknown][]> {
    await this.loadPromise;
    return Object.entries(this.state);
  }

  async get<T>(key: string): Promise<T | undefined> {
    await this.loadPromise;
    return this.state[key] as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.loadPromise;
    this.state[key] = value;
    await this.save();
  }

  async delete(key: string): Promise<void> {
    await this.loadPromise;
    delete this.state[key];
    await this.save();
  }

  private async load() {
    if (await this.file.exists()) {
      this.state = serde.deserialize(await this.file.json());
    }
  }

  private async save() {
    await this.mutex.runExclusive(async () => {
      await this.file.write(
        JSON.stringify(serde.serialize(this.state), null, 2),
      );
    });
  }
}
