import { defineResource, type Resource } from "../resource";
import { cfFetch, requireCloudflareAccountId } from "./api";
import type { WorkersBindingKindKVNamespace } from "./binding";
export interface KVNamespaceOptions {
  title?: string;
}

export interface KVNamespaceState {
  id: string;
  title: string;
  beta: boolean;
  supports_url_encoding: boolean;
}

export const KVNamespace = defineResource({
  kind: "kv-namespace",
  create: async ({ self, options }) => {
    const accountId = await requireCloudflareAccountId();
    const response = await cfFetch<KVNamespaceState>(
      `/accounts/${accountId}/storage/kv/namespaces`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: options.title ?? self.globalId,
        }),
      }
    );
    return response;
  },
  sync: async ({ self, options, state }) => {
    if (!state) {
      throw new Error(
        `[functional] Cannot sync KVNamespace "${self.globalId}" because the ID is unknown`
      );
    }
    const accountId = await requireCloudflareAccountId();
    const response = await cfFetch<KVNamespaceState>(
      `/accounts/${accountId}/storage/kv/namespaces/${state.id}`,
      {
        method: "GET",
      }
    );
    return response;
  },
  delete: async ({ state }) => {
    const accountId = await requireCloudflareAccountId();
    await cfFetch(`/accounts/${accountId}/storage/kv/namespaces/${state.id}`, {
      method: "DELETE",
    });
  },
  binding: ({ bindingNameOverride, self, state }) => ({
    name: bindingNameOverride ?? self.name,
    type: "kv_namespace",
    namespace_id: state.id,
  }),
} satisfies Resource<"kv-namespace", KVNamespaceOptions, KVNamespaceState, WorkersBindingKindKVNamespace>);
