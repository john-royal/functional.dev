import { z } from "zod";

interface FetchOptions<T> extends RequestInit {
  path: string;
  schema: z.ZodType<T>;
}

export class CloudflareAPI {
  constructor(private apiToken: string, private accountId?: string) {}

  user = {
    get: () =>
      this.fetch({ path: "user", schema: CloudflareAPI.User.passthrough() }),
  };

  accounts = {
    list: () =>
      this.fetch({
        path: "accounts",
        schema: z.array(CloudflareAPI.Account.passthrough()),
      }),
  };

  workers = {
    scripts: {
      list: async () => {
        const accountId = await this.requireAccountId();
        return await this.fetch({
          path: `accounts/${accountId}/workers/scripts`,
          schema: z.array(CloudflareAPI.Workers.Script.passthrough()),
        });
      },
    },
  };

  private async fetch<T>({
    path,
    schema,
    ...init
  }: FetchOptions<T>): Promise<T> {
    const res = await fetch(`https://api.cloudflare.com/client/v4/${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${this.apiToken}`,
      },
    });
    const json = await res.json();
    const parsed = CloudflareAPI.Envelope(schema).safeParse(json);
    if (!parsed.success) {
      console.error(`Failed to parse ${path}`, parsed.error);
      console.dir(json, { depth: null });
      throw new Error(`Failed to parse ${path}`);
    }
    const data = parsed.data;
    if (!data.success) {
      console.error(`Failed to fetch ${path}`, data);
      throw new Error(`Failed to fetch ${path}`);
    }
    return data.result as T;
  }

  private async requireAccountId() {
    if (!this.accountId) {
      const accounts = await this.accounts.list();
      if (!accounts[0]) {
        throw new Error("No accounts found");
      }
      this.accountId = accounts[0].id;
    }
    return this.accountId;
  }
}

export namespace CloudflareAPI {
  export const Error = z.object({
    code: z.number().min(1000),
    message: z.string(),
    documentation_url: z.string().optional(),
    error_chain: z
      .array(
        z.object({
          code: z.number().min(1000),
          message: z.string(),
        })
      )
      .optional(),
    source: z
      .object({
        pointer: z.string().optional(),
      })
      .optional(),
  });

  export const Envelope = <T>(result: z.ZodType<T>) =>
    z.union([
      z.object({
        success: z.literal(false),
        result: z.null(),
        errors: z.array(Error),
        messages: z.array(Error),
      }),
      z.object({
        success: z.literal(true),
        result,
        errors: z.array(Error),
        messages: z.array(Error),
      }),
    ]);

  export const User = z.object({
    id: z.string(),
    email: z.string(),
    username: z.string(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    telephone: z.string().nullable(),
    country: z.string().nullable(),
    zipcode: z.string().nullable(),
    two_factor_authentication_enabled: z.boolean(),
    two_factor_authentication_locked: z.boolean(),
    created_on: z.string(),
    modified_on: z.string(),
    organizations: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        status: z.enum(["member", "invited"]),
        permissions: z.array(z.string()),
        roles: z.array(z.string()),
      })
    ),
    has_pro_zones: z.boolean(),
    has_business_zones: z.boolean(),
    has_enterprise_zones: z.boolean(),
    suspended: z.boolean(),
    betas: z.array(z.string()),
  });

  export const Account = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    settings: z.object({
      enforce_twofactor: z.boolean(),
      api_access_enabled: z.boolean().nullable(),
      access_approval_expiry: z.number().nullable(),
      abuse_contact_email: z.string().nullable(),
    }),
    legacy_flags: z.object({
      enterprise_zone_quota: z.object({
        maximum: z.number(),
        current: z.number(),
        available: z.number(),
      }),
    }),
    created_on: z.string(),
  });

  export namespace Workers {
    export const ConsumerScript = z.object({
      service: z.string(),
      environment: z.string(),
      namespace: z.string(),
    });

    export const Script = z.object({
      id: z.string(),
      created_on: z.string(),
      modified_on: z.string(),
      tag: z.string(),
      tags: z.array(z.string()).nullable(),
      etag: z.string(),
      has_assets: z.boolean(),
      has_modules: z.boolean(),
      logpush: z.boolean(),
      placement: z
        .object({
          last_analyzed_at: z.string().optional(),
          mode: z.literal("smart").optional(),
          status: z
            .enum([
              "SUCCESS",
              "UNSUPPORTED_APPLICATION",
              "INSUFFICIENT_INVOCATIONS",
            ])
            .optional(),
        })
        .optional(),
      tail_consumers: z.array(ConsumerScript).nullable(),
      usage_model: z.enum(["standard", "unbound"]),
    });
  }
}
