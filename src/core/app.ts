import path from "node:path";
import { type IStore, JSONStore } from "../lib/store";
import type { AnyResource } from "./resource";
import { AsyncLocalStorage } from "node:async_hooks";
import assert from "node:assert";
import type { Resource } from "./resource";
import { LifecycleHandler } from "./handle";

export interface AppProperties {
  name: string;
  cwd: string;
}

export class App implements AppProperties {
  name: string;
  cwd: string;
  store: IStore;
  resources = new Map<string, AnyResource>();

  constructor(properties: AppProperties) {
    this.name = properties.name;
    this.cwd = properties.cwd;
    this.store = new JSONStore(path.join(this.cwd, "state.json"));
  }

  register<T extends Resource.Properties>(resource: Resource<T>) {
    if (this.resources.has(resource.name)) {
      throw new Error(`Resource ${resource.name} already registered`);
    }
    this.resources.set(resource.name, resource as unknown as AnyResource);
  }

  handler() {
    return new LifecycleHandler(this);
  }
}

export const appStorage = new AsyncLocalStorage<App>();

export function register<T extends Resource.Properties>(resource: Resource<T>) {
  const app = appStorage.getStore();
  assert(app, "register must be called inside an App");
  app.register(resource);
}
