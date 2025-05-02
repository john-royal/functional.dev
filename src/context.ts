import assert from "node:assert";
import { AsyncLocalStorage } from "node:async_hooks";
import { DetachedPromise } from "./lib/detached-promise";
import { groupByDependencies } from "./lib/group";
import { serde } from "./lib/serde";
import type { Resource } from "./resource";

class AwaitedDependency {}

class ResourceHandle {
  actions = new DetachedPromise<Resource.Action<unknown>[]>();
  state = new DetachedPromise<Resource.State<unknown, unknown>>();
}

export class Context {
  private static readonly storage = new AsyncLocalStorage<Context>();

  static get() {
    const context = Context.storage.getStore();
    if (!context) {
      throw new Error("No context");
    }
    return context;
  }

  static enter(context: Context) {
    return Context.storage.enterWith(context);
  }

  resources = new Map<string, Resource<string, unknown, unknown>>();
  state: Record<
    string,
    Resource.State<unknown, unknown> & { kind: string; name: string }
  > = {};
  handles = new Map<string, ResourceHandle>();

  constructor(readonly phase: "up" | "down") {}

  async init() {
    const file = Bun.file("state.json");
    if (await file.exists()) {
      this.state = serde.deserialize(await file.json());
    }
  }

  async save() {
    const file = Bun.file("state.json");
    await file.write(JSON.stringify(serde.serialize(this.state), null, 2));
  }

  register(resource: Resource<string, unknown, unknown>) {
    if (this.resources.has(resource.name)) {
      throw new Error(`Resource ${resource.name} already registered`);
    }
    this.resources.set(resource.name, resource);
    this.handles.set(resource.name, new ResourceHandle());
  }

  async waitFor<TInput, TOutput>(
    resource: Resource<string, TInput, TOutput>,
  ): Promise<Resource.State<TInput, TOutput>> {
    const handle = this.handles.get(resource.name);
    assert(handle, `Resource ${resource.name} not registered`);
    await handle.actions.promise;
    if (handle.state.status === "pending") {
      throw new AwaitedDependency();
    }
    const state = this.state[resource.name];
    if (!state) {
      throw new Error(`Resource ${resource.name} not found in state`);
    }
    return state as Resource.State<TInput, TOutput>;
  }

  async run() {
    await this.init();
    try {
      const { actions, steps } = await this.plan(
        Array.from(this.resources.values()),
      );

      if (actions.values().every(({ actions }) => actions.length === 0)) {
        console.log("No changes detected");
        return;
      }
      if (this.phase === "down") {
        steps.reverse();
      }
      for (const step of steps) {
        await Promise.all(
          step.map(async (resourceName) => {
            const resource = this.resources.get(resourceName);
            const item = actions.get(resourceName);
            assert(resource, `Resource ${resourceName} not registered`);
            assert(item, `Resource ${resourceName} has no actions`);
            await this.applyResource(resource, item.actions);
          }),
        );
      }
    } finally {
      await this.save();
      await this.cleanup();
    }
  }

  async cleanup() {
    await Promise.all(
      Object.entries(this.state).map(async ([name, state]) => {
        if (this.resources.has(name)) {
          return;
        }
        const ResourceClass = await this.getResourceClass(state.kind);
        const resource = new ResourceClass(state.name, state.input);
        const actions = await this.planResource(resource, "down");
        return this.applyResource(resource, actions);
      }),
    );
    await this.save();
  }

  private async getResourceClass(kind: string): Promise<{
    new (name: string, input: unknown): Resource<string, unknown, unknown>;
  }> {
    try {
      const { default: ResourceClass } = await import(`./resources/${kind}.ts`);
      return ResourceClass;
    } catch {
      const { default: ResourceClass } = await import(
        `./resources/${kind}/index.ts`
      );
      return ResourceClass;
    }
  }

  private async plan(resources: Resource<string, unknown, unknown>[]) {
    const actionsList = await Promise.all(
      resources.map(async (resource) => {
        const actions = await this.planResource(resource);
        return [
          resource.name,
          {
            actions,
            dependencies: resource.dependencies,
          },
        ] as const;
      }),
    );
    const actions = new Map(actionsList);
    const steps = groupByDependencies(actions);
    return {
      actions,
      steps,
    };
  }

  private async applyResource(
    resource: Resource<string, unknown, unknown>,
    actions: Resource.Action<unknown>[],
    log = true,
  ) {
    const handle = this.handles.get(resource.name);
    assert(handle, `Resource ${resource.name} not registered`);

    for (const action of actions) {
      if (log) {
        console.log(`[${resource.name}] ${action.status}`);
      }
      switch (action.status) {
        case "create":
        case "update": {
          const output = await action.apply();
          this.state[resource.name] = {
            kind: resource.kind,
            name: resource.name,
            status: action.status === "create" ? "created" : "updated",
            input: resource.input,
            output,
          };
          break;
        }
        case "delete": {
          if (action.apply) {
            await action.apply();
          }
          delete this.state[resource.name];
          break;
        }
        case "none":
        case "replace":
          break;
      }
    }

    const state = this.state[resource.name];
    if (state) {
      handle.state.resolve(state);
    }
  }

  private async planResource(
    resource: Resource<string, unknown, unknown>,
    phase = this.phase,
  ): Promise<
    (
      | Resource.CreateAction<unknown>
      | Resource.UpdateAction<unknown>
      | Resource.DeleteAction
    )[]
  > {
    const handle = this.handles.get(resource.name);
    assert(handle, `Resource ${resource.name} not registered`);
    const context = this.getResourceContext(phase, resource.name);
    if (!context) {
      return [];
    }
    return await Promise.resolve(resource.run(context))
      .then(async (action) => {
        if (action.status === "none") {
          const state = {
            ...this.state[resource.name],
            status: "none",
          } as Resource.State<unknown, unknown> & {
            kind: string;
            name: string;
          };
          this.state[resource.name] = state;
          handle.state.resolve(state);
          handle.actions.resolve([]);
          return [];
        }
        if (action.status === "replace") {
          const [createAction, deleteAction] = await Promise.all([
            resource.run({
              ...context,
              status: "delete",
            }),
            resource.run({
              status: "create",
              input: undefined,
              output: undefined,
            }),
          ]);
          assert(deleteAction.status === "delete");
          assert(createAction.status === "create");
          const actions = [deleteAction, createAction];
          handle.actions.resolve(actions);
          return actions;
        }
        handle.actions.resolve([action]);
        return [action];
      })
      .catch((error) => {
        if (error instanceof AwaitedDependency) {
          const actions: Resource.UpdateAction<unknown>[] = [
            {
              status: "update",
              apply: async () => {
                const actions = await this.planResource(resource);
                return this.applyResource(resource, actions, false);
              },
            },
          ];
          handle.actions.resolve(actions);
          return actions;
        }
        throw error;
      });
  }

  private getResourceContext(
    phase: "up" | "down",
    name: string,
  ): Resource.Context<unknown, unknown> | null {
    const state = this.state[name];

    if (phase === "down") {
      if (state) {
        return {
          status: "delete",
          input: state.input,
          output: state.output,
        };
      }
      return null;
    }

    if (state) {
      return {
        status: "update",
        input: state.input,
        output: state.output,
      };
    }

    return {
      status: "create",
      input: undefined,
      output: undefined,
    };
  }
}
