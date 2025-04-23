import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { z } from "zod";
import { cfFetchAccount } from "../cloudflare/account";
import { Component, type ComponentAction } from "../component";

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
interface KVNamespacePropsInput {
  title?: string;
}

export class KVNamespace extends Component<
  "KVNamespace",
  KVNamespaceState,
  KVNamespaceProps,
  KVNamespacePropsInput
> {
  readonly kind = "KVNamespace";

  constructor(id: string, props: KVNamespacePropsInput = {}) {
    super(id, props);
  }

  normalizeInput(id: string, props: KVNamespacePropsInput): KVNamespaceProps {
    return KVNamespaceProps.parse({
      title: props.title ?? id,
    });
  }

  async plan(phase: "up" | "down"): Promise<ComponentAction | null> {
    switch (phase) {
      case "up": {
        if (!this.state) {
          return "create";
        }
        if (this.state.input.title !== this.input.title) {
          return "replace";
        }
        return null;
      }
      case "down": {
        return this.state ? "delete" : null;
      }
    }
  }

  create(): ResultAsync<void, Error> {
    return cfFetchAccount({
      method: "POST",
      path: "/accounts/:accountId/kv/namespaces",
      body: this.input,
      schema: KVNamespaceState,
      headers: {
        "Content-Type": "application/json",
      },
    }).andThen((state) => {
      this.setState(state);
      return okAsync();
    });
  }

  delete(): ResultAsync<void, Error> {
    if (!this.state) {
      return errAsync(new Error("KVNamespace not found"));
    }
    return cfFetchAccount({
      method: "DELETE",
      path: `/accounts/:accountId/kv/namespaces/${this.state.output.id}`,
      schema: z.any(),
    }).andThen(() => {
      this.setState(null);
      return okAsync();
    });
  }
}
