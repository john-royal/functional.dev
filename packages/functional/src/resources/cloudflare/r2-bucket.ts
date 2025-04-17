import {
  defineResource,
  type CreateResourceContext,
  type Resource,
} from "../resource";
import { cfFetch, requireCloudflareAccountId } from "./api";
import type { WorkersBindingKindR2Bucket } from "./binding";

interface R2BucketOptions {
  /**
   * The name of the bucket. If not provided, this will be generated
   * using the resource name.
   */
  name?: string;
  /**
   * The location of the bucket.
   */
  locationHint?: "apac" | "eeur" | "enam" | "weur" | "wnam" | "oc";
  /**
   * The storage class of the bucket.
   */
  storageClass?: "Standard" | "InfrequentAccess";
  /**
   * The jurisdiction of the bucket.
   */
  jurisdiction?: "default" | "eu" | "fedramp";
}

interface R2BucketState {
  /**
   * The name of the bucket.
   */
  name: string;
  /**
   * The creation date of the bucket.
   */
  creation_date: string;
  /**
   * The location of the bucket.
   */
  location?: "apac" | "eeur" | "enam" | "weur" | "wnam" | "oc";
  /**
   * The storage class of the bucket.
   */
  storage_class?: "Standard" | "InfrequentAccess";
}

export const R2Bucket = defineResource({
  kind: "r2-bucket",
  create: async ({ self, options }: CreateResourceContext<R2BucketOptions>) => {
    const accountId = await requireCloudflareAccountId();
    const bucket = await cfFetch<R2BucketState>(
      `/accounts/${accountId}/r2/buckets`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cf-r2-jurisdiction": options.jurisdiction ?? "default",
        },
        body: JSON.stringify({
          name: options.name ?? self.globalId,
          locationHint: options.locationHint,
          storageClass: options.storageClass,
        }),
      }
    );
    return bucket;
  },
  delete: async ({ state }) => {
    const accountId = await requireCloudflareAccountId();
    await cfFetch(`/accounts/${accountId}/r2/buckets/${state.name}`, {
      method: "DELETE",
    });
  },
  binding: ({ bindingNameOverride, self, state }) => ({
    name: bindingNameOverride ?? self.name,
    type: "r2_bucket",
    bucket_name: state.name,
  }),
} satisfies Resource<"r2-bucket", R2BucketOptions, R2BucketState, WorkersBindingKindR2Bucket>);
