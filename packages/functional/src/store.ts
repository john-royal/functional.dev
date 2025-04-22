import { Context, Effect } from "effect";
import path from "path";

interface IStore {
  readonly get: <T>(key: string) => Effect.Effect<T | undefined>;
  readonly set: <T>(key: string, value: T) => Effect.Effect<void>;
}

export class Store extends Context.Tag("Store")<Store, IStore>() {}

const file = Bun.file(path.join(process.cwd(), "store.json"));
const promise = Effect.promise(
  (): Promise<Record<string, unknown>> => file.json().catch(() => ({}))
);

export const StoreLive = Store.of({
  get<T>(key: string) {
    return promise.pipe(
      Effect.map((content) => content[key] as unknown as T | undefined)
    );
  },
  set(key, value) {
    return promise.pipe(
      Effect.map((content) => {
        content[key] = value;
        return content;
      }),
      Effect.tap((content) =>
        Effect.promise(() => file.write(JSON.stringify(content, null, 2)))
      )
    );
  },
} as IStore);
