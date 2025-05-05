/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  KV_NAMESPACE: KVNamespace;
  R2_BUCKET: R2Bucket;
  DO_NAMESPACE: DurableObjectNamespace;
}

declare module "cloudflare:workers" {
  interface Env extends CloudflareEnv {}
}

type Env = CloudflareEnv;