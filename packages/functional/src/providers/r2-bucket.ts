import { okAsync, ResultAsync } from "neverthrow";
import { z } from "zod";
import type { CFClient } from "../cloudflare/client";
import { validate } from "../lib/validate";
import type { CFError } from "../cloudflare/error";
import type { ResourceProvider } from "./provider";

const R2BucketStorageClass = z.enum(["Standard", "InfrequentAccess"]);
const R2BucketJurisdiction = z.enum(["default", "eu", "fedramp"]);
const R2BucketLocation = z.enum(["APAC", "EEUR", "ENAM", "WEUR", "WNAM", "OC"]);

export const R2BucketInput = z.object({
  name: z
    .string()
    .min(3)
    .max(64)
    .transform((name) => name.toLowerCase().replace(/[^a-z0-9]/g, "-")),
  locationHint: R2BucketLocation.optional(),
  storageClass: R2BucketStorageClass.optional(),
  jurisdiction: R2BucketJurisdiction.optional(),
});
export type R2BucketInput = z.infer<typeof R2BucketInput>;

export const R2BucketOutput = z.object({
  name: z.string(),
  creation_date: z.string(),
  location: R2BucketLocation.optional(),
  storage_class: R2BucketStorageClass.optional(),
});
export type R2BucketOutput = z.infer<typeof R2BucketOutput>;

interface R2BucketState {
  input: R2BucketInput;
  output: R2BucketOutput;
}

export class R2BucketProvider
  implements ResourceProvider<R2BucketInput, R2BucketOutput, CFError>
{
  constructor(readonly client: CFClient) {}

  validate(input: R2BucketInput) {
    return validate(R2BucketInput, input);
  }

  create(input: R2BucketInput): ResultAsync<R2BucketOutput, CFError> {
    return this.client.fetchWithAccount({
      method: "POST",
      path: "/r2/buckets",
      headers: {
        "cf-r2-jurisdiction": input.jurisdiction ?? "default",
      },
      body: {
        format: "json",
        data: {
          name: input.name,
          locationHint: input.locationHint,
          storageClass: input.storageClass,
        },
      },
      responseSchema: R2BucketOutput,
    });
  }

  diff(
    state: R2BucketState,
    input: R2BucketInput
  ): ResultAsync<{ action: "noop" | "replace" | "update" }, never> {
    return okAsync({
      action: Bun.deepEquals(state.input, input) ? "noop" : "replace",
    });
  }

  delete(state: R2BucketState): ResultAsync<void, CFError> {
    return this.client
      .fetchWithAccount({
        method: "DELETE",
        path: `/r2/buckets/${state.output.name}`,
        responseSchema: z.unknown(),
      })
      .map(() => undefined);
  }
}
