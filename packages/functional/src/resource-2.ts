import { okAsync, ok, err, Result, ResultAsync } from "neverthrow";
import { $app, $store } from "./app";
import assert from "node:assert";

export class Resource<
  TInput extends Record<string, unknown>,
  TOutput,
  TError = Error,
> {
  readonly id: string;
  readonly state: Resource.StateProvider<TInput, TOutput>;
  readonly input: TInput;
  private result = new DetachedResultAsync<TOutput | null, TError>();

  constructor(
    readonly provider: Resource.Provider<TInput, TOutput, TError>,
    readonly name: string,
    input: TInput | ((id: string) => TInput)
  ) {
    this.id = `${$app.name}:${$app.stage}:${name}`;
    this.state = new Resource.StateProvider<TInput, TOutput>(
      this.id,
      this.provider.hydrate
    );
    this.input = typeof input === "function" ? input(this.id) : input;
    $app.register(this);
  }

  get output(): ResultAsync<TOutput | null, TError> {
    return this.result;
  }

  prepare(
    phase: "up" | "down"
  ): ResultAsync<Resource.Action<TError> | null, TError> {
    if (this.result.status !== "pending") {
      this.result = new DetachedResultAsync<TOutput | null, TError>();
    }
    return this.#prepare(phase)
      .map((action) => {
        if (!action) {
          this.result.resolve(null);
          return null;
        }
        return {
          action: action.action,
          handler: () =>
            action
              .handler()
              .map(() => {
                this.result.resolve(this.state.get()?.output ?? null);
              })
              .mapErr((error) => {
                this.result.reject(error);
                return error;
              }),
        };
      })
      .mapErr((error) => {
        this.result.reject(error);
        return error;
      });
  }

  #prepare(
    phase: "up" | "down"
  ): ResultAsync<Resource.Action<TError> | null, TError> {
    const state = this.state.get();
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
      .map(({ resourceId, output }) => {
        return { resourceId, input, output };
      })
      .map((state) => this.state.set(state));
  }

  private replace(state: Resource.State<TInput, TOutput>, input: TInput) {
    return this.delete(state).andThen(() => this.create(input));
  }

  private update(state: Resource.State<TInput, TOutput>, input: TInput) {
    assert(this.provider.update, "update is not implemented");
    return this.provider
      .update(input, state)
      .map((output) => ({
        resourceId: state.resourceId,
        input,
        output,
      }))
      .map((state) => this.state.set(state));
  }

  private delete(state: Resource.State<TInput, TOutput>) {
    return this.provider.delete(state).map(() => this.state.delete());
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

export namespace Resource {
  export type Diff = "update" | "replace" | "noop";

  export interface Action<TError> {
    action: "create" | "update" | "replace" | "delete";
    handler: () => ResultAsync<void, TError>;
  }

  export interface State<TInput, TOutput> {
    resourceId: string;
    input: TInput;
    output: TOutput;
  }

  export interface Provider<TInput, TOutput, TError = Error> {
    create: (
      input: TInput
    ) => ResultAsync<{ resourceId: string; output: TOutput }, TError>;
    read?: (resourceId: string) => ResultAsync<TOutput, TError>;
    diff: (
      state: State<TInput, TOutput>,
      input: TInput
    ) => ResultAsync<Diff, TError>;
    update?: (
      input: TInput,
      state: State<TInput, TOutput>
    ) => ResultAsync<TOutput, TError>;
    delete: (context: State<TInput, TOutput>) => ResultAsync<void, TError>;
    hydrate?: (state: State<TInput, TOutput>) => State<TInput, TOutput>;
  }

  export class StateProvider<TInput, TOutput> {
    readonly key: string;

    constructor(
      readonly id: string,
      readonly hydrate?: (
        state: State<TInput, TOutput>
      ) => State<TInput, TOutput>
    ) {
      this.key = `state:${this.id}`;
    }

    get() {
      const state = $store.get<State<TInput, TOutput>>(this.key);
      if (state && this.hydrate) {
        return this.hydrate(state);
      }
      return state;
    }

    set(state: State<TInput, TOutput>) {
      return $store.set(this.key, state);
    }

    delete() {
      return $store.delete(this.key);
    }
  }
}
