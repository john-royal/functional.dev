import assert from "node:assert";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Resource } from "./resource";

interface UseOutputProvider {
  use<T extends Resource.Properties>(
    resource: Resource<T>,
  ): Promise<Resource.Output<T>>;
}

export const useOutputStorage = new AsyncLocalStorage<UseOutputProvider>();

export function useResourceOutput<T extends Resource.Properties>(
  resource: Resource<T>,
): Promise<Resource.Output<T>>;

export function useResourceOutput<T extends Resource.Properties>(
  resource: Resource<T> | undefined,
): Promise<Resource.Output<T> | undefined>;

export function useResourceOutput<T extends Resource.Properties>(
  resource: Resource<T> | undefined,
): Promise<Resource.Output<T> | undefined> {
  if (!resource) {
    return Promise.resolve(undefined);
  }
  const provider = useOutputStorage.getStore();
  assert(
    provider,
    "useResourceOutput must be called inside a LifecycleHandler",
  );
  return provider.use(resource);
}
