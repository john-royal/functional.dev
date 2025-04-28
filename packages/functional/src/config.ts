import { groupIntoLayers } from "./lib/group";

export interface Context {}

export interface Resource {
  type: string;
  name?: string;
}

export interface R2Resource extends Resource {
  type: "r2";
}

export interface KVResource extends Resource {
  type: "kv";
}

export interface WorkerResource extends Resource {
  type: "worker";
  path: string;
  env?: Record<string, Resource>;
}

type AnyResource = R2Resource | KVResource | WorkerResource;

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

export function defineConfig<T extends Record<string, AnyResource>>(
  config: Config<T>
): Config<T> {
  const resources = new Map<
    string,
    AnyResource & { dependencies?: string[] }
  >();
  for (const [key, value] of Object.entries(config.resources)) {
    if (typeof value === "function") {
      const dependencies = new Set<string>();
      const proxy = new Proxy(
        {},
        {
          get({}, prop: string) {
            if (prop in config.resources && !!config.resources[prop]) {
              dependencies.add(prop);
              const resource = config.resources[prop];
              const type =
                typeof resource === "function"
                  ? resource({} as any).type
                  : resource.type;
              return {
                type: "resolved-resource",
                resource: {
                  name: prop,
                  type,
                },
              };
            } else {
              throw new Error(
                `Resource ${prop} not found, but is required by ${key}`
              );
            }
          },
        }
      );
      const resolvedValue = value(proxy);
      resources.set(key, {
        ...resolvedValue,
        dependencies: Array.from(dependencies),
      });
    } else {
      resources.set(key, {
        ...value,
      });
    }
  }
  console.dir(groupIntoLayers(resources), { depth: null });
  console.dir(resources, { depth: null });
  return config;
}
