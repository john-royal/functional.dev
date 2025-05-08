import type { Resource } from "./core/resource";

export const resourceProviders = {
  "cloudflare:worker": () =>
    import("~/cloudflare/worker").then((m) => m.Worker.provider),
  "cloudflare:worker:assets": () =>
    import("~/cloudflare/worker/assets").then((m) => m.WorkerAssets.provider),
  "cloudflare:worker:url": () =>
    import("~/cloudflare/worker/url").then((m) => m.WorkerURL.provider),
  "cloudflare:kv-namespace": () =>
    import("~/cloudflare/kv-namespace").then((m) => m.KVNamespace.provider),
  "cloudflare:r2-bucket": () =>
    import("~/cloudflare/r2-bucket").then((m) => m.R2Bucket.provider),
  bundle: () => import("~/bundle").then((m) => m.Bundle.provider),
} as Record<string, () => Promise<Resource.Provider<Resource.Properties>>>;
