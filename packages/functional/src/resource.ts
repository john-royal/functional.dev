import { err, ok, okAsync, type ResultAsync } from "neverthrow";
import { $app, $store } from "./app";
import { InternalError } from "./lib/error";

export interface ResourceProvider<TProps, TState, TError = Error> {
  create: (props: TProps) => ResultAsync<{ id: string; state: TState }, TError>;
  read?: (id: string) => ResultAsync<TState, TError>;
  diff: (
    props: TProps,
    current: {
      props: TProps;
      state: TState;
    }
  ) => ResultAsync<{ action: "update" | "replace" | "noop" }, TError>;
  update?: (state: TState, props: TProps) => ResultAsync<TState, TError>;
  delete: (ctx: { props: TProps; state: TState }) => ResultAsync<void, TError>;
  hydrate?: (state: TState) => TState;
}

export interface ComponentAction<TError> {
  action: "create" | "update" | "replace" | "delete";
  handler: () => ResultAsync<void, TError>;
  dependencies?: string[];
}

export type AnyComponent = Component<any, any, any>;

export class Component<TProps extends object, TState, TError = Error> {
  readonly id: string;
  readonly props: TProps;

  constructor(
    readonly provider: ResourceProvider<TProps, TState, TError>,
    readonly name: string,
    props: TProps | ((id: string) => TProps)
  ) {
    this.id = `${$app.name}:${$app.stage}:${name}`;
    this.props = typeof props === "function" ? props(this.id) : props;
    $app.register(this);
  }

  prepare(
    phase: "up" | "down"
  ): ResultAsync<ComponentAction<TError> | null, TError | InternalError> {
    const key = `state:${this.id}`;
    const current = $store.get<{
      id: string;
      props: TProps;
      state: TState;
    }>(key);

    switch (phase) {
      case "up": {
        if (!current) {
          return okAsync({
            action: "create",
            handler: () =>
              this.provider.create(this.props).map((result) =>
                $store.set(key, {
                  id: result.id,
                  props: this.props,
                  state: result.state,
                })
              ),
          });
        }
        return this.provider
          .diff(current.props, current)
          .andThen(({ action }) => {
            switch (action) {
              case "update": {
                const update = this.provider.update;
                if (!update) {
                  return err(new InternalError("update is not supported"));
                }
                return ok({
                  action: "update",
                  handler: () =>
                    update(current.state, this.props).map((state) =>
                      $store.set(key, {
                        id: current.id,
                        props: this.props,
                        state,
                      })
                    ),
                } satisfies ComponentAction<TError>);
              }
              case "replace": {
                return ok({
                  action: "replace",
                  handler: () =>
                    this.provider
                      .delete(current)
                      .map(() => $store.delete(key))
                      .andThen(() =>
                        this.provider.create(this.props).map((result) =>
                          $store.set(key, {
                            id: result.id,
                            props: this.props,
                            state: result.state,
                          })
                        )
                      ),
                } satisfies ComponentAction<TError>);
              }
              case "noop": {
                return ok(null);
              }
            }
          });
      }
      case "down": {
        if (!current) {
          return okAsync(null);
        }
        return okAsync({
          action: "delete",
          handler: () =>
            this.provider.delete(current).map(() => $store.delete(key)),
        });
      }
    }
  }
}
