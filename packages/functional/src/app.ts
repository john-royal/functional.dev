import { AsyncLocalStorage } from "unenv/node/async_hooks";
import type { AnyComponent, ComponentAction } from "./component";
import { Store } from "./store";
import path from "node:path";
import { CFClient } from "./lib/cloudflare-client";

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

  async plan(phase: "up" | "down") {
    const plan = new Map<string, ComponentAction | null>();
    await Promise.all(
      this.components.values().map(async (component) => {
        const action = await component.plan(phase);
        plan.set(component.id, action);
      })
    );
    for (const [id, action] of plan.entries()) {
      if (!action) continue;
      const component = this.components.get(id)!;
      switch (action) {
        case "create":
          console.log(`Creating ${component.id}`);
          await component.create();
          console.log(`Created ${component.id}`);
          break;
        case "delete":
          console.log(`Deleting ${component.id}`);
          await component.delete();
          console.log(`Deleted ${component.id}`);
          break;
      }
    }
  }
}

const context = new AsyncLocalStorage<App>();

export const createApp = async <T>(input: AppInput, f: () => T) => {
  const app = new App(input);
  await app.store.load();
  context.enterWith(app);
  await f();
  return app;
};

export const useApp = () => {
  const app = context.getStore();
  if (!app) {
    throw new Error("App not found");
  }
  return app;
};

export const useStore = () => {
  const app = useApp();
  return app.store;
};

export const useCF = () => {
  const app = useApp();
  return app.cf;
};
