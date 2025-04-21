import { Effect, Resource, Schedule, Schema } from "effect";

const KVNamespaceOptions = Schema.Struct({
  title: Schema.String,
});
type KVNamespaceOptions = typeof KVNamespaceOptions.Type;

const KVNamespaceState = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  beta: Schema.Boolean,
  supports_url_encoding: Schema.Boolean,
});
type KVNamespaceState = typeof KVNamespaceState.Type;

export const KVNamespace = (options: KVNamespaceOptions) =>
  Effect.gen(function* () {});
