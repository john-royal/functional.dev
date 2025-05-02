import { Context } from "./context";

interface OutputResult<TOutput> {
  type: "create" | "update";
  apply: () => Promise<TOutput>;
}

interface NoneResult {
  type: "none" | "replace";
}

interface DeleteResult {
  type: "delete";
  apply?: () => Promise<void>;
}

export type Result<TOutput> = OutputResult<TOutput> | NoneResult | DeleteResult;

export interface BaseContext {
  use<I, O>(
    resource: ResourceType<I, O>,
    input: I,
  ): Promise<{
    type: "create" | "update" | "none";
    output: O;
  }>;
}

export interface CreateContext<TInput> extends BaseContext {
  phase: "create";
  input: TInput;
  output: undefined;
}

export interface UpdateContext<TInput, TOutput> extends BaseContext {
  phase: "update";
  input: TInput;
  output: TOutput;
}

export interface DeleteContext<TInput, TOutput> extends BaseContext {
  phase: "delete";
  input: TInput;
  output: TOutput;
}

export interface IContext<TInput, TOutput> extends BaseContext {
  phase: "create" | "update" | "delete";
  input: TInput;
  output?: TOutput;
}

type AnyContext<TInput, TOutput> =
  | CreateContext<TInput>
  | UpdateContext<TInput, TOutput>
  | DeleteContext<TInput, TOutput>;

export interface ResourceType<TName extends string, TInput, TOutput> {
  name: TName;
  (id: string, input: TInput): Promise<Result<TOutput>>;
}

export function Resource<TName extends string, TInput, TOutput>(
  name: TName,
  handler: (ctx: AnyContext<TInput, TOutput>) => Promise<Result<TOutput>>,
): ResourceType<TName, TInput, TOutput> {
  const resource = (id: string, input: TInput) => {
    const context = Context.get();
    return handler(context.scope(id, input) as AnyContext<TInput, TOutput>);
  };
  resource.name = name;
  return resource;
}
