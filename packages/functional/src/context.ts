import { AsyncLocalStorage } from "async_hooks";

export interface Context {
  name: string;
  environment: string;
  cwd: string;
  out: string;
}

const storage = new AsyncLocalStorage<Context>();

export function createContext<T>(value: Context, fn: () => Promise<T>) {
  return storage.run(value, fn);
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
