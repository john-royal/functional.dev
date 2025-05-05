import assert from "node:assert";
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import { CloudflareClient } from "~/providers/cloudflare";
import { JSONStore } from "../lib/store";
import { LifecycleHandler } from "./handle";
import type { AnyResource } from "./resource";
import type { Resource } from "./resource";

export interface AppProperties {
  name: string;
  cwd: string;
}

export class App implements AppProperties {
  name: string;
  cwd: string;
  out: string;
  cache: JSONStore;
  state: JSONStore;
  resources = new Map<string, AnyResource>();
  providers: {
    cloudflare: CloudflareClient;
  };

  constructor(properties: AppProperties) {
    this.name = properties.name;
    this.cwd = properties.cwd;
    this.out = path.join(this.cwd, ".functional");
    this.cache = new JSONStore(path.join(this.out, "cache.json"));
    this.state = new JSONStore(path.join(this.out, "state.json"));
    this.providers = {
      cloudflare: new CloudflareClient({}, this.cache),
    };
  }

  async init() {
    await Promise.all([this.cache.loadPromise, this.state.loadPromise]);
    await this.providers.cloudflare.init();
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

export const $app = new Proxy({} as App, {
  get: (_, prop: keyof App) => {
    const app = appStorage.getStore();
    assert(app, "register must be called inside an App");
    return app[prop];
  },
});

export const $cloudflare = new Proxy({} as CloudflareClient, {
  get: (_, prop: keyof CloudflareClient) => {
    return $app.providers.cloudflare[prop];
  },
});
