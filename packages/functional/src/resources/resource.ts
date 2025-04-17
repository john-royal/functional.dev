import type { WorkersBindingKind } from "./cloudflare/binding";
import type { FunctionalScope } from "./util";

export interface CreateResourceContext<TOptions> {
  self: FunctionalScope;
  options: TOptions;
}

export interface CreateBindingContext<TOptions, TState> {
  bindingNameOverride?: string;
  self: FunctionalScope;
  options: TOptions;
  state: TState;
}

export interface ActiveResourceContext<TOptions, TState> {
  self: FunctionalScope;
  options: TOptions;
  state: TState;
}

export interface Resource<
  TKind extends string,
  TOptions,
  TState,
  TBinding extends WorkersBindingKind | undefined = undefined
> {
  kind: TKind;
  create?: (ctx: CreateResourceContext<TOptions>) => Promise<TState>;
  update?: (ctx: ActiveResourceContext<TOptions, TState>) => Promise<TState>;
  delete?: (ctx: ActiveResourceContext<TOptions, TState>) => Promise<void>;
  dev?: (ctx: ActiveResourceContext<TOptions, TState>) => Promise<{
    fetch?: (request: Request) => Promise<Response>;
    reload?: () => Promise<void>;
    stop?: () => Promise<void>;
  }>;
  binding?: (ctx: CreateBindingContext<TOptions, TState>) => TBinding;
}

export type ResourceOutput<
  TKind extends string,
  TOptions,
  TState,
  TBinding extends WorkersBindingKind | undefined
> = any;

export function defineResource<
  TKind extends string,
  TOptions,
  TState,
  TBinding extends WorkersBindingKind | undefined
>(resource: Resource<TKind, TOptions, TState, TBinding>) {
  return (
    name: string,
    options: TOptions
  ): ResourceOutput<TKind, TOptions, TState, TBinding> => {
    return resource;
  };
}
