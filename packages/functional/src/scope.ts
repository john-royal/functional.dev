import type { CFClient } from "./cloudflare/client";
import type { Store } from "./lib/store";
import type { ResourceState } from "./providers/provider";

export class Scope {
  constructor(
    readonly namespace: string,
    readonly store: Store,
    readonly client: CFClient
  ) {}

  extend(id: string) {
    return new Scope(`${this.namespace}:${id}`, this.store, this.client);
  }

  getState<TInput, TOutput>() {
    return this.store.get<{ input: TInput; output: TOutput }>(this.namespace);
  }

  setState<TInput, TOutput>(state: ResourceState<TInput, TOutput>) {
    return this.store.set(this.namespace, state);
  }

  deleteState() {
    return this.store.delete(this.namespace);
  }
}
