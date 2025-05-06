import * as v from "valibot";
import { $cloudflare } from "~/core/app";
import { Resource } from "~/core/resource";

export const KVNamespaceInput = v.object({
  title: v.string(),
});
export type KVNamespaceInput = v.InferOutput<typeof KVNamespaceInput>;

export const KVNamespaceOutput = v.object({
  id: v.string(),
  title: v.string(),
  beta: v.boolean(),
  supports_url_encoding: v.boolean(),
});
export type KVNamespaceOutput = v.InferOutput<typeof KVNamespaceOutput>;

export type KVNamespaceProperties = Resource.CRUDProperties<
  KVNamespaceInput,
  KVNamespaceOutput,
  string
>;

export default class KVNamespace extends Resource<KVNamespaceProperties> {
  readonly kind = "cloudflare:kv-namespace";

  static get provider(): Resource.Provider<KVNamespaceProperties> {
    return {
      create: async (input) => {
        const res = await $cloudflare.post(
          `/accounts/${$cloudflare.accountId}/storage/kv/namespaces`,
          {
            body: {
              type: "json",
              value: {
                title: input.title,
              },
            },
            responseSchema: KVNamespaceOutput,
          },
        );
        return {
          providerId: res.id,
          output: res,
        };
      },
      diff: async (input, state) => {
        if (!Bun.deepEquals(state.input, input)) {
          return "replace";
        }
        return "none";
      },
      delete: async (state) => {
        await $cloudflare.delete(
          `/accounts/${$cloudflare.accountId}/storage/kv/namespaces/${state.providerId}`,
        );
      },
    };
  }

  constructor(
    name: string,
    input: KVNamespaceInput,
    metadata?: Resource.Metadata,
  ) {
    super(KVNamespace.provider, name, input, metadata);
  }
}
