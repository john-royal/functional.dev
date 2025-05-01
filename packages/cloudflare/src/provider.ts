import { createBuilder } from "@functional/core/resource";
import { CFClient } from "./api";
import { CloudflareAuth } from "./auth";
import { ProviderConfig } from "./types";

export function cloudflareContext(options: ProviderConfig) {
  const auth = new CloudflareAuth({
    apiKey: options.apiKey ?? process.env.CLOUDFLARE_API_KEY,
    apiEmail: options.apiEmail ?? process.env.CLOUDFLARE_API_EMAIL,
    apiToken: options.apiToken ?? process.env.CLOUDFLARE_API_TOKEN,
  });
  return new CFClient(auth);
}

export const cloudflare = createBuilder<{ client: CFClient }>();
