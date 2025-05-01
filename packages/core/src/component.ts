import { ok, okAsync, Result, type ResultAsync } from "neverthrow";
import type { z } from "zod";
import { validate } from "./validate";
import type { StandardSchemaV1 } from "./vendor/standard-schema";

type UnsetMarker = {
  _tag: "UnsetMarker";
};

type ComponentState<TInput, TOutput> = {
  input: TInput;
  output: TOutput;
};

type DiffResult = "create" | "replace" | "update" | "destroy";

interface ComponentBuilderOptions<TContext, TInput, TOutput, TDerivedInput> {
  validate: <TError>(
    ctx: TContext,
    input: TInput
  ) => ResultAsync<TInput, TError>;
  derive: <TError>(
    ctx: TContext,
    input: TInput
  ) => ResultAsync<TDerivedInput, TError>;
  create: <TError>(
    ctx: TContext,
    input: TInput
  ) => ResultAsync<TOutput, TError>;
  diff: <TError>(
    ctx: TContext,
    state: ComponentState<TDerivedInput, TOutput>
  ) => ResultAsync<DiffResult, TError>;
  update: <TError>(
    ctx: TContext,
    input: TDerivedInput
  ) => ResultAsync<TOutput, TError>;
  destroy: <TError>(
    ctx: TContext,
    input: TDerivedInput
  ) => ResultAsync<void, TError>;
}

export class ComponentBuilder<
  TContext = UnsetMarker,
  TInput = UnsetMarker,
  TOutput = UnsetMarker,
  TDerivedInput = UnsetMarker,
> {
  constructor(
    private readonly options: Partial<
      ComponentBuilderOptions<TContext, TInput, TOutput, TDerivedInput>
    > = {}
  ) {}

  standardValidate<T>(schema: StandardSchemaV1<T>) {
    return this.validate((_, input: T) => {
      return validate(schema, input);
    });
  }

  validate<TInput, TError>(
    handler: (ctx: TContext, input: TInput) => ResultAsync<TInput, TError>
  ) {
    if (this.options.validate) {
      throw new Error("validate already set");
    }
    return new ComponentBuilder<TContext, TInput, TOutput, TInput>({
      ...this.options,
      validate: handler,
    } as any);
  }

  derive<TDerivedInput, TError>(
    handler: (
      ctx: TContext,
      input: TInput
    ) => ResultAsync<TDerivedInput, TError>
  ) {
    if (this.options.derive) {
      throw new Error("derive already set");
    }
    return new ComponentBuilder<TContext, TInput, TOutput, TDerivedInput>({
      ...this.options,
      derive: handler,
    } as any);
  }

  create<TOutput, TError>(
    handler: (ctx: TContext, input: TInput) => ResultAsync<TOutput, TError>
  ) {
    if (this.options.create) {
      throw new Error("create already set");
    }
    return new ComponentBuilder<TContext, TInput, TOutput, TDerivedInput>({
      ...this.options,
      create: handler,
    } as any);
  }

  diff<TError>(
    handler: (
      ctx: TContext,
      state: ComponentState<TDerivedInput, TOutput>
    ) => ResultAsync<DiffResult, TError>
  ) {
    if (this.options.diff) {
      throw new Error("diff already set");
    }
    return new ComponentBuilder<TContext, TInput, TOutput, TDerivedInput>({
      ...this.options,
      diff: handler,
    } as any);
  }

  update<TError>(
    handler: (
      ctx: TContext,
      state: ComponentState<TDerivedInput, TOutput>
    ) => ResultAsync<TOutput, TError>
  ) {
    if (this.options.update) {
      throw new Error("update already set");
    }
    return new ComponentBuilder<TContext, TInput, TOutput, TDerivedInput>({
      ...this.options,
      update: handler,
    } as any);
  }

  destroy<TError>(
    handler: (
      ctx: TContext,
      state: ComponentState<TDerivedInput, TOutput>
    ) => ResultAsync<void, TError>
  ) {
    if (this.options.destroy) {
      throw new Error("destroy already set");
    }
    return new ComponentBuilder<TContext, TInput, TOutput, TDerivedInput>({
      ...this.options,
      destroy: handler,
    } as any);
  }

  build() {
    return this.options;
  }
}
