import { errAsync, type ResultAsync } from "neverthrow";
import { z } from "zod";
import { useApp, useStore } from "./app";

export type ComponentAction = "create" | "update" | "replace" | "delete";
export type AnyComponent = Component<string, any, any, any>;

export abstract class Component<
  TKind extends string,
  TOutput,
  TInput,
  TRawInput = TInput,
> {
  abstract readonly kind: TKind;

  readonly id: string;
  readonly input: TInput;

  state: {
    kind: TKind;
    input: TInput;
    output: TOutput;
  } | null;

  constructor(id: string, props: TRawInput) {
    const app = useApp();

    this.id = `${app.name}:${app.stage}:${id}`;
    this.input = this.normalizeInput(id, props);
    this.state = this.loadState();

    app.register(this);
  }

  private loadState() {
    const state = useStore().get<{
      kind: TKind;
      input: TInput;
      output: TOutput;
    }>(this.id);
    console.log({
      id: this.id,
      state,
    });
    if (state) {
      if (state.kind !== this.kind) {
        throw new Error(`Component ${this.id} has kind ${state.kind}`);
      }
      return state;
    } else {
      return null;
    }
  }

  setState(output: TOutput | null) {
    if (output === null) {
      useStore().delete(this.id);
    } else {
      useStore().set(this.id, {
        kind: this.kind,
        input: this.input,
        output,
      });
    }
    this.loadState();
  }

  abstract normalizeInput(id: string, props: TRawInput): TInput;
  abstract plan(phase: "up" | "down"): Promise<ComponentAction | null>;
  abstract create(): ResultAsync<void, Error>;
  update(): ResultAsync<void, Error> {
    return errAsync(new Error("Not implemented"));
  }
  abstract delete(): ResultAsync<void, Error>;
}

export const CloudflareName = z
  .string()
  .transform((name) => name.toLowerCase().replace(/[^a-z0-9]/g, "-"));
