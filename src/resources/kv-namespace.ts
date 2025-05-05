import z from "zod";
import { Resource } from "../core/resource";
import { cloudflareApi } from "../providers/cloudflare";

export const KVNamespaceInput = z.object({
  title: z.string(),
});
export type KVNamespaceInput = z.infer<typeof KVNamespaceInput>;

export const KVNamespaceOutput = z.object({
  id: z.string(),
  title: z.string(),
  beta: z.boolean(),
  supports_url_encoding: z.boolean(),
});
export type KVNamespaceOutput = z.infer<typeof KVNamespaceOutput>;

export type KVNamespaceProperties = Resource.CRUDProperties<
  string,
  KVNamespaceInput,
  KVNamespaceOutput
>;

export const kvNamespaceProvider: Resource.Provider<KVNamespaceProperties> = {
  create: async (input) => {
    const res = await cloudflareApi.post(
      `/accounts/${cloudflareApi.accountId}/storage/kv/namespaces`,
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
    await cloudflareApi.delete(
      `/accounts/${cloudflareApi.accountId}/storage/kv/namespaces/${state.providerId}`,
    );
  },
};

export class KVNamespace extends Resource<KVNamespaceProperties> {
  readonly kind = "cloudflare:kv-namespace";

  constructor(
    name: string,
    input: KVNamespaceInput,
    metadata?: Resource.Metadata,
  ) {
    super(kvNamespaceProvider, name, input, metadata);
  }
}
