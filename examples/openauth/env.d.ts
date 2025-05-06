/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  AUTH_KV: KVNamespace;
}

declare module "cloudflare:workers" {
  interface Env extends CloudflareEnv {}
}

type Env = CloudflareEnv;