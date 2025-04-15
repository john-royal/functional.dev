import { z } from "zod";
import { register } from "./registry";
import type { BaseResource } from "./base";

export const WorkerOptions = z.object({
  name: z.string(),
  entry: z.string(),
});
export type WorkerOptions = z.infer<typeof WorkerOptions>;

export class Worker implements BaseResource {
  readonly kind = "worker";

  constructor(readonly options: WorkerOptions) {
    WorkerOptions.parse(this.options);
    register(this);
  }
}
