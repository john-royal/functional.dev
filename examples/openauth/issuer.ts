import { issuer } from "@openauthjs/openauth";
import { PasswordProvider } from "@openauthjs/openauth/provider/password";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { createSubjects } from "@openauthjs/openauth/subject";
import { PasswordUI } from "@openauthjs/openauth/ui/password";
import { z } from "zod";

const subjects = createSubjects({
  user: z.object({
    id: z.string(),
  }),
});

export default {
  fetch(request, env, ctx) {
    const iss = issuer({
      subjects,
      storage: CloudflareStorage({
        namespace: env.AuthKV,
      }),
      providers: {
        password: PasswordProvider(PasswordUI({ sendCode: async () => {} })),
      },
      success: (res) => {
        return res.subject("user", { id: "123" });
      },
    });
    return iss.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
