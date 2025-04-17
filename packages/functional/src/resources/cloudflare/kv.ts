import { Resource, type IResource } from "../base";
import { cfFetch, requireCloudflareAccountId } from "./api";

export interface IKVNamespace extends IResource {
  kind: "kv-namespace";
  state: {
    id: string;
    title: string;
    supports_url_encoding: boolean;
    beta: boolean;
  };
  binding: {
    name: string;
    id: string;
  };
}

export class KVNamespace extends Resource<IKVNamespace> {
  readonly kind = "kv-namespace";

  constructor(id: string) {
    super(id, {});
  }

  binding(name?: string): IResource["binding"] {
    return {
      name: name ?? this.name,
      id: this.id,
    };
  }

  static async list() {
    const accountId = await requireCloudflareAccountId();
    const response = await cfFetch<IKVNamespace["state"][]>(
      `/accounts/${accountId}/storage/kv/namespaces`
    );
    return response;
  }

  async create() {
    const accountId = await requireCloudflareAccountId();
    const response = await cfFetch<IKVNamespace["state"]>(
      `/accounts/${accountId}/storage/kv/namespaces`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: this.name,
        }),
      }
    );
    return response;
  }

  update(state: IKVNamespace["state"]) {
    return Promise.resolve(state);
  }

  async delete(state: IKVNamespace["state"]) {
    const accountId = await requireCloudflareAccountId();
    const res = await cfFetch(
      `/accounts/${accountId}/storage/kv/namespaces/${state.id}`,
      {
        method: "DELETE",
      }
    );
    console.log(res);
  }
}
