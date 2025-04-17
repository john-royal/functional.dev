import { $app } from "../context";

type Cleanup = () => Promise<void>;

export interface IResource {
  kind: string;
  id: string;
  options?: any;
  state?: any;
  binding?: any;
}

export abstract class Resource<T extends IResource> {
  abstract get kind(): T["kind"];
  name: string;

  constructor(readonly id: T["id"], readonly options: T["options"]) {
    this.name = [$app.name, $app.environment, this.id].join("-");
  }

  binding(name?: string): IResource["binding"] {
    throw new Error("Not implemented");
  }

  abstract create(): Promise<T["state"]>;
  abstract update(prevState: T["state"]): Promise<T["state"]>;
  abstract delete(prevState: T["state"]): Promise<void>;
}
