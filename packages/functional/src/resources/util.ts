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
    this.globalId = [
      parent.options.app.name,
      parent.options.app.environment,
      kind,
      name,
    ].join(":");
    this.output = path.join(parent.output, `${kind}-${name}`);
  }

  resolvePath(relativePath: string) {
    return path.join(this.parent.root, relativePath);
  }
}

class Functional {
  output: string;
  store: Store;
  root: string;

  constructor(readonly options: FunctionalOptions) {
    this.root = options.root ?? process.cwd();
    this.output = path.join(this.root, ".functional");
    this.store = new Store(path.join(this.output, "store.json"));
  }

  scope(resource: { name: string; kind: string }): FunctionalScope {
    return new FunctionalScope(resource.name, resource.kind, this);
  }
}

export const $functional = new Functional({
  app: {
    name: "my-functional-app",
    environment: "development",
  },
});
