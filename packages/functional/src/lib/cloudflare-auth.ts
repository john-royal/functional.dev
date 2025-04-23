import path from "node:path";
import os from "node:os";
import xdgAppPaths from "xdg-app-paths";
import { z } from "zod";
import toml from "@iarna/toml";
import { okAsync, Result, ResultAsync } from "neverthrow";

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

  get(): ResultAsync<Record<string, string>, never> {
    switch (this.value.type) {
      case "headers":
        return okAsync(this.value.headers);
      case "wrangler": {
        return this.value.provider.get().map((token) => ({
          Authorization: `Bearer ${token}`,
        }));
      }
    }
  }
}

class WranglerConfigProvider {
  _file?: Bun.BunFile;
  _config?: WranglerConfig;

  get() {
    return this.read
      .andThen((config) => {
        if (config.expiration_time.getTime() < Date.now() - 10 * 1000) {
          return this.refresh(config.refresh_token).andThrough((newConfig) =>
            this.write(newConfig)
          );
        }
        return okAsync(config);
      })
      .map((config) => config.oauth_token);
  }

  get file(): ResultAsync<Bun.BunFile, never> {
    if (this._file) {
      return okAsync(this._file);
    }
    return ResultAsync.fromSafePromise(
      Bun.file(config.WRANGLER_DIR_LEGACY).exists()
    ).map((legacy) => {
      const configPath = path.join(
        legacy ? config.WRANGLER_DIR_LEGACY : config.WRANGLER_DIR,
        "config",
        "default.toml"
      );
      return Bun.file(configPath);
    });
  }

  get read(): ResultAsync<WranglerConfig, never> {
    if (this._config) {
      return okAsync(this._config);
    }
    return this.file
      .map((file) => file.text())
      .map((text) => toml.parse(text.replace(/\r\n/g, "\n")))
      .map((config) => WranglerConfig.parse(config));
  }

  write(config: WranglerConfig) {
    this._config = config;
    return this.file.map((file) => file.write(toml.stringify(config)));
  }

  refresh(token: string): ResultAsync<WranglerConfig, never> {
    return ResultAsync.fromSafePromise(
      fetch("https://dash.cloudflare.com/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: token,
          client_id: config.CLIENT_ID,
        }).toString(),
      })
    ).map(async (res) => OAuthTokens.parse(await res.json()));
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
    })
  );
type OAuthTokens = z.infer<typeof OAuthTokens>;
