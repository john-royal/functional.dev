import { Effect, Schema } from "effect";
import { cfFetch, CloudflareAccount } from "./cloudflare/fetch";
import { HttpBody } from "@effect/platform";

export const KVNamespaceProps = Schema.Struct({
  title: Schema.String,
});
export type KVNamespaceProps = typeof KVNamespaceProps.Type;

export const KVNamespaceState = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  beta: Schema.Boolean,
  supports_url_encoding: Schema.Boolean,
});
export type KVNamespaceState = typeof KVNamespaceState.Type;
export const KVNamespace = (props: KVNamespaceProps) =>
  Effect.gen(function* () {
    const account = yield* CloudflareAccount;
    const namespace = yield* cfFetch(
      "POST",
      `/accounts/${account.id}/storage/kv/namespaces`,
      KVNamespaceState,
      HttpBody.unsafeJson(props)
    );
  });
