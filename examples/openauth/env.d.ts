/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  AUTH_KV: KVNamespace;
  SECRET: string;
  METADATA: WorkerVersionMetadata;
}

declare module "cloudflare:workers" {
  interface Env extends CloudflareEnv {}
}

type Env = CloudflareEnv;
