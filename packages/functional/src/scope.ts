import { join } from "node:path";
import { CFClient } from "./cloudflare/client";
import { Store } from "./lib/store";
import type { Component, ResourceState } from "./providers/provider";
import { err, ok, okAsync, ResultAsync } from "neverthrow";
import { groupIntoLayers } from "./config/group";

export class App {
  readonly store: Store;
  readonly client: CFClient;

  components = new Map<string, Component<any>>();
  dependencies = new Map<string, { dependencies: string[] }>();

  constructor(
    readonly name: string,
    readonly path: string
  ) {
    this.store = new Store(join(path, "store.json"));
    this.client = new CFClient(this.store);
  }

  prepare(phase: "up" | "down") {
    return ResultAsync.combine(
      Array.from(this.components.values()).map((component) =>
        component
          .prepare(phase)
          .map((action) => [component.name, action] as const)
      )
    ).andThen((actions) => {
      return groupIntoLayers(this.dependencies).map(async (layers) => {
        console.log(layers);
        if (phase === "down") {
          layers.reverse();
        }
        for (const layer of layers) {
          await Promise.all(
            layer.map(async (name) => {
              const found = actions.find((action) => action[0] === name);
              if (found && found[1]) {
                console.log(`component: ${name}; action: ${found[1].action}`);
                return (await found[1].handler())._unsafeUnwrap();
              }
            })
          );
        }
      });
    });
  }
}

export class Scope {
  constructor(
    readonly app: App,
    readonly namespace: string
  ) {}

  get store() {
    return this.app.store;
  }

  get client() {
    return this.app.client;
  }

  extend(id: string) {
    return new Scope(this.app, `${this.namespace}:${id}`);
  }

  getState<TInput, TOutput>() {
    return this.store.get<{ input: TInput; output: TOutput }>(this.namespace);
  }

  setState<TInput, TOutput>(state: ResourceState<TInput, TOutput>) {
    return this.store.set(this.namespace, state);
  }

  deleteState() {
    return this.store.delete(this.namespace);
  }

  register(component: Component<any>, metadata?: { dependsOn?: string[] }) {
    if (this.app.components.has(component.name)) {
      throw new Error(`Component ${component.name} already registered`);
    }
    this.app.components.set(component.name, component);
    this.app.dependencies.set(component.name, {
      dependencies: metadata?.dependsOn ?? [],
    });
  }
}
