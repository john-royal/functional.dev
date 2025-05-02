import assert from "node:assert";
import { AsyncLocalStorage } from "node:async_hooks";
import { serde } from "./lib/serde";
import { ResourceHandle, type Resource } from "./resource";

class DependsOn {
  constructor(readonly dependsOn: string[]) {}
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
  handles = new Map<string, ResourceHandle<unknown, unknown>>();
  dynamicRegister?: (resource: Resource<string, unknown, unknown>) => void;

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
    console.log(`Registering resource ${resource.name}`);
    this.resources.set(resource.name, resource);
    this.handles.set(resource.name, new ResourceHandle());
    this.dynamicRegister?.(resource);
  }

  async waitFor<TInput, TOutput>(
    resource: Resource<string, TInput, TOutput>,
  ): Promise<Resource.State<TInput, TOutput>> {
    const handle = this.handles.get(resource.name);
    if (!handle) {
      throw new Error(`Resource ${resource.name} not registered`);
    }
    const actions = await handle.action.promise;
    if (handle.state.status === "pending") {
      console.log(`Wait for ${resource.name} ${actions.length} actions`);
      throw new DependsOn(
        actions.map((action) => `${resource.name}:${action.status}`),
      );
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
      await this.doRun(Array.from(this.resources.values()));
    } finally {
      await this.save();
      await this.cleanup();
    }
  }

  async cleanup() {
    const orphans = Object.keys(this.state).filter(
      (name) => !this.resources.has(name),
    );
    for (const orphan of orphans) {
      const state = this.state[orphan];
      if (!state) {
        continue;
      }
      const ResourceClass = await this.getResourceClass(state.kind);
      const resource = new ResourceClass(state.name, state.input);
      const actions = await this.planResource(resource, "down");
      await Promise.allSettled(
        actions.map(async (action) => {
          try {
            await action.apply?.();
            delete this.state[resource.name];
          } catch (error) {
            console.error(`Failed to delete resource ${resource.name}`, error);
          }
        }),
      );
    }
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

  private async doRun(
    resources: Resource<string, unknown, unknown>[],
    attempt = 0,
  ) {
    const actions = await this.plan(resources);
    console.log(
      `${attempt + 1}: Detected ${actions.length} resources with ${actions.reduce((acc, item) => acc + item.actions.length, 0)} actions`,
    );
    const leftover: Resource<string, unknown, unknown>[] = [];
    await Promise.allSettled(
      actions.map(async (item) => {
        if (item.dependsOn.length > 0) {
          console.log(
            `${item.resource.name} depends on ${item.dependsOn.join(", ")}`,
          );
          leftover.push(item.resource);
          return;
        }
        const handle = this.handles.get(item.resource.name);
        assert(handle, `Resource ${item.resource.name} not registered`);
        try {
          for (const action of item.actions) {
            console.log(`[${item.resource.name}] ${action.status}`);
            await this.applyResource(item.resource, action);
          }
          handle.state.resolve(
            this.state[item.resource.name] as Resource.State<unknown, unknown>,
          );
        } catch (error) {
          console.error(
            `Failed to apply resource ${item.resource.name}`,
            error,
          );
          handle.state.reject(error);
        }
      }),
    );
    if (leftover.length > 0) {
      if (attempt >= 3) {
        console.log("Leftover resources:", leftover);
        throw new Error("Too many attempts");
      }
      for (const item of resources) {
        this.handles.set(item.name, new ResourceHandle());
      }
      await this.doRun(resources, attempt + 1);
    }
  }

  private async plan(resources: Resource<string, unknown, unknown>[]) {
    const foundResources = new Set<string>();
    const planStream = new TransformStream<
      Resource<string, unknown, unknown>,
      | {
          resource: Resource<string, unknown, unknown>;
          actions: (
            | Resource.CreateAction<unknown>
            | Resource.UpdateAction<unknown>
            | Resource.DeleteAction
          )[];
          dependsOn: never[];
        }
      | {
          resource: Resource<string, unknown, unknown>;
          dependsOn: string[];
          actions: never[];
        }
    >({
      transform: (resource, controller) => {
        const handle = this.handles.get(resource.name);
        assert(handle, `Resource ${resource.name} not registered`);
        this.planResource(resource)
          .then((actions) => {
            console.log(`Plan ${resource.name} ${actions.length} actions`);
            handle.action.resolve(actions);
            controller.enqueue({
              resource,
              actions,
              dependsOn: [],
            });
          })
          .catch((error) => {
            if (error instanceof DependsOn) {
              handle.action.resolve([]);
              controller.enqueue({
                resource,
                dependsOn: error.dependsOn,
                actions: [],
              });
            } else {
              controller.error(error);
            }
          })
          .finally(() => {
            foundResources.add(resource.name);
            if (
              resources.every((resource) => foundResources.has(resource.name))
            ) {
              writer.close();
            }
          });
      },
      flush: () => {
        this.dynamicRegister = undefined;
      },
    });
    const writer = planStream.writable.getWriter();
    this.dynamicRegister = (resource) => {
      console.log(`Dynamic register ${resource.name}`);
      writer.write(resource);
    };
    for (const resource of resources) {
      writer.write(resource);
    }
    return Array.fromAsync(planStream.readable);
  }

  private async applyResource(
    resource: Resource<string, unknown, unknown>,
    action:
      | Resource.CreateAction<unknown>
      | Resource.UpdateAction<unknown>
      | Resource.DeleteAction,
  ) {
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
        return;
      }
      case "delete": {
        if (action.apply) {
          await action.apply();
        }
        delete this.state[resource.name];
        return;
      }
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
    const context = this.getResourceContext(this.phase, resource.name);
    if (!context) {
      return [];
    }
    return await Promise.resolve(resource.run(context)).then(async (action) => {
      if (action.status === "none") {
        this.state[resource.name] = {
          ...this.state[resource.name],
          status: "none",
        } as Resource.State<unknown, unknown> & { kind: string; name: string };
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
        return [deleteAction, createAction];
      }
      return [action];
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
