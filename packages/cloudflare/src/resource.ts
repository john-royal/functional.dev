import z from "zod";
import { cloudflare } from "./provider";

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
  creation_date: z.iso.datetime(),
  location: R2BucketLocation.optional(),
  storage_class: R2BucketStorageClass.optional(),
});
export type R2BucketOutput = z.infer<typeof R2BucketOutput>;

const r2 = cloudflare
  .resource("cloudflare:r2")
  .validate(R2BucketInput)
  .create(async ({ ctx, input }) => {
    return (
      await ctx.client.fetchWithAccount({
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
      })
    )._unsafeUnwrap();
  })
  .read(async ({ ctx, identifier }) => {
    return (
      await ctx.client.fetchWithAccount({
        method: "GET",
        path: `/r2/buckets/${identifier}`,
        responseSchema: R2BucketOutput,
      })
    )._unsafeUnwrap();
  })
  .diff(async ({ oldOutput, input }) => {
    if (
      oldOutput.name !== input.name ||
      oldOutput.location !== input.locationHint ||
      oldOutput.storage_class !== input.storageClass
    ) {
      return "replace";
    }
    return "none";
  })
  .destroy(async ({ ctx, output }) => {
    (
      await ctx.client.fetchWithAccount({
        method: "DELETE",
        path: `/r2/buckets/${output.name}`,
        responseSchema: z.any(),
      })
    )._unsafeUnwrap();
  });
