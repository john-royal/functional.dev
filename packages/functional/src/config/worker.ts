import type { BaseResource } from "./base";
import type { Binding } from "./binding";
import { register } from "./registry";

interface WorkerOptions {
  name: string;
  entry: string;
  bindings?: Binding[];
}

export class Worker implements BaseResource<WorkerOptions> {
  readonly kind = "worker";

  constructor(readonly options: WorkerOptions) {
    register(this);
  }
}
