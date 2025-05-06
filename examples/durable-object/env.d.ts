/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  DURABLE_OBJECT: DurableObjectNamespace;
  ASSETS: Fetcher;
}

declare module "cloudflare:workers" {
  interface Env extends CloudflareEnv {}
}

type Env = CloudflareEnv;