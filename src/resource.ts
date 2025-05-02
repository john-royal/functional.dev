import { Context } from "./context";
import type { MaybePromise } from "./lib/types";

export abstract class Resource<TKind extends string, TInput, TOutput> {
  abstract readonly kind: TKind;
  private readonly dynamicResources = new Map<
    string,
    Resource<string, unknown, unknown>
  >();
  dependencies: string[] = [];

  constructor(
    readonly name: string,
    readonly input: TInput,
    metadata?: { dependencies: string[] },
    readonly context = Context.get(),
  ) {
    this.dependencies = metadata?.dependencies ?? [];
    this.context.register(this);
  }

  abstract run(
    context: Resource.Context<TInput, TOutput>,
  ): MaybePromise<Resource.Action<TOutput>>;

  use<T extends string, I, O>(
    resource: Resource<T, I, O>,
  ): Promise<Resource.State<I, O>> {
    return this.context.waitFor(resource);
  }
}

export interface ResourceProperties {
  kind: string;
  name: string;
  input: unknown;
  dependencies: string[];
}

export class ResourceStub extends Resource<string, unknown, unknown> {
  readonly kind: string;
  constructor(properties: ResourceProperties) {
    super(
      properties.name,
      properties.input,
      {
        dependencies: properties.dependencies,
      },
      {
        register: () => {},
      } as unknown as Context,
    );
    this.kind = properties.kind;
  }

  run(): Resource.Action<unknown> {
    throw new Error("Not implemented");
  }
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
