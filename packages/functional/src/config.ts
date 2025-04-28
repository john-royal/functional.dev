import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";
import { CyclicDependencyError, groupIntoLayers } from "./lib/group";

export interface Context {}

export interface Resource {
  type: string;
  name?: string;
}

export interface R2Resource extends Resource {
  type: "r2";
}

export interface KVNamespaceResource extends Resource {
  type: "kv";
}

export interface WorkerResource extends Resource {
  type: "worker";
  path: string;
  env?: Record<string, Resource>;
}

type AnyResource = R2Resource | KVNamespaceResource | WorkerResource;

type ResourceFactory<TResource extends AnyResource> =
  | TResource
  | ((ctx: Context) => TResource);

type ResourceMap<T extends Record<string, AnyResource>> = {
  [K in keyof T]: ResourceFactory<T[K]>;
};

export interface Config<T extends Record<string, AnyResource>> {
  name: string;
  resources: ResourceMap<T>;
}

class DependencyResolutionError extends Error {
  constructor(
    readonly resource: string,
    readonly requiredBy: string
  ) {
    super(`Resource ${resource} not found, but is required by ${requiredBy}`);
  }
}

export function defineConfig<T extends Record<string, AnyResource>>(
  config: Config<T>
): Result<
  {
    config: Config<T>;
    resources: Map<string, AnyResource & { dependencies?: string[] }>;
    layers: string[][];
  },
  DependencyResolutionError | CyclicDependencyError
> {
  const resources = new Map<
    string,
    AnyResource & { dependencies?: string[] }
  >();
  for (const [key, value] of Object.entries(config.resources)) {
    if (typeof value === "function") {
      const result = resolveDependencies(config.resources, key, value);
      if (result.isErr()) {
        return err(result.error);
      }
      resources.set(key, result.value);
    } else {
      resources.set(key, {
        ...value,
      });
    }
  }
  const layers = groupIntoLayers(resources);
  if (layers.isErr()) {
    return err(layers.error);
  }
  return ok({
    config,
    resources,
    layers: layers.value,
  });
}

function resolveDependencies<T extends Record<string, AnyResource>>(
  resources: ResourceMap<T>,
  key: string,
  factory: (ctx: Context) => T[keyof T]
): Result<T[keyof T] & { dependencies?: string[] }, DependencyResolutionError> {
  const dependencies = new Set<string>();
  const context = new Proxy({} as unknown as Context, {
    get({}, prop: string) {
      if (prop in resources && !!resources[prop]) {
        dependencies.add(prop);
        const resource = resources[prop];
        const type =
          typeof resource === "function"
            ? resource(context).type
            : resource.type;
        return {
          type: "resolved-resource",
          resource: {
            name: prop,
            type,
          },
        };
      } else {
        throw new DependencyResolutionError(prop, key);
      }
    },
  });
  try {
    const resolvedValue = factory(context);
    return ok({
      ...resolvedValue,
      dependencies: Array.from(dependencies),
    });
  } catch (error) {
    return err(error as DependencyResolutionError);
  }
}
