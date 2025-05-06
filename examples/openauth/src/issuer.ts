import { issuer } from "@openauthjs/openauth";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { subjects } from "./subjects";

export default {
  fetch: (req, env, ctx) => {
    const iss = issuer({
      subjects,
      providers: {},
      storage: CloudflareStorage({
        namespace: env.AUTH_KV,
      }),
      success: (ctx) => {
        return ctx.subject("user", {
          id: "1",
        });
      },
    });
    return iss.fetch(req, env, ctx);
  },
} satisfies ExportedHandler<Env>;
