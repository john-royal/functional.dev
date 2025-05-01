import type { StandardSchemaV1 } from "./vendor/standard-schema";

export interface UnsetMarker {
  "~unset": true;
}

export interface AnyParams {
  "~kind": string;
  "~context": {
    in: any;
    out: any;
  };
  "~input": {
    schema: any;
    in: any;
    out: any;
  };
  "~output": any;
  "~hooks": {
    read: any;
    register: any;
    create: any;
    diff: any;
    update: any;
    destroy: any;
  };
}

export type CreateFunction<TContext, TInput, TOutput> = (args: {
  ctx: TContext;
  input: TInput;
}) => Promise<TOutput>;

export type ReadFunction<TContext, TOutput> = (args: {
  ctx: TContext;
  identifier: string;
}) => Promise<TOutput>;

export type DiffFunction<TContext, TInput, TOutput> = (args: {
  ctx: TContext;
  oldOutput: TOutput;
  input: TInput;
}) => Promise<Diff>;

export type UpdateFunction<TContext, TInput, TOutput> = (args: {
  ctx: TContext;
  oldOutput: TOutput;
  input: TInput;
}) => Promise<TOutput>;

export type DestroyFunction<TContext, TOutput> = (args: {
  ctx: TContext;
  output: TOutput;
}) => Promise<void>;

export type Diff = "update" | "replace" | "none";

export interface ResourceBuilder<TParams extends AnyParams> {
  validate: <TInputIn, TInputOut>(
    schema: StandardSchemaV1<TInputIn, TInputOut>
  ) => ResourceBuilder<{
    "~kind": TParams["~kind"];
    "~context": TParams["~context"];
    "~input": {
      schema: StandardSchemaV1<TInputIn, TInputOut>;
      in: TInputIn;
      out: TInputOut;
    };
    "~output": TParams["~output"];
    "~hooks": {
      read: TParams["~hooks"]["read"];
      register: TParams["~hooks"]["register"];
      create: TParams["~hooks"]["create"];
      diff: TParams["~hooks"]["diff"];
      update: TParams["~hooks"]["update"];
      destroy: TParams["~hooks"]["destroy"];
    };
  }>;
  create: <TOutput>(
    fn: CreateFunction<
      TParams["~context"]["out"],
      TParams["~input"]["out"],
      TOutput
    >
  ) => ResourceBuilder<{
    "~kind": TParams["~kind"];
    "~context": TParams["~context"];
    "~input": TParams["~input"];
    "~output": TOutput;
    "~hooks": {
      read: TParams["~hooks"]["read"];
      register: TParams["~hooks"]["register"];
      create: CreateFunction<
        TParams["~context"],
        TParams["~input"]["out"],
        TOutput
      >;
      diff: TParams["~hooks"]["diff"];
      update: TParams["~hooks"]["update"];
      destroy: TParams["~hooks"]["destroy"];
    };
  }>;

  read: (
    fn: ReadFunction<TParams["~context"]["out"], TParams["~output"]>
  ) => ResourceBuilder<{
    "~kind": TParams["~kind"];
    "~context": TParams["~context"];
    "~input": TParams["~input"];
    "~output": TParams["~output"];
    "~hooks": {
      read: ReadFunction<TParams["~context"]["out"], TParams["~output"]>;
      register: TParams["~hooks"]["register"];
      create: TParams["~hooks"]["create"];
      diff: TParams["~hooks"]["diff"];
      update: TParams["~hooks"]["update"];
      destroy: TParams["~hooks"]["destroy"];
    };
  }>;

  diff: (
    fn: DiffFunction<
      TParams["~context"]["out"],
      TParams["~input"]["out"],
      TParams["~output"]
    >
  ) => ResourceBuilder<{
    "~kind": TParams["~kind"];
    "~context": TParams["~context"];
    "~input": TParams["~input"];
    "~output": TParams["~output"];
    "~hooks": {
      read: TParams["~hooks"]["read"];
      register: TParams["~hooks"]["register"];
      create: TParams["~hooks"]["create"];
      diff: DiffFunction<
        TParams["~context"]["out"],
        TParams["~input"]["out"],
        TParams["~output"]
      >;
      update: TParams["~hooks"]["update"];
      destroy: TParams["~hooks"]["destroy"];
    };
  }>;
  update: (
    fn: UpdateFunction<
      TParams["~context"]["out"],
      TParams["~input"]["out"],
      TParams["~output"]
    >
  ) => ResourceBuilder<{
    "~kind": TParams["~kind"];
    "~context": TParams["~context"];
    "~input": TParams["~input"];
    "~output": TParams["~output"];
    "~hooks": {
      read: TParams["~hooks"]["read"];
      register: TParams["~hooks"]["register"];
      create: TParams["~hooks"]["create"];
      diff: TParams["~hooks"]["diff"];
      update: UpdateFunction<
        TParams["~context"]["out"],
        TParams["~input"]["out"],
        TParams["~output"]
      >;
      destroy: TParams["~hooks"]["destroy"];
    };
  }>;
  destroy: (
    fn: DestroyFunction<TParams["~context"]["out"], TParams["~output"]>
  ) => ResourceBuilder<{
    "~kind": TParams["~kind"];
    "~context": TParams["~context"];
    "~input": TParams["~input"];
    "~output": TParams["~output"];
    "~hooks": {
      read: TParams["~hooks"]["read"];
      register: TParams["~hooks"]["register"];
      create: TParams["~hooks"]["create"];
      diff: TParams["~hooks"]["diff"];
      update: TParams["~hooks"]["update"];
      destroy: DestroyFunction<TParams["~context"]["out"], TParams["~output"]>;
    };
  }>;
}

const internalResourceBuilder = <TParams extends AnyParams>(
  params: TParams
): ResourceBuilder<TParams> => {
  return {
    validate: (schema) => {
      return internalResourceBuilder({
        ...params,
        "~hooks": {
          ...params["~hooks"],
          validate: schema,
        },
      } as any);
    },
    read: (fn) => {
      return internalResourceBuilder({
        ...params,
        "~hooks": {
          ...params["~hooks"],
          read: fn,
        },
      } as any);
    },
    create: (fn) => {
      return internalResourceBuilder({
        ...params,
        "~hooks": {
          ...params["~hooks"],
          create: fn,
        },
      } as any);
    },
    diff: (fn) => {
      return internalResourceBuilder({
        ...params,
        "~hooks": {
          ...params["~hooks"],
          diff: fn,
        },
      } as any);
    },
    update: (fn) => {
      return internalResourceBuilder({
        ...params,
        "~hooks": {
          ...params["~hooks"],
          update: fn,
        },
      } as any);
    },
    destroy: (fn) => {
      return internalResourceBuilder({
        ...params,
        "~hooks": {
          ...params["~hooks"],
          destroy: fn,
        },
      } as any);
    },
  };
};

const unset = undefined as unknown as UnsetMarker;

const defineResource = <TContext, TKind extends string>(
  kind: TKind
): ResourceBuilder<{
  "~kind": TKind;
  "~context": {
    in: TContext;
    out: TContext;
  };
  "~input": {
    schema: UnsetMarker;
    in: UnsetMarker;
    out: UnsetMarker;
  };
  "~output": UnsetMarker;
  "~hooks": {
    read: UnsetMarker;
    register: UnsetMarker;
    create: UnsetMarker;
    diff: UnsetMarker;
    update: UnsetMarker;
    destroy: UnsetMarker;
  };
}> => {
  return internalResourceBuilder({
    "~kind": kind,
    "~context": undefined as any,
    "~input": {
      schema: unset,
      in: unset,
      out: unset,
    },
    "~output": unset,
    "~hooks": {
      read: unset,
      register: unset,
      create: unset,
      diff: unset,
      update: unset,
      destroy: unset,
    },
  });
};

export const createBuilder = <TContext>() => {
  return {
    resource: <TKind extends string>(kind: TKind) => {
      return defineResource<TContext, TKind>(kind);
    },
  };
};
