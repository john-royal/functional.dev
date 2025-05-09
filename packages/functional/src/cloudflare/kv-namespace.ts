import * as v from "valibot";
import type { Bindable } from "~/binding";
import { $cloudflare } from "~/core/app";
import { Resource } from "~/core/resource";
import type { WorkersBindingInput } from "./worker/types";
import { $run } from "~/core/lifecycle";

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

export class KVNamespace
  extends Resource<KVNamespaceProperties>
  implements Bindable
{
  readonly kind = "cloudflare:kv-namespace";

  constructor(
    name: string,
    input: KVNamespaceInput,
    metadata?: Resource.Metadata,
  ) {
    super(KVNamespace.provider, name, input, metadata);
  }

  async getBinding(): Promise<WorkersBindingInput> {
    const output = await $run.use(this);
    return {
      type: "kv_namespace",
      namespace_id: output.id,
    };
  }

  static readonly provider: Resource.Provider<KVNamespaceProperties> = {
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
