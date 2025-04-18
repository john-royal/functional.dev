import { defineResource, type Resource } from "../resource";
import {
  cfFetch,
  normalizeCloudflareName,
  requireCloudflareAccountId,
} from "./api";
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
  origin?: string | HyperdrivePublicDatabaseOrigin | HyperdriveOverAccessOrigin;
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
    const normalizedOptions = normalizeOptions(self.globalId, options);
    return await cfFetch<HyperdriveConfigState>(
      `/accounts/${accountId}/hyperdrive/configs`,
      {
        method: "POST",
        body: JSON.stringify(normalizedOptions),
      }
    );
  },
  update: async ({ self, state, options }) => {
    const accountId = await requireCloudflareAccountId();
    const normalizedOptions = normalizeOptions(self.globalId, options);
    if (!normalizedOptions) {
      throw new Error(
        `[functional] Cannot update HyperdriveConfig "${self.globalId}" because the origin is not set`
      );
    }
    return await cfFetch<HyperdriveConfigState>(
      `/accounts/${accountId}/hyperdrive/configs/${state.id}`,
      {
        method: "PUT",
        body: JSON.stringify(normalizedOptions),
      }
    );
  },
  sync: async ({ self, state }) => {
    if (!state) {
      throw new Error(
        `[functional] Cannot sync HyperdriveConfig "${self.globalId}" because the ID is unknown`
      );
    }
    const accountId = await requireCloudflareAccountId();
    const response = await cfFetch<HyperdriveConfigState>(
      `/accounts/${accountId}/hyperdrive/configs/${state.id}`,
      {
        method: "GET",
      }
    );
    return response;
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

export const normalizeOptions = (
  globalId: string,
  options: HyperdriveConfigOptions
): HyperdriveConfigOptions | null => {
  if (!options.origin) {
    console.error(
      `[functional] Origin is not set for HyperdriveConfig "${globalId}"`
    );
    return null;
  }
  options.name = normalizeCloudflareName(options.name ?? globalId);
  if (typeof options.origin !== "string") {
    return options;
  }
  const url = new URL(options.origin);
  const origin = {
    database: url.pathname.slice(1),
    host: url.hostname,
    password: url.password,
    port: parseInt(url.port) || 5432,
    scheme: url.protocol.slice(0, -1) as "postgres" | "postgresql" | "mysql",
    user: url.username,
  };
  if (!validateOrigin(origin)) {
    console.error(
      `[functional] Origin "${options.origin}" is invalid for HyperdriveConfig "${globalId}"`
    );
    return null;
  }
  if (!options.mtls && url.searchParams.has("sslmode")) {
    options.mtls = {
      sslmode: url.searchParams.get("sslmode") as
        | "require"
        | "verify-ca"
        | "verify-full",
    };
  }
  return {
    ...options,
    origin,
  };
};

const validateOrigin = (
  origin: unknown
): origin is HyperdrivePublicDatabaseOrigin => {
  return (
    typeof origin === "object" &&
    origin !== null &&
    "database" in origin &&
    typeof origin.database === "string" &&
    "host" in origin &&
    typeof origin.host === "string" &&
    "password" in origin &&
    typeof origin.password === "string" &&
    "user" in origin &&
    typeof origin.user === "string" &&
    "port" in origin &&
    typeof origin.port === "number" &&
    "scheme" in origin &&
    typeof origin.scheme === "string" &&
    ["postgres", "postgresql", "mysql"].includes(origin.scheme)
  );
};
