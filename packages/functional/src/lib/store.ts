import { Mutex } from "./mutex";

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

  constructor(
    path: string,
    readonly serde: {
      serialize: (value: unknown) => unknown;
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      deserialize: (value: any) => unknown;
    } = {
      serialize: (value) => value,
      deserialize: (value) => value,
    },
  ) {
    this.file = Bun.file(path);
  }

  async entries<T>(): Promise<[string, T][]> {
    return Object.entries(this.state) as [string, T][];
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.state[key] as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.state[key] = value;
    await this.save();
  }

  async patch<T>(key: string, value: Partial<T>): Promise<void> {
    this.state[key] = {
      ...(this.state[key] as T),
      ...value,
    };
    await this.save();
  }

  async delete(key: string): Promise<void> {
    delete this.state[key];
    await this.save();
  }

  async load() {
    if (await this.file.exists()) {
      const json = await this.file.json();
      this.state = this.serde.deserialize(json) as Record<string, unknown>;
    }
  }

  private async save() {
    await this.mutex.runExclusive(async () => {
      if (Object.keys(this.state).length === 0) {
        await this.file.unlink().catch((error) => {
          if (error.code !== "ENOENT") {
            throw error;
          }
        });
        return;
      }
      await this.file.write(
        JSON.stringify(this.serde.serialize(this.state), null, 2),
      );
    });
  }
}
