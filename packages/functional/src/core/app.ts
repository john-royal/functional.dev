import path from "node:path";
import { CloudflareClient } from "~/cloudflare/internal/client";
import {
  decrypt,
  deriveKey,
  encrypt,
  generatePassphraseMetadata,
  type Encrypted,
  type PassphraseMetadata,
} from "~/lib/encryption";
import { JSONStore } from "../lib/store";
import { deserialize, serialize } from "../lib/superjson";
import { run } from "./lifecycle";
import type { AnyResource, Resource } from "./resource";

export type Phase = "up" | "down" | "dev";

export interface AppProperties {
  name: string;
  cwd: string;
  phase: Phase;
  passphrase?: string;
}

export class App implements AppProperties {
  name: string;
  cwd: string;
  phase: Phase;
  out: string;
  passphrase?: string;
  key?: Buffer;
  auth: JSONStore;
  state: JSONStore;
  resources = new Map<string, AnyResource>();
  providers: {
    cloudflare: CloudflareClient;
  };

  constructor(properties: AppProperties) {
    this.name = properties.name;
    this.cwd = properties.cwd;
    this.phase = properties.phase;
    this.passphrase =
      properties.passphrase ?? process.env.FUNCTIONAL_PASSPHRASE;
    this.out = path.join(this.cwd, ".functional");
    this.auth = new JSONStore(path.join(this.out, "auth.json"));
    this.state = new JSONStore(path.join(this.out, "state.json"), {
      serialize,
      deserialize,
    });
    this.providers = {
      cloudflare: new CloudflareClient({}, this.auth),
    };
  }

  encrypt(value: string): Encrypted {
    if (!this.key) {
      throw new Error("No key");
    }
    return encrypt(value, this.key);
  }

  decrypt(value: Encrypted): string {
    if (!this.key) {
      throw new Error("No key");
    }
    return decrypt(value, this.key);
  }

  async init() {
    await this.auth.load();
    if (this.passphrase) {
      let metadata = await this.auth.get<PassphraseMetadata>("key");
      if (!metadata) {
        metadata = generatePassphraseMetadata();
        await this.auth.set("key", metadata);
      }
      this.key = deriveKey(this.passphrase, metadata);
    }
    await this.state.load();
    await this.providers.cloudflare.init();
  }

  path = {
    scope: (...paths: string[]) => path.join(this.out, ...paths),
    unscope: (input: string) => path.relative(this.out, input),
  };

  register<T extends Resource.Properties>(resource: Resource<T>) {
    if (this.resources.has(resource.name)) {
      throw new Error(`Resource ${resource.name} already registered`);
    }
    this.resources.set(resource.name, resource as unknown as AnyResource);
  }

  run() {
    return run(this, this.phase);
  }

  static singleton?: App;

  static async init(properties: AppProperties) {
    const app = new App(properties);
    App.singleton = app;
    await app.init();
    return app;
  }
}

export const $app = new Proxy({} as App, {
  get: (_, prop: keyof App) => {
    const app = App.singleton;
    if (!app) {
      const error = new Error("$app must be called inside an App");
      Error.captureStackTrace(error);
      throw error;
    }
    return Reflect.get(app, prop);
  },
});

export const $cloudflare = new Proxy({} as CloudflareClient, {
  get: (_, prop: keyof CloudflareClient) => {
    return $app.providers.cloudflare[prop];
  },
});
