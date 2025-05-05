import z from "zod";
import { $cloudflare } from "~/core/app";
import { Resource } from "~/core/resource";

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

type R2BucketProperties = Resource.CRUDProperties<
  R2BucketInput,
  R2BucketOutput,
  string
>;

export default class R2Bucket extends Resource<R2BucketProperties> {
  readonly kind = "cloudflare:r2-bucket";

  static get provider(): Resource.Provider<R2BucketProperties> {
    return {
      create: async (input) => {
        const res = await $cloudflare.post(
          `/accounts/${$cloudflare.accountId}/r2/buckets`,
          {
            headers: {
              "cf-r2-jurisdiction": input.jurisdiction ?? "default",
            },
            body: {
              type: "json",
              value: {
                name: input.name,
                locationHint: input.locationHint,
                storageClass: input.storageClass,
              },
            },
            responseSchema: R2BucketOutput,
          },
        );
        return {
          providerId: res.name,
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
          `/accounts/${$cloudflare.accountId}/r2/buckets/${state.providerId}`,
        );
      },
    };
  }

  constructor(
    name: string,
    input: R2BucketInput,
    metadata?: Resource.Metadata,
  ) {
    super(R2Bucket.provider, name, input, metadata);
  }
}
