import { AsyncLocalStorage } from "node:async_hooks";
import { serde } from "../lib/serde";
import type { IContext, ResourceType, Result } from "./resource";

const state: Record<
  string,
  {
    input: unknown;
    output: unknown;
  }
> = {};

const stateFile = Bun.file("state.json");
if (await stateFile.exists()) {
  Object.assign(state, await serde.parse(await stateFile.text()));
} else {
  await stateFile.write(serde.stringify(state));
}

export class Context {
  constructor(readonly phase: "up" | "down") {}

  use<I, O>(
    id: string,
    resource: ResourceType<string, I, O>,
    input: I,
  ): Promise<{
    type: "create" | "update" | "none";
    output: O;
  }> {
    throw new Error("Not implemented");
  }
  result(id: string, result: Result<unknown>) {
    throw new Error("Not implemented");
  }

  scope<I>(id: string, input: I): Scope {
    return new Scope(id, this, input);
  }

  static get() {
    const store = storage.getStore();
    if (!store) {
      throw new Error("No context");
    }
    return store;
  }
}

const storage = new AsyncLocalStorage<Context>();

export class Scope implements IContext<unknown, unknown> {
  constructor(
    readonly id: string,
    readonly context: Context,
    readonly input: unknown,
  ) {}

  get phase() {
    if (this.context.phase === "up") {
      return this.output ? "update" : "create";
    }
    return "delete";
  }

  get output() {
    return state[this.id]?.output;
  }

  use<I, O>(
    resource: ResourceType<string, I, O>,
    input: I,
  ): Promise<{
    type: "create" | "update" | "none";
    output: O;
  }> {
    return this.context.use(this.id, resource, input);
  }
  result(result: Result<unknown>) {
    return this.context.result(this.id, result);
  }
}
