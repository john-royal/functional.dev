import * as v from "valibot";
import type { Bindable } from "~/binding";
import { $cloudflare } from "~/core/app";
import { Resource } from "~/core/resource";
import type { WorkersBindingInput } from "./worker/types";
import { $run } from "~/core/lifecycle";
import { SecretString } from "~/lib/secret";

const HyperdrivePublicDatabaseOrigin = v.object({
  database: v.string(),
  host: v.string(),
  password: v.string(),
  port: v.number(),
  scheme: v.enum({
    postgres: "postgres",
    postgresql: "postgresql",
  }),
  user: v.string(),
});

const HyperdriveOverAccessOrigin = v.object({
  access_client_id: v.string(),
  access_client_secret: v.string(),
  host: v.string(),
  database: v.string(),
  password: v.string(),
  scheme: v.enum({
    postgres: "postgres",
    postgresql: "postgresql",
    mysql: "mysql",
  }),
  user: v.string(),
});

const HyperdriveCachingOptions = v.object({
  disabled: v.optional(v.boolean()),
  max_age: v.optional(v.number()),
  stale_while_revalidate: v.optional(v.number()),
});

const HyperdriveMTLSOptions = v.object({
  ca_certificate_id: v.optional(v.string()),
  mtls_certificate_id: v.optional(v.string()),
  sslmode: v.optional(
    v.enum({
      require: "require",
      "verify-ca": "verify-ca",
      "verify-full": "verify-full",
    }),
  ),
});

const HyperdriveConfigInput = v.object({
  name: v.string(),
  origin: v.union([HyperdrivePublicDatabaseOrigin, HyperdriveOverAccessOrigin]),
  caching: v.optional(HyperdriveCachingOptions),
  mtls: v.optional(HyperdriveMTLSOptions),
});
type HyperdriveConfigInput = v.InferOutput<typeof HyperdriveConfigInput>;

const HyperdriveConfigOutput = v.object({
  id: v.string(),
  name: v.string(),
  origin: v.union([
    v.omit(HyperdrivePublicDatabaseOrigin, ["password"]),
    v.omit(HyperdriveOverAccessOrigin, ["access_client_secret", "password"]),
  ]),
  caching: HyperdriveCachingOptions,
  mtls: HyperdriveMTLSOptions,
  created_on: v.string(),
  modified_on: v.string(),
});
type HyperdriveConfigOutput = v.InferOutput<typeof HyperdriveConfigOutput>;

type HyperdriveProperties = Resource.CRUDProperties<
  HyperdriveConfigInput,
  HyperdriveConfigOutput,
  string
>;

export class Hyperdrive
  extends Resource<HyperdriveProperties>
  implements Bindable
{
  readonly kind = "cloudflare:hyperdrive";

  constructor(
    name: string,
    input: HyperdriveConfigInput,
    metadata?: Resource.Metadata,
  ) {
    super(
      Hyperdrive.provider,
      name,
      {
        ...input,
        origin: {
          ...input.origin,
          password: SecretString.wrap(
            input.origin.password,
          ) as unknown as string,
        },
      },
      metadata,
    );
  }

  async getBinding(): Promise<WorkersBindingInput> {
    const output = await $run.use(this);
    return {
      id: output.id,
      type: "hyperdrive",
    };
  }

  static readonly provider: Resource.Provider<HyperdriveProperties> = {
    create: async (input) => {
      const res = await $cloudflare.post(
        `/accounts/${$cloudflare.accountId}/hyperdrive/configs`,
        {
          body: {
            type: "json",
            value: {
              name: input.name,
              origin: input.origin,
              caching: input.caching,
              mtls: input.mtls,
            },
          },
          responseSchema: HyperdriveConfigOutput,
        },
      );
      return {
        providerId: res.id,
        output: res,
      };
    },
    diff: async (input, state) => {
      if (!Bun.deepEquals(input, state.input)) {
        return "update";
      }
      return "none";
    },
    update: async (input, state) => {
      return await $cloudflare.put(
        `/accounts/${$cloudflare.accountId}/hyperdrive/configs/${state.providerId}`,
        {
          body: {
            type: "json",
            value: {
              name: input.name,
              origin: input.origin,
              caching: input.caching,
              mtls: input.mtls,
            },
          },
          responseSchema: HyperdriveConfigOutput,
        },
      );
    },
    delete: async (state) => {
      await $cloudflare.delete(
        `/accounts/${$cloudflare.accountId}/hyperdrive/configs/${state.providerId}`,
      );
    },
  };
}
