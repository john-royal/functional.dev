import type { ResultAsync } from "neverthrow";
import { okAsync } from "neverthrow";
import { z } from "zod";
import type { CFClient } from "../cloudflare/client";
import type { CFError } from "../cloudflare/error";
import { validate } from "../lib/validate";
import {
  ResourceComponent,
  type ResourceDiff,
  type ResourceProvider,
} from "./provider";
import type { Scope } from "../scope";

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

interface KVNamespaceState {
  input: KVNamespaceInput;
  output: KVNamespaceOutput;
}

export class KVNamespaceProvider
  implements ResourceProvider<KVNamespaceInput, KVNamespaceOutput, CFError>
{
  constructor(readonly client: CFClient) {}

  validate(input: KVNamespaceInput) {
    return validate(KVNamespaceInput, input);
  }

  create(input: KVNamespaceInput): ResultAsync<KVNamespaceOutput, CFError> {
    return this.client.fetchWithAccount({
      method: "POST",
      path: "/storage/kv/namespaces",
      body: {
        format: "json",
        data: input,
      },
      responseSchema: KVNamespaceOutput,
    });
  }

  diff(
    state: KVNamespaceState,
    input: KVNamespaceInput
  ): ResultAsync<ResourceDiff, CFError> {
    return okAsync(Bun.deepEquals(state.input, input) ? "noop" : "replace");
  }

  delete(state: KVNamespaceState) {
    return this.client
      .fetchWithAccount({
        method: "DELETE",
        path: `/storage/kv/namespaces/${state.output.id}`,
        responseSchema: z.unknown(),
      })
      .map(() => undefined);
  }
}

export class KVNamespace extends ResourceComponent<
  KVNamespaceInput,
  KVNamespaceOutput,
  CFError
> {
  constructor(scope: Scope, name: string, input: KVNamespaceInput) {
    super(scope, new KVNamespaceProvider(scope.client), name, input);
  }
}
