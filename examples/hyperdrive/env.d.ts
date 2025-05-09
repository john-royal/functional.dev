/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  HYPERDRIVE: Hyperdrive;
}

declare module "cloudflare:workers" {
  interface Env extends CloudflareEnv {}
}

type Env = CloudflareEnv;
