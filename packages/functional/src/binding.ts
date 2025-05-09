import type { WorkersBindingInput } from "./cloudflare/worker/types";
import type { MaybePromise } from "./lib/types";

export interface Bindable {
  getBinding(): MaybePromise<WorkersBindingInput>;
}
