import { AsyncLocalStorage } from "node:async_hooks";
import type { BaseResource } from "./base";

const context = new AsyncLocalStorage<Set<any>>();

export const register = (resource: BaseResource) => {
  const registry = context.getStore();
  if (!registry) {
    throw new Error(
      "Cannot find registry context - did you forget to run `functional config`?"
    );
  }
  registry.add(resource);
};

export const registerResources = async <T>(
  setup: () => unknown
): Promise<T[]> => {
  const registry = new Set<T>();
  await context.run(registry, setup);
  return Array.from(registry);
};
