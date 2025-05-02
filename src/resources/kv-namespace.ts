import {
  type CloudflareResponse,
  cloudflareApi,
} from "../providers/cloudflare";
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
    const res = await cloudflareApi.post(
      `/accounts/${cloudflareApi.accountId}/storage/kv/namespaces`,
      {
        body: {
          type: "json",
          value: {
            title: input.title,
          },
        },
      },
    );
    const json = await res.json<CloudflareResponse<KvNamespaceOutput>>();
    if (!res.ok || !json.success) {
      throw new Error(json.errors[0]?.message ?? "Unknown error");
    }
    return json.result;
  }

  private async deleteKvNamespace(id: string) {
    const res = await cloudflareApi.delete(
      `/accounts/${cloudflareApi.accountId}/storage/kv/namespaces/${id}`,
    );
    const json = await res.json<CloudflareResponse<never>>();
    if (!res.ok || !json.success) {
      throw new Error(json.errors[0]?.message ?? "Unknown error");
    }
  }
}
