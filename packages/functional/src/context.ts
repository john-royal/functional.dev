import { AsyncLocalStorage } from "async_hooks";
import { Cache } from "./cli/cache";
import path from "path";

export interface Context {
  name: string;
  environment: string;
  cwd: string;
  out: string;
  cache: Cache;
}

const storage = new AsyncLocalStorage<Context>();

export function enterContext(context: Omit<Context, "cache">) {
  return storage.enterWith({
    ...context,
    cache: new Cache(path.join(context.out, ".cache.json")),
  });
}

export function createContext<T>(
  value: Omit<Context, "cache">,
  fn: () => Promise<T>
) {
  return storage.run(
    {
      ...value,
      cache: new Cache(path.join(value.out, ".cache.json")),
    },
    fn
  );
}

export const $app = new Proxy({} as Context, {
  get(_, prop: keyof Context) {
    const value = storage.getStore();
    if (!value) {
      throw new Error("Context not found");
    }
    return value[prop];
  },
});
