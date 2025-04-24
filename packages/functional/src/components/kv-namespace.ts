import { okAsync } from "neverthrow";
import { z } from "zod";
import { $cf } from "../app";
import type { ResourceProvider } from "../resource";
import { Component } from "../resource";
import type { MakeOptional } from "../lib/utils";

export const KVNamespaceState = z.object({
  id: z.string(),
  title: z.string(),
  beta: z.boolean(),
  supports_url_encoding: z.boolean(),
});
export type KVNamespaceState = z.infer<typeof KVNamespaceState>;

const KVNamespaceProps = z.object({
  title: z.string(),
});
type KVNamespaceProps = z.infer<typeof KVNamespaceProps>;

export const provider = {
  create: (props) => {
    return $cf
      .fetchWithAccount({
        method: "POST",
        path: "/storage/kv/namespaces",
        body: {
          format: "json",
          data: props,
        },
        responseSchema: KVNamespaceState,
      })
      .map((state) => ({
        id: state.id,
        state,
      }));
  },
  diff: (props, current) => {
    return okAsync({
      action: Bun.deepEquals(props, current.props) ? "noop" : "replace",
    });
  },
  read: (id) => {
    return $cf.fetchWithAccount({
      method: "GET",
      path: `/storage/kv/namespaces/${id}`,
      responseSchema: KVNamespaceState,
    });
  },
  delete: ({ state }) => {
    return $cf.fetchWithAccount({
      method: "DELETE",
      path: `/storage/kv/namespaces/${state.id}`,
      responseSchema: z.any(),
    });
  },
} satisfies ResourceProvider<KVNamespaceProps, KVNamespaceState>;

export class KVNamespace extends Component<KVNamespaceProps, KVNamespaceState> {
  constructor(
    name: string,
    props: MakeOptional<KVNamespaceProps, "title"> = {}
  ) {
    super(provider, name, (id) => ({
      title: props.title ?? id,
      ...props,
    }));
  }
}
