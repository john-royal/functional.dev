import * as v from "valibot";
import { $cloudflare } from "~/core/app";
import { Resource } from "~/core/resource";

const R2BucketStorageClass = v.enum({
  Standard: "Standard",
  InfrequentAccess: "InfrequentAccess",
});
const R2BucketJurisdiction = v.enum({
  default: "default",
  eu: "eu",
  fedramp: "fedramp",
});
const R2BucketLocation = v.enum({
  APAC: "APAC",
  EEUR: "EEUR",
  ENAM: "ENAM",
  WEUR: "WEUR",
  WNAM: "WNAM",
  OC: "OC",
});

export const R2BucketInput = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(3),
    v.maxLength(64),
    v.transform((name) => name.toLowerCase().replace(/[^a-z0-9]/g, "-")),
  ),
  locationHint: v.optional(R2BucketLocation),
  storageClass: v.optional(R2BucketStorageClass),
  jurisdiction: v.optional(R2BucketJurisdiction),
});
export type R2BucketInput = v.InferOutput<typeof R2BucketInput>;

export const R2BucketOutput = v.object({
  name: v.string(),
  creation_date: v.string(),
  location: v.optional(R2BucketLocation),
  storage_class: v.optional(R2BucketStorageClass),
});
export type R2BucketOutput = v.InferOutput<typeof R2BucketOutput>;

type R2BucketProperties = Resource.CRUDProperties<
  R2BucketInput,
  R2BucketOutput,
  string
>;

export class R2Bucket extends Resource<R2BucketProperties> {
  readonly kind = "cloudflare:r2-bucket";

  constructor(
    name: string,
    input: R2BucketInput,
    metadata?: Resource.Metadata,
  ) {
    super(R2Bucket.provider, name, input, metadata);
  }

  static readonly provider: Resource.Provider<R2BucketProperties> = {
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
