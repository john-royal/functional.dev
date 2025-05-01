import { validate } from "@functional/core/validate";
import toml from "@iarna/toml";
import { err, okAsync, ResultAsync } from "neverthrow";
import os from "node:os";
import path from "node:path";
import xdgAppPaths from "xdg-app-paths";
import { z } from "zod";
import type { ProviderConfig } from "./types";
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

  constructor(options: ProviderConfig) {
    if (options.apiToken) {
      this.value = {
        type: "headers",
        headers: {
          Authorization: `Bearer ${options.apiToken}`,
        },
      };
    } else if (options.apiKey) {
      if (!options.apiEmail) {
        throw new CFError({
          code: "MISSING_CLOUDFLARE_API_EMAIL",
          message: "CLOUDFLARE_API_EMAIL is not set",
        });
      }
      this.value = {
        type: "headers",
        headers: {
          "X-Auth-Key": options.apiKey,
          "X-Auth-Email": options.apiEmail,
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

  read(): ResultAsync<WranglerConfig, CFError> {
    if (this.config) {
      return okAsync(this.config);
    }
    return this.getFile()
      .map((file) => file.text())
      .map((text) => toml.parse(text.replace(/\r\n/g, "\n")))
      .andThen((config) => validate(WranglerConfig, config))
      .mapErr(
        (error) =>
          new CFError({
            code: "FAILED_TO_READ_WRANGLER_CONFIG",
            message: "Failed to read Wrangler config",
            cause: error,
          })
      );
  }

  write(config: WranglerConfig) {
    this.config = config;
    return this.getFile().map((file) =>
      file.write(
        toml.stringify({
          ...config,
          expiration_time: config.expiration_time.toISOString(),
        })
      )
    );
  }

  getFile(): ResultAsync<Bun.BunFile, never> {
    if (this.file) {
      return okAsync(this.file);
    }
    return ResultAsync.fromSafePromise(
      Bun.file(config.WRANGLER_DIR_LEGACY).exists()
    )
      .map((legacy) => {
        const configPath = path.join(
          legacy ? config.WRANGLER_DIR_LEGACY : config.WRANGLER_DIR,
          "config",
          "default.toml"
        );
        return Bun.file(configPath);
      })
      .andTee((file) => {
        this.file = file;
      });
  }

  refresh(token: string): ResultAsync<WranglerConfig, CFError> {
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
      .andThen((res) =>
        ResultAsync.fromSafePromise(res.json()).andThen((json) =>
          res.ok
            ? validate(OAuthTokens, json)
            : validate(OAuthError, json).andThen((error) => err(error))
        )
      )
      .map((config) => ({
        oauth_token: config.access_token,
        refresh_token: config.refresh_token,
        scopes: config.scope.split(" "),
        expiration_time: new Date(Date.now() + config.expires_in * 1000),
      }))
      .mapErr(
        (error) =>
          new CFError({
            code: "FAILED_TO_REFRESH_OAUTH_TOKEN",
            message: "Failed to refresh OAuth token",
            cause: error,
          })
      );
  }
}

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

export const WranglerConfig = z.interface({
  oauth_token: z.string(),
  expiration_time: z.coerce.date(),
  refresh_token: z.string(),
  scopes: z.array(z.string()),
});
export type WranglerConfig = z.infer<typeof WranglerConfig>;

export const OAuthTokens = z.interface({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  scope: z.string(),
});
export type OAuthTokens = z.infer<typeof OAuthTokens>;

export const OAuthError = z.interface({
  error: z.string(),
  error_verbose: z.string(),
  error_description: z.string(),
  error_hint: z.string(),
  status_code: z.number(),
});
export type OAuthError = z.infer<typeof OAuthError>;
