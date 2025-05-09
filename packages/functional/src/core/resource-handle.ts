import { DetachedPromise } from "~/lib/detached-promise";
import type { Resource } from "./resource";
import type { App } from "./app";

export type SerializedResourceState<T extends Resource.Properties> =
  Resource.State<T> & {
    kind: T["kind"];
    name: string;
  };

export class ResourceHandle<
  T extends Resource.Properties = Resource.Properties,
> {
  actionPromise = new DetachedPromise<
    "create" | "update" | "replace" | "delete" | "none" | "dev"
  >();
  outputPromise = new DetachedPromise<T["output"]["out"]>();
  devCommand?: Resource.DevCommand<T>;

  dependents: string[] = [];

  constructor(
    readonly app: App,
    readonly resource: Resource<T>,
    readonly onUpdate?: () => void,
  ) {}

  get dependencies() {
    return this.resource.metadata.dependsOn;
  }

  async run(phase: "up" | "down" | "dev") {
    switch (phase) {
      case "dev": {
        return this.dev();
      }
      case "up": {
        return this.up();
      }
      case "down": {
        return this.down();
      }
    }
  }

  private async dev() {
    if (!this.resource.provider.dev) {
      return this.up();
    }
    if (this.devCommand) {
      this.outputPromise = new DetachedPromise();
    } else {
      this.devCommand = this.resource.provider.dev();
      this.actionPromise.resolve("dev");
    }
    const input = await this.resource.getDerivedInput();
    const rawOutput = await this.devCommand.run(
      {
        trigger: () => {
          this.onUpdate?.();
        },
      },
      input,
    );
    const output = await this.resource.getDerivedOutput(rawOutput);
    await this.app.state.patch(this.resource.name, {
      input,
      output,
      kind: this.resource.kind,
      name: this.resource.name,
    });
    this.outputPromise.resolve(output);
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
