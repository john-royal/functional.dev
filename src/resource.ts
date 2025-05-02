import { Context } from "./context";
import { DetachedPromise } from "./lib/detached-promise";
import type { MaybePromise } from "./lib/types";

export abstract class Resource<TKind extends string, TInput, TOutput> {
  abstract readonly kind: TKind;
  private readonly dynamicResources = new Map<
    string,
    Resource<string, unknown, unknown>
  >();

  constructor(
    readonly name: string,
    readonly input: TInput,
    readonly context = Context.get(),
  ) {
    this.context.register(this);
  }

  abstract run(
    context: Resource.Context<TInput, TOutput>,
  ): MaybePromise<Resource.Action<TOutput>>;

  use<T extends string, I, O>(
    Resource: {
      new (name: string, input: I): Resource<T, I, O>;
    },
    name: string,
    input: I,
  ): Promise<Resource.State<I, O>> {
    const existing = this.dynamicResources.get(name);
    if (existing) {
      return this.context.waitFor(existing as Resource<T, I, O>);
    }
    const resource = new Resource(`${this.name}.${name}`, input);
    this.dynamicResources.set(name, resource);
    return this.context.waitFor(resource);
  }
}

export class ResourceHandle<TInput, TOutput> {
  action = new DetachedPromise<Resource.Action<TOutput>[]>();
  state = new DetachedPromise<Resource.State<TInput, TOutput>>();
}

export namespace Resource {
  export interface CreateAction<T> {
    status: "create";
    apply: () => Promise<T>;
  }

  export interface UpdateAction<T> {
    status: "update";
    apply: () => Promise<T>;
  }

  export interface ReplaceAction<T> {
    status: "replace";
    apply?: () => Promise<T>;
  }

  export interface DeleteAction {
    status: "delete";
    apply?: () => Promise<void>;
  }

  export interface NoneAction {
    status: "none";
  }

  export type Action<T> =
    | CreateAction<T>
    | UpdateAction<T>
    | ReplaceAction<T>
    | DeleteAction
    | NoneAction;

  export interface CreateContext {
    status: "create";
    input: undefined;
    output: undefined;
  }

  export interface UpdateContext<TInput, TOutput> {
    status: "update";
    input: TInput;
    output: TOutput;
  }

  export interface DeleteContext<TInput, TOutput> {
    status: "delete";
    input: TInput;
    output: TOutput;
  }

  export type Context<TInput, TOutput> =
    | CreateContext
    | UpdateContext<TInput, TOutput>
    | DeleteContext<TInput, TOutput>;

  export interface State<TInput, TOutput> {
    status: "created" | "updated" | "none";
    input: TInput;
    output: TOutput;
  }
}
