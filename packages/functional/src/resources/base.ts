import { $app } from "../context";

type Cleanup = () => Promise<void>;

export interface IResource {
  kind: string;
  id: string;
  options?: any;
  state?: any;
}

export abstract class Resource<T extends IResource> {
  abstract get kind(): T["kind"];

  constructor(readonly id: T["id"], readonly options: T["options"]) {}

  get name() {
    return [$app.name, $app.environment, this.id].join("-");
  }

  abstract create(): Promise<T["state"]>;
  abstract update(): Promise<T["state"]>;
  abstract delete(): Promise<T["state"]>;
}
