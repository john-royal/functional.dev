import { Store } from "../lib/store";
import path from "path";

interface FunctionalOptions {
  app: {
    name: string;
    environment: string;
  };
  root?: string;
}

export class FunctionalScope {
  globalId: string;
  output: string;

  constructor(
    readonly name: string,
    kind: string,
    private readonly parent: Functional
  ) {
    this.globalId = [parent.app.name, parent.app.environment, kind, name].join(
      ":"
    );
    this.output = path.join(parent.output, `${kind}-${name}`);
  }

  resolvePath(...paths: string[]) {
    return path.join(this.parent.root, ...paths);
  }

  resolveOutputPath(...paths: string[]) {
    return path.join(this.output, ...paths);
  }
}

export class Functional {
  app: {
    name: string;
    environment: string;
  };
  output: string;
  store: Store;
  root: string;

  constructor(options: FunctionalOptions) {
    this.app = options.app;
    this.root = options.root ?? process.cwd();
    this.output = path.join(this.root, ".functional");
    this.store = new Store(path.join(this.output, "store.json"));
  }

  scope(resource: { name: string; kind: string }): FunctionalScope {
    return new FunctionalScope(resource.name, resource.kind, this);
  }
}

declare global {
  var functional: Functional;
}

export async function configureFunctional(options: FunctionalOptions) {
  if (globalThis.functional) {
    throw new Error("Functional is already configured");
  }
  globalThis.functional = new Functional(options);
  await globalThis.functional.store.load();
}

export const $functional = new Proxy({} as Functional, {
  get: (_, prop: keyof Functional) => {
    if (!globalThis.functional) {
      throw new Error("Functional is not configured");
    }
    return globalThis.functional[prop];
  },
});
