import { type CloudflareResponse, cloudflareApi } from "./api";
import { Resource } from "./resource";

interface R2BucketInput {
  name: string;
  locationHint?: "APAC" | "EEUR" | "ENAM" | "WEUR" | "WNAM" | "OC";
  storageClass?: "Standard" | "InfrequentAccess";
  jurisdiction?: "default" | "eu" | "fedramp";
}

interface R2BucketOutput {
  name: string;
  creation_date: string;
  location: "APAC" | "EEUR" | "ENAM" | "WEUR" | "WNAM" | "OC";
  storage_class: "Standard" | "InfrequentAccess";
}

export const R2Bucket = Resource<"r2-bucket", R2BucketInput, R2BucketOutput>(
  "r2-bucket",
  async (ctx) => {
    switch (ctx.phase) {
      case "create": {
        return ctx.result("create", () => createBucket(ctx.input));
      }
      case "update": {
        if (ctx.input.name !== ctx.output.name) {
          return ctx.result("replace");
        }
        return ctx.result("none");
      }
      case "delete": {
        return ctx.result("delete", () => deleteBucket(ctx.output.name));
      }
    }
  },
);

const createBucket = async (input: R2BucketInput) => {
  const res = await cloudflareApi.post(
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
    },
  );
  const json = await res.json<CloudflareResponse<R2BucketOutput>>();
  if (!res.ok || !json.success) {
    throw new Error(json.errors[0]?.message ?? "Unknown error");
  }
  return json.result;
};

const deleteBucket = async (name: string) => {
  const res = await cloudflareApi.delete(
    `/accounts/${cloudflareApi.accountId}/r2/buckets/${name}`,
  );
  const json = await res.json<CloudflareResponse<never>>();
  if (!res.ok || !json.success) {
    throw new Error(json.errors[0]?.message ?? "Unknown error");
  }
};
