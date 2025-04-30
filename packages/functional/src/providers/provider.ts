import assert from "assert";
import { err, ok, okAsync, ResultAsync, type Result } from "neverthrow";
import type z from "zod";
import type { Scope } from "../scope";

export type ResourceDiff = "update" | "replace" | "noop";

export interface ResourceAction<TError> {
  action: "create" | "update" | "replace" | "delete";
  handler: () => ResultAsync<void, TError>;
}

export interface ResourceState<TInput, TOutput> {
  input: TInput;
  output: TOutput;
}

export interface ResourceProvider<TInput, TOutput, TError extends Error> {
  validate?: (input: TInput) => Result<TInput, z.ZodError>;
  hydrate?: (
    state: ResourceState<TInput, TOutput>
  ) => ResourceState<TInput, TOutput>;
  create: (input: TInput) => ResultAsync<TOutput, TError>;
  diff: (
    state: ResourceState<TInput, TOutput>,
    input: TInput
  ) => ResultAsync<ResourceDiff, TError>;
  update?: (
    state: ResourceState<TInput, TOutput>,
    input: TInput
  ) => ResultAsync<TOutput, TError>;
  delete?: (state: ResourceState<TInput, TOutput>) => ResultAsync<void, TError>;
}

export interface Component<TError extends Error> {
  scope: Scope;
  name: string;
  prepare(
    phase: "up" | "down"
  ): ResultAsync<ResourceAction<TError> | null, TError>;
}

export class ResourceComponent<
  TInput extends Record<string, any>,
  TOutput,
  TError extends Error,
> implements Component<TError>
{
  readonly input: TInput;
  private actionResult = new DetachedResultAsync<
    ResourceAction<TError> | null,
    TError
  >();
  private outputResult = new DetachedResultAsync<TOutput | null, TError>();

  constructor(
    readonly scope: Scope,
    readonly provider: ResourceProvider<TInput, TOutput, TError>,
    readonly name: string,
    input: TInput,
    metadata?: {
      dependsOn?: string[];
    }
  ) {
    this.input = input;
    this.scope.register(this, {
      dependsOn: metadata?.dependsOn ?? [],
    });
  }

  private getState() {
    const state = this.scope.getState<TInput, TOutput>();
    console.log(state);
    if (state && this.provider.hydrate) {
      return this.provider.hydrate(state);
    }
    return state;
  }

  private setState(state: ResourceState<TInput, TOutput>) {
    return this.scope.setState(state);
  }

  private deleteState() {
    return this.scope.deleteState();
  }

  get action(): ResultAsync<ResourceAction<TError> | null, TError> {
    return this.actionResult;
  }

  get output(): ResultAsync<TOutput | null, TError> {
    return this.outputResult;
  }

  prepare(
    phase: "up" | "down"
  ): ResultAsync<ResourceAction<TError> | null, TError> {
    if (this.actionResult.status !== "pending") {
      this.actionResult = new DetachedResultAsync<
        ResourceAction<TError> | null,
        TError
      >();
    }
    if (this.outputResult.status !== "pending") {
      this.outputResult = new DetachedResultAsync<TOutput | null, TError>();
    }
    return this.#prepare(phase)
      .map((action) => {
        this.actionResult.resolve(action);
        if (!action) {
          const state = this.getState();
          if (state?.output) {
            this.outputResult.resolve(state.output);
          } else {
            this.outputResult.resolve(null);
          }
          return null;
        }
        return {
          action: action.action,
          handler: () =>
            action
              .handler()
              .map(() => {
                const state = this.getState();
                if (state?.output) {
                  this.outputResult.resolve(state.output);
                } else {
                  this.outputResult.resolve(null);
                }
              })
              .mapErr((error) => {
                this.outputResult.reject(error);
                return error;
              }),
        };
      })
      .mapErr((error) => {
        this.actionResult.reject(error);
        this.outputResult.reject(error);
        return error;
      });
  }

  #prepare(
    phase: "up" | "down"
  ): ResultAsync<ResourceAction<TError> | null, TError> {
    const state = this.getState();
    switch (phase) {
      case "up": {
        if (state) {
          return this.provider.diff(state, this.input).map((diff) => {
            switch (diff) {
              case "update": {
                return {
                  action: "update",
                  handler: () => this.update(state, this.input),
                };
              }
              case "replace": {
                return {
                  action: "replace",
                  handler: () => this.replace(state, this.input),
                };
              }
              case "noop": {
                return null;
              }
            }
          });
        }
        return okAsync({
          action: "create",
          handler: () => this.create(this.input),
        });
      }
      case "down": {
        if (!state) {
          return okAsync(null);
        }
        return okAsync({
          action: "delete",
          handler: () => this.delete(state),
        });
      }
    }
  }

  private create(input: TInput) {
    return this.provider
      .create(input)
      .map((output) => {
        return { input, output };
      })
      .map((state) => this.setState(state));
  }

  private replace(state: ResourceState<TInput, TOutput>, input: TInput) {
    return this.delete(state).andThen(() => this.create(input));
  }

  private update(state: ResourceState<TInput, TOutput>, input: TInput) {
    assert(this.provider.update, "update is not implemented");
    return this.provider
      .update(state, input)
      .map((output) => ({
        input,
        output,
      }))
      .map((state) => this.setState(state));
  }

  private delete(state: ResourceState<TInput, TOutput>) {
    if (!this.provider.delete) {
      return ResultAsync.fromSafePromise(this.deleteState());
    }
    return this.provider.delete(state).map(() => this.deleteState());
  }
}

class DetachedResultAsync<T, E> extends ResultAsync<T, E> {
  readonly resolve: (value: T) => void;
  readonly reject: (reason: E) => void;
  status: "pending" | "fulfilled" | "rejected" = "pending";

  constructor() {
    const { resolve, reject, promise } = Promise.withResolvers<Result<T, E>>();
    super(promise);
    this.resolve = (value) => {
      resolve(ok(value));
      this.status = "fulfilled";
    };
    this.reject = (reason) => {
      reject(err(reason));
      this.status = "rejected";
    };
  }
}
