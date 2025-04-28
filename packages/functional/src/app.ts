import { ResultAsync } from "neverthrow";
import assert from "node:assert";
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import { CFClient } from "./lib/cloudflare-client";
import { groupIntoLayers } from "./lib/group";
import { Store } from "./lib/store";
import type { AnyComponent, ComponentAction } from "./resource";

interface AppInput {
  name: string;
  stage: string;
}

export class App {
  readonly name: string;
  readonly stage: string;
  readonly store: Store;
  readonly cf = new CFClient();
  private components = new Map<string, AnyComponent>();

  constructor(input: AppInput) {
    this.name = input.name;
    this.stage = input.stage;
    this.store = new Store(path.join(process.cwd(), "store.json"));
  }

  register<TComponent extends AnyComponent>(component: TComponent) {
    if (this.components.has(component.id)) {
      throw new Error(`Component ${component.id} already registered`);
    }
    this.components.set(component.id, component);
  }

  run(phase: "up" | "down") {
    const plan = new Map<string, ComponentAction<unknown>>();
    console.time("prepare");
    return ResultAsync.combineWithAllErrors(
      Array.from(this.components.values()).map((component) =>
        component.prepare(phase).map((action) => {
          if (action) {
            plan.set(component.id, action);
          }
        })
      )
    )
      .map(() => {
        console.timeEnd("prepare");
        console.time("execute");
        return this.execute(plan);
      })
      .map((result) => {
        console.timeEnd("execute");
        return result;
      });
  }

  async execute(plan: Map<string, ComponentAction<unknown>>) {
    const layers = groupIntoLayers(plan);
    for (const layer of layers) {
      const res = await ResultAsync.combine(
        layer.map((id) => {
          const action = plan.get(id);
          assert(action, `Action for ${id} not found`);
          console.log(`running ${action.action} for ${id}`);
          return action
            .handler()
            .map(() => {
              console.log(`${action.action} for ${id} done`);
            })
            .mapErr((error) => {
              console.error(`${action.action} for ${id} failed`, error);
              return {
                id,
                error,
              };
            });
        })
      );
      if (res.isErr()) {
        throw res.error;
      }
    }
  }
}

export const context = new AsyncLocalStorage<App>();

export const createApp = async <T>(input: AppInput, f: () => T) => {
  const app = new App(input);
  await app.store.load();
  context.enterWith(app);
  await f();
  return app;
};

export const $app = new Proxy({} as App, {
  get(_, prop: keyof App) {
    const app = context.getStore();
    if (!app) {
      throw new Error("App not found");
    }
    return app[prop];
  },
});

export const $store = new Proxy({} as Store, {
  get(_, prop: keyof Store) {
    const value = $app.store[prop];
    if (typeof value === "function") {
      return value.bind($app.store);
    }
    return value;
  },
});

export const $cf = new Proxy({} as CFClient, {
  get(_, prop: keyof CFClient) {
    const value = $app.cf[prop];
    if (typeof value === "function") {
      return value.bind($app.cf);
    }
    return value;
  },
});
