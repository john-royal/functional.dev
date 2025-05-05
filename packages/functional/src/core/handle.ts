import assert from "node:assert";
import { DetachedPromise } from "../lib/detached-promise";
import { groupByDependencies } from "../lib/group";
import type { App } from "./app";
import { useResourceOutputStorage } from "./output";
import type { Resource } from "./resource";

export class LifecycleHandler {
  handles = new Map<string, ResourceHandle>();
  groups: string[][];

  constructor(readonly app: App) {
    for (const [name, resource] of this.app.resources.entries()) {
      this.handles.set(name, new ResourceHandle(app, resource));
    }
    this.groups = groupByDependencies(this.handles);
  }

  async up() {
    await useResourceOutputStorage.run(this, () => this.upInternal());
    await this.deleteStrayResources();
  }

  async down() {
    for (const group of this.groups.toReversed()) {
      const actions = await Promise.all(
        group.map(async (name) => {
          const handle = this.handles.get(name);
          assert(handle, `Resource ${name} not found`);
          return [name, await handle.down()] as const;
        }),
      );
      await Promise.all(
        actions.map(([name, action]) => {
          if (action) {
            console.log(`[${name}] ${action.action}`);
            return action.apply();
          }
        }),
      );
    }
    await this.deleteStrayResources();
  }

  private async deleteStrayResources() {
    const providers = new Map<string, Resource.Provider<Resource.Properties>>();
    const strayResources = [];
    for (const [name, resource] of await this.app.state.entries<
      SerializedResourceState<Resource.Properties>
    >()) {
      if (!this.handles.has(name)) {
        providers.set(
          resource.kind,
          await this.getResourceClass(resource).then((r) => r.provider),
        );
        strayResources.push(resource);
      }
    }
    return await Promise.all(
      strayResources.map(async (resource) => {
        const provider = providers.get(resource.kind);
        assert(provider, `Provider for ${resource.kind} not found`);
        console.log(`Deleting stray resource ${resource.name}`);
        await provider.delete?.(resource);
        await this.app.state.delete(resource.name);
      }),
    );
  }

  private async getResourceClass(
    state: SerializedResourceState<Resource.Properties>,
  ) {
    const path = state.kind.replace(/:/g, "/");
    try {
      const pathWithoutIndex = await import(`~/resources/${path}.ts`);
      return pathWithoutIndex.default as {
        provider: Resource.Provider<Resource.Properties>;
      };
    } catch {
      const pathWithIndex = await import(`~/resources/${path}/index.ts`);
      return pathWithIndex.default as {
        provider: Resource.Provider<Resource.Properties>;
      };
    }
  }

  private async upInternal() {
    for (const group of this.groups) {
      const actions = await Promise.all(
        group.map(async (name) => {
          const handle = this.handles.get(name);
          assert(handle, `Resource ${name} not found`);
          return [name, await handle.up()] as const;
        }),
      );
      await Promise.all(
        actions.map(([name, action]) => {
          if (action) {
            console.log(`[${name}] ${action.action}`);
            return action.apply();
          }
        }),
      );
    }
  }

  use<T extends Resource.Properties>(resource: Resource<T>) {
    const handle = this.handles.get(resource.name);
    assert(handle, `Resource ${resource.name} not found`);
    return handle.outputPromise.promise;
  }
}

type SerializedResourceState<T extends Resource.Properties> =
  Resource.State<T> & {
    kind: T["kind"];
    name: string;
  };

export class ResourceHandle<
  T extends Resource.Properties = Resource.Properties,
> {
  actionPromise = new DetachedPromise<
    "create" | "update" | "replace" | "delete" | "none"
  >();
  outputPromise = new DetachedPromise<T["output"]["out"]>();

  constructor(
    readonly app: App,
    readonly resource: Resource<T>,
  ) {}

  get dependencies() {
    return this.resource.metadata.dependsOn;
  }

  async up() {
    const state = await this.app.state.get<SerializedResourceState<T>>(
      this.resource.name,
    );
    if (state) {
      const diff = await this.resource.provider.diff(
        await this.resource.getDerivedInput(),
        state,
      );
      switch (diff) {
        case "none": {
          this.outputPromise.resolve(state.output);
          this.actionPromise.resolve("none");
          return;
        }
        case "update": {
          this.actionPromise.resolve("update");
          return {
            action: "update",
            apply: async () => {
              const output = await this.update(state);
              this.outputPromise.resolve(output);
            },
          };
        }
        case "replace": {
          this.actionPromise.resolve("replace");
          return {
            action: "replace",
            apply: async () => {
              await this.delete(state);
              const output = await this.create();
              this.outputPromise.resolve(output);
            },
          };
        }
      }
    }
    this.actionPromise.resolve("create");
    return {
      action: "create",
      apply: async () => {
        const output = await this.create();
        this.outputPromise.resolve(output);
      },
    };
  }

  async down() {
    const state = await this.app.state.get<SerializedResourceState<T>>(
      this.resource.name,
    );
    if (!state) {
      return;
    }
    return {
      action: "delete",
      apply: async () => {
        await this.delete(state);
        await this.app.state.delete(this.resource.name);
      },
    };
  }

  private async create() {
    const input = await this.resource.getDerivedInput();
    const { providerId, output: rawOutput } =
      await this.resource.provider.create(input);
    const output = await this.resource.getDerivedOutput(rawOutput);
    await this.app.state.set(this.resource.name, {
      providerId,
      input,
      output,
      kind: this.resource.kind,
      name: this.resource.name,
    });
    return output;
  }

  private async update(state: SerializedResourceState<T>) {
    if (!this.resource.provider.update) {
      throw new Error(
        `Resource ${this.resource.name} does not support updates`,
      );
    }
    const input = await this.resource.getDerivedInput();
    const rawOutput = await this.resource.provider.update(input, state);
    const output = await this.resource.getDerivedOutput(rawOutput);
    await this.app.state.set(this.resource.name, {
      providerId: state.providerId,
      input,
      output,
      kind: this.resource.kind,
      name: this.resource.name,
    });
    return output;
  }

  private async delete(state: SerializedResourceState<T>) {
    if (this.resource.provider.delete) {
      await this.resource.provider.delete(state);
    }
    await this.app.state.delete(this.resource.name);
  }
}
