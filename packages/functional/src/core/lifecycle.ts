import assert from "node:assert";
import { resourceProviders } from "~/registry";
import { groupByDependencies } from "../lib/group";
import type { App } from "./app";
import type { Resource } from "./resource";
import {
  ResourceHandle,
  type SerializedResourceState,
} from "./resource-handle";
import { AsyncLocalStorage } from "node:async_hooks";
import { EventEmitter } from "node:events";

interface EventMap {
  update: [resource: string];
}

export async function run(app: App, phase: "up" | "down" | "dev") {
  const ee = new EventEmitter<EventMap>();
  const handles = new Map<string, ResourceHandle>();
  for (const [name, resource] of app.resources.entries()) {
    handles.set(
      name,
      new ResourceHandle(app, resource, () => {
        ee.emit("update", name);
      }),
    );
  }
  for (const resource of handles.values()) {
    for (const dependency of resource.dependencies) {
      const handle = handles.get(dependency);
      assert(handle, `Dependency ${dependency} not found`);
      handle.dependents.push(resource.resource.name);
    }
  }
  const groups = groupByDependencies(handles);
  if (phase === "down") {
    groups.reverse();
  }
  const use = <T extends Resource.Properties>(
    resource?: Resource<T>,
  ): Promise<Resource.Output<T> | undefined> => {
    if (!resource) {
      return Promise.resolve(undefined);
    }
    const handle = handles.get(resource.name);
    assert(handle, `Resource ${resource.name} not found`);
    return handle.outputPromise.promise;
  };
  const handleUpdate = async (resourceName: string) => {
    const handle = handles.get(resourceName);
    assert(handle, `Resource ${resourceName} not found`);
    await handle.run("dev");
    await Promise.all(
      handle.dependents.map(async (dependent) => {
        await handleUpdate(dependent);
      }),
    );
  };
  return runContext.run({ use }, async () => {
    let changed = false;
    for (const group of groups) {
      const plan = await Promise.all(
        group.map(async (name) => {
          const handle = handles.get(name);
          assert(handle, `Resource ${name} not found`);
          return {
            resource: name,
            action: await handle.run(phase),
          };
        }),
      );
      await Promise.all(
        plan.map(({ resource, action }) => {
          if (action) {
            console.log(`[${resource}] ${action.action}`);
            changed = true;
            return action.apply();
          }
        }),
      );
    }
    if (phase === "dev") {
      ee.on("update", async (resourceName) => {
        await runContext.run({ use }, handleUpdate, resourceName);
      });
    }
    const state =
      await app.state.entries<SerializedResourceState<Resource.Properties>>();
    await Promise.all(
      state.map(async ([name, resource]) => {
        if (handles.has(name)) {
          return;
        }
        const getProvider = resourceProviders[resource.kind];
        assert(getProvider, `Provider for ${resource.kind} not found`);
        const provider = await getProvider();
        console.log(`[${name}] delete`);
        await provider.delete?.(resource);
        await app.state.delete(name);
        changed = true;
      }),
    );
    if (!changed && phase !== "dev") {
      console.log("No changes detected");
    }
  });
}

// biome-ignore lint/suspicious/noExplicitAny: required for overloading
type UseResourceType = Resource<any> | undefined;

type UseResourceOutput<T extends UseResourceType> = T extends undefined
  ? undefined
  : T extends Resource<infer P>
    ? Resource.Output<P>
    : never;

interface RunContext {
  use<R extends UseResourceType>(resource: R): Promise<UseResourceOutput<R>>;
}

export const runContext = new AsyncLocalStorage<RunContext>();

export const $run = new Proxy({} as RunContext, {
  get: (_, prop) => {
    const context = runContext.getStore();
    if (!context) {
      throw new Error("$run must be called inside a run");
    }
    return Reflect.get(context, prop);
  },
});
