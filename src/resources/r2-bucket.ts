import z from "zod";
import { cloudflareApi } from "../providers/cloudflare";
import { Resource } from "../resource";

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

export default class R2Bucket extends Resource<
  "r2-bucket",
  R2BucketInput,
  R2BucketOutput
> {
  readonly kind = "r2-bucket";

  run(
    context: Resource.Context<R2BucketInput, R2BucketOutput>,
  ): Resource.Action<R2BucketOutput> {
    switch (context.status) {
      case "create": {
        return {
          status: "create",
          apply: () => this.createBucket(this.input),
        };
      }
      case "update": {
        if (!Bun.deepEquals(this.input, context.input)) {
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
          apply: () => this.deleteBucket(context.output.name),
        };
      }
    }
  }

  private async createBucket(input: R2BucketInput) {
    return await cloudflareApi.post(
      `/accounts/${cloudflareApi.accountId}/r2/buckets`,
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
  }

  private async deleteBucket(name: string) {
    await cloudflareApi.delete(
      `/accounts/${cloudflareApi.accountId}/r2/buckets/${name}`,
    );
  }
}
