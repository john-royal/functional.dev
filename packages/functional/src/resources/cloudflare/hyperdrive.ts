import { defineResource, type Resource } from "../resource";
import { cfFetch, requireCloudflareAccountId } from "./api";
import type { WorkersBindingKindHyperdrive } from "./binding";

interface HyperdrivePublicDatabaseOrigin {
  database: string;
  host: string;
  password: string;
  port: number;
  scheme: "postgres" | "postgresql";
  user: string;
}

interface HyperdriveOverAccessOrigin {
  access_client_id: string;
  access_client_secret: string;
  host: string;
  database: string;
  password: string;
  scheme: "postgres" | "postgresql" | "mysql";
  user: string;
}

interface HyperdriveCachingOptions {
  disabled?: boolean;
  max_age?: number;
  stale_while_revalidate?: number;
}

interface HyperdriveMTLSOptions {
  ca_certificate_id?: string;
  mtls_certificate_id?: string;
  sslmode?: "require" | "verify-ca" | "verify-full";
}

interface HyperdriveConfigOptions {
  name?: string;
  origin: HyperdrivePublicDatabaseOrigin | HyperdriveOverAccessOrigin;
  caching?: HyperdriveCachingOptions;
  mtls?: HyperdriveMTLSOptions;
}

interface HyperdriveConfigState {
  id: string;
  name: string;
  origin: HyperdrivePublicDatabaseOrigin | HyperdriveOverAccessOrigin;
  caching: HyperdriveCachingOptions;
  mtls: HyperdriveMTLSOptions;
  created_on: string;
  modified_on: string;
}

export const HyperdriveConfig = defineResource({
  kind: "hyperdrive-config",
  create: async ({ self, options }) => {
    const accountId = await requireCloudflareAccountId();
    return await cfFetch<HyperdriveConfigState>(
      `/accounts/${accountId}/hyperdrive/configs`,
      {
        method: "POST",
        body: JSON.stringify({
          name: options.name ?? self.globalId,
          origin: options.origin,
          caching: options.caching,
          mtls: options.mtls,
        }),
      }
    );
  },
  update: async ({ self, state, options }) => {
    const accountId = await requireCloudflareAccountId();
    return await cfFetch<HyperdriveConfigState>(
      `/accounts/${accountId}/hyperdrive/configs/${state.id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          name: options.name ?? self.globalId,
          origin: options.origin,
          caching: options.caching,
          mtls: options.mtls,
        }),
      }
    );
  },
  delete: async ({ state }) => {
    const accountId = await requireCloudflareAccountId();
    await cfFetch(`/accounts/${accountId}/hyperdrive/configs/${state.id}`, {
      method: "DELETE",
    });
  },
  binding: ({ bindingNameOverride, self, state }) => ({
    name: bindingNameOverride ?? self.name,
    type: "hyperdrive",
    id: state.id,
  }),
} satisfies Resource<"hyperdrive-config", HyperdriveConfigOptions, HyperdriveConfigState, WorkersBindingKindHyperdrive>);
