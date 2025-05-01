import { type CloudflareResponse, cloudflareApi } from "./api";
import { Resource } from "./resource";

interface KvNamespaceInput {
  title: string;
}

interface KvNamespaceOutput {
  id: string;
  title: string;
  beta: boolean;
  supports_url_encoding: boolean;
}

export const KVNamespace = Resource<
  "kv-namespace",
  KvNamespaceInput,
  KvNamespaceOutput
>("kv-namespace", async (ctx) => {
  switch (ctx.phase) {
    case "create": {
      return ctx.result("create", () => createKvNamespace(ctx.input));
    }
    case "update": {
      if (ctx.input.title !== ctx.output.title) {
        return ctx.result("replace");
      }
      return ctx.result("none");
    }
    case "delete": {
      return ctx.result("delete", () => deleteKvNamespace(ctx.output.id));
    }
  }
});

const createKvNamespace = async (input: KvNamespaceInput) => {
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
};

const deleteKvNamespace = async (id: string) => {
  const res = await cloudflareApi.delete(
    `/accounts/${cloudflareApi.accountId}/storage/kv/namespaces/${id}`,
  );
  const json = await res.json<CloudflareResponse<never>>();
  if (!res.ok || !json.success) {
    throw new Error(json.errors[0]?.message ?? "Unknown error");
  }
};
