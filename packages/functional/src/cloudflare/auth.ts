import toml from "@iarna/toml";
import { err, ok, okAsync, ResultAsync } from "neverthrow";
import os from "node:os";
import path from "node:path";
import xdgAppPaths from "xdg-app-paths";
import { z } from "zod";
import { validate } from "../lib/validate";
import { CFError } from "./error";

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

  get(): ResultAsync<Record<string, string>, CFError> {
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
  file?: Bun.BunFile;
  config?: WranglerConfig;
  singleFlight = new SingleFlight<string, any>();

  get() {
    return this.singleFlight.run(() =>
      this.read()
        .andThen((config) => {
          if (config.expiration_time.getTime() < Date.now() - 10 * 1000) {
            return this.refresh(config.refresh_token).andThrough((newConfig) =>
              this.write(newConfig)
            );
          }
          return okAsync(config);
        })
        .map((config) => config.oauth_token)
    );
  }

  read(): ResultAsync<WranglerConfig, CFError<"AUTH_INVALID_WRANGLER_CONFIG">> {
    if (this.config) {
      return okAsync(this.config);
    }
    return this.getFile()
      .map((file) => file.text())
      .map((text) => toml.parse(text.replace(/\r\n/g, "\n")))
      .andThen((config) => validate(WranglerConfig, config))
      .mapErr(
        (error) =>
          new CFError({ code: "AUTH_INVALID_WRANGLER_CONFIG", cause: error })
      );
  }

  write(config: WranglerConfig) {
    this.config = config;
    return this.getFile().map((file) => file.write(toml.stringify(config)));
  }

  getFile(): ResultAsync<Bun.BunFile, never> {
    if (this.file) {
      return okAsync(this.file);
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

  refresh(
    token: string
  ): ResultAsync<WranglerConfig, CFError<"AUTH_FAILED_TO_REFRESH">> {
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
    )
      .map((res) => res.json())
      .andThen((json) => validate(OAuthTokens, json))
      .mapErr(
        (error) => new CFError({ code: "AUTH_FAILED_TO_REFRESH", cause: error })
      );
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

class SingleFlight<TResult, TError> {
  result?: ResultAsync<TResult, TError>;

  run(fn: () => ResultAsync<TResult, TError>): ResultAsync<TResult, TError> {
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
