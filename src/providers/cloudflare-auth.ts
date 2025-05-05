import os from "node:os";
import path from "node:path";
import toml from "@iarna/toml";
import xdgAppPaths from "xdg-app-paths";
import { z } from "zod";

const config = {
  WRANGLER_DIR: xdgAppPaths(".wrangler").config(),
  WRANGLER_DIR_LEGACY: path.join(os.homedir(), ".wrangler"),
  CLIENT_ID: "54d11594-84e4-41aa-b438-e81b8fa78ee7",
};

export class CloudflareAuth {
  value:
    | { type: "headers"; headers: Record<string, string> }
    | { type: "wrangler"; provider: WranglerConfigProvider };

  constructor() {
    if (process.env.CLOUDFLARE_API_TOKEN) {
      this.value = {
        type: "headers",
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        },
      };
    } else if (process.env.CLOUDFLARE_API_KEY) {
      if (!process.env.CLOUDFLARE_API_EMAIL) {
        throw new Error("CLOUDFLARE_API_EMAIL is not set");
      }
      this.value = {
        type: "headers",
        headers: {
          "X-Auth-Key": process.env.CLOUDFLARE_API_KEY,
          "X-Auth-Email": process.env.CLOUDFLARE_API_EMAIL,
        },
      };
    } else {
      this.value = {
        type: "wrangler",
        provider: new WranglerConfigProvider(),
      };
    }
  }

  async get(): Promise<Record<string, string>> {
    switch (this.value.type) {
      case "headers":
        return this.value.headers;
      case "wrangler": {
        const token = await this.value.provider.get();
        return {
          Authorization: `Bearer ${token}`,
        };
      }
    }
  }
}

class WranglerConfigProvider {
  file?: Bun.BunFile;
  config?: WranglerConfig;
  singleFlight = new SingleFlight<string>();

  get() {
    return this.singleFlight.run(async () => {
      const config = await this.read();
      if (config.expiration_time.getTime() < Date.now() - 10 * 1000) {
        console.log("[wrangler] Refreshing token");
        const newConfig = await this.refresh(config.refresh_token);
        await this.write(newConfig);
        return newConfig.oauth_token;
      }
      return config.oauth_token;
    });
  }

  async read(): Promise<WranglerConfig> {
    if (this.config) {
      return this.config;
    }
    const file = await this.getFile();
    const text = await file.text().catch(() => {
      throw new Error(
        "Wrangler config file not found. Please run `wrangler login`.",
      );
    });
    const config = toml.parse(text.replace(/\r\n/g, "\n"));
    this.config = WranglerConfig.parse(config);
    return this.config;
  }

  async write(config: WranglerConfig) {
    this.config = config;
    const file = await this.getFile();
    return file.write(toml.stringify(config));
  }

  async getFile(): Promise<Bun.BunFile> {
    if (this.file) {
      return this.file;
    }
    const legacy = await Bun.file(config.WRANGLER_DIR_LEGACY).exists();
    const configPath = path.join(
      legacy ? config.WRANGLER_DIR_LEGACY : config.WRANGLER_DIR,
      "config",
      "default.toml",
    );
    this.file = Bun.file(configPath);
    return this.file;
  }

  async refresh(token: string): Promise<WranglerConfig> {
    const res = await fetch("https://dash.cloudflare.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token,
        client_id: config.CLIENT_ID,
      }).toString(),
    });
    const json = await res.json();
    if (!res.ok) {
      const error = OAuthError.parse(json);
      throw new Error(`Failed to refresh token: ${error.error_description}`);
    }
    return OAuthTokens.parse(json);
  }
}

const WranglerConfig = z.object({
  oauth_token: z.string(),
  expiration_time: z.coerce.date(),
  refresh_token: z.string(),
  scopes: z.array(z.string()),
});
type WranglerConfig = z.infer<typeof WranglerConfig>;

const OAuthTokens = z
  .object({
    access_token: z.string(),
    refresh_token: z.string(),
    expires_in: z.number(),
    scope: z.string(),
  })
  .transform(
    (tokens): WranglerConfig => ({
      oauth_token: tokens.access_token,
      expiration_time: new Date(Date.now() + tokens.expires_in * 1000),
      refresh_token: tokens.refresh_token,
      scopes: tokens.scope.split(" "),
    }),
  );
type OAuthTokens = z.infer<typeof OAuthTokens>;

const OAuthError = z.object({
  error: z.string(),
  error_verbose: z.string(),
  error_description: z.string(),
  error_hint: z.string().optional(),
  status_code: z.number(),
});
type OAuthError = z.infer<typeof OAuthError>;

class SingleFlight<TResult> {
  result?: Promise<TResult>;

  run(fn: () => Promise<TResult>): Promise<TResult> {
    if (this.result) {
      return this.result;
    }
    try {
      this.result = fn();
      return this.result;
    } finally {
      this.result = undefined;
    }
  }
}
