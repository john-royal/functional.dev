import z from "zod";
import { cloudflareApi } from "../providers/cloudflare";
import { Resource } from "../resource";

interface KvNamespaceInput {
  title: string;
}

interface KvNamespaceOutput {
  id: string;
  title: string;
  beta: boolean;
  supports_url_encoding: boolean;
}

export default class KVNamespace extends Resource<
  string,
  KvNamespaceInput,
  KvNamespaceOutput
> {
  readonly kind = "kv-namespace";

  run(
    context: Resource.Context<KvNamespaceInput, KvNamespaceOutput>,
  ): Resource.Action<KvNamespaceOutput> {
    switch (context.status) {
      case "create": {
        return {
          status: "create",
          apply: () => this.createKvNamespace(this.input),
        };
      }
      case "update": {
        if (this.input.title !== context.output.title) {
          return {
            status: "replace",
          };
        }
        return {
          status: "none",
        };
      }
      case "delete": {
        return {
          status: "delete",
          apply: () => this.deleteKvNamespace(context.output.id),
        };
      }
    }
  }

  private async createKvNamespace(input: KvNamespaceInput) {
    return await cloudflareApi.post(
      `/accounts/${cloudflareApi.accountId}/storage/kv/namespaces`,
      {
        body: {
          type: "json",
          value: {
            title: input.title,
          },
        },
        responseSchema: z.object({
          id: z.string(),
          title: z.string(),
          beta: z.boolean(),
          supports_url_encoding: z.boolean(),
        }),
      },
    );
  }

  private async deleteKvNamespace(id: string) {
    await cloudflareApi.delete(
      `/accounts/${cloudflareApi.accountId}/storage/kv/namespaces/${id}`,
      {
        responseSchema: z.any(),
      },
    );
  }
}
