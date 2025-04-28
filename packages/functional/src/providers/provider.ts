import type { Result } from "neverthrow";

import type { ResultAsync } from "neverthrow";
import type z from "zod";

export interface ResourceState<TInput, TOutput> {
  input: TInput;
  output: TOutput;
}

export interface ResourceProvider<TInput, TOutput, TError extends Error> {
  validate?: (input: TInput) => Result<TInput, z.ZodError>;
  create: (input: TInput) => ResultAsync<TOutput, TError>;
  diff: (
    state: ResourceState<TInput, TOutput>,
    input: TInput
  ) => ResultAsync<{ action: "noop" | "replace" | "update" }, TError>;
  update?: (
    state: ResourceState<TInput, TOutput>,
    input: TInput
  ) => ResultAsync<TOutput, TError>;
  delete?: (state: ResourceState<TInput, TOutput>) => ResultAsync<void, TError>;
}
