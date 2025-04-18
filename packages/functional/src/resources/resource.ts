import {
  kFunctionalCreateBinding,
  type WorkersBindingKind,
} from "./cloudflare/binding";
import { $functional, type FunctionalScope } from "./util";

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

export interface SyncResourceContext<TOptions, TState> {
  self: FunctionalScope;
  options: TOptions;
  state?: TState;
}

export interface Resource<
  TKind extends string,
  TOptions,
  TState,
  TBinding extends WorkersBindingKind | undefined = undefined
> {
  kind: TKind;
  sync?: (ctx: SyncResourceContext<TOptions, TState>) => Promise<TState>;
  create?: (ctx: CreateResourceContext<TOptions>) => Promise<TState>;
  update?: (ctx: ActiveResourceContext<TOptions, TState>) => Promise<TState>;
  delete?: (ctx: ActiveResourceContext<TOptions, TState>) => Promise<void>;
  dev?: (ctx: ActiveResourceContext<TOptions, TState>) => Promise<{
    fetch?: (request: Request) => Promise<Response>;
    reload?: () => Promise<void>;
    stop?: () => Promise<void>;
  }>;
  types?: (ctx: CreateResourceContext<TOptions>) => Promise<void>;
  binding?: (ctx: CreateBindingContext<TOptions, TState>) => TBinding;
}

export type ResourceOutput<
  TKind extends string,
  TOptions,
  TState,
  TBinding extends WorkersBindingKind | undefined
> = {
  resource: Resource<TKind, TOptions, TState, TBinding>;
  scope: FunctionalScope;
  options: TOptions;
  binding: (name?: string) => {
    [kFunctionalCreateBinding]: (name?: string) => TBinding;
  };
  [kFunctionalCreateBinding]: (name?: string) => TBinding;
};

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
    return {
      resource,
      options,
      get scope() {
        return $functional.scope({
          name,
          kind: resource.kind,
        });
      },
      [kFunctionalCreateBinding]() {
        if (!resource.binding) {
          throw new Error(
            `Resource "${this.scope.name}" (${resource.kind}) is not bindable`
          );
        }
        throw new Error(
          `Internal error: Resource "${this.scope.name}" (${resource.kind}) is bindable but the [kFunctionalCreateBinding] property is not set`
        );
      },
      binding(name?: string) {
        return {
          [kFunctionalCreateBinding]: () =>
            this[kFunctionalCreateBinding](name),
        };
      },
    };
  };
}
