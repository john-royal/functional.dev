interface OutputResult<TOutput> {
  type: "create" | "update";
  output: TOutput;
}

interface NoneResult {
  type: "none" | "replace";
}

interface DeleteResult {
  type: "delete";
}

type Result<TOutput> = OutputResult<TOutput> | NoneResult | DeleteResult;

interface BaseContext<TOutput> {
  use<I, O>(
    resource: ResourceType<string, I, O>,
    input: I,
  ): Promise<{
    type: "create" | "update" | "none";
    output: O;
  }>;
  result(
    type: "create" | "update",
    output: () => Promise<TOutput>,
  ): OutputResult<TOutput>;
  result(type: "none" | "replace"): NoneResult;
  result(type: "delete", output?: () => Promise<void>): DeleteResult;
}

interface CreateContext<TName extends string, TInput, TOutput>
  extends BaseContext<TOutput> {
  phase: "create";
  input: TInput;
  output: undefined;
}

interface UpdateContext<TName extends string, TInput, TOutput>
  extends BaseContext<TOutput> {
  phase: "update";
  input: TInput;
  output: TOutput;
}

interface DeleteContext<TName extends string, TInput, TOutput>
  extends BaseContext<TOutput> {
  phase: "delete";
  input: TInput;
  output: TOutput;
}

type Context<TName extends string, TInput, TOutput> =
  | CreateContext<TName, TInput, TOutput>
  | UpdateContext<TName, TInput, TOutput>
  | DeleteContext<TName, TInput, TOutput>;

type ResourceType<TName extends string, TInput, TOutput> = (
  input: TInput,
) => Promise<Result<TOutput>>;

export function Resource<TName extends string, TInput, TOutput>(
  name: TName,
  handler: (ctx: Context<TName, TInput, TOutput>) => Promise<Result<TOutput>>,
): ResourceType<TName, TInput, TOutput> {
  return {} as ResourceType<TName, TInput, TOutput>;
}
