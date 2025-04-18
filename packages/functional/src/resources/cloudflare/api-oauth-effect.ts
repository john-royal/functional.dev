import { Effect, Schema } from "effect";
import xdgAppPaths from "xdg-app-paths";
import path from "node:path";
import os from "node:os";
import toml from "@iarna/toml";
import crypto from "node:crypto";
import open from "open";

const InternalWranglerConfig = Schema.Struct({
  oauth_token: Schema.String,
  expiration_time: Schema.String,
  refresh_token: Schema.String,
  scopes: Schema.Array(Schema.String),
});
type InternalWranglerConfig = typeof InternalWranglerConfig.Type;

const config = {
  WRANGLER_DIR: xdgAppPaths(".wrangler").config(),
  WRANGLER_DIR_LEGACY: path.join(os.homedir(), ".wrangler"),

  file: () =>
    Effect.promise(async () => {
      const configDir = (await Bun.file(config.WRANGLER_DIR_LEGACY).exists())
        ? config.WRANGLER_DIR_LEGACY
        : config.WRANGLER_DIR;
      const configPath = path.join(configDir, "config", "default.toml");
      return Bun.file(configPath);
    }),

  read: (file: Bun.BunFile) =>
    Effect.tryPromise({
      try: () => file.text(),
      catch: (error) => new Error(`Failed to read file: ${error}`),
    }).pipe(
      Effect.tryMap({
        try: (text) => toml.parse(text.replace(/\r\n/g, "\n")),
        catch: (error) => new Error(`Failed to parse file: ${error}`),
      }),
      Effect.flatMap(Schema.decodeUnknown(InternalWranglerConfig))
    ),

  write: (file: Bun.BunFile, config: InternalWranglerConfig) =>
    Effect.promise(async () => {
      await file.write(
        toml.stringify({
          oauth_token: config.oauth_token,
          refresh_token: config.refresh_token,
          scopes: config.scopes as string[],
          expiration_time: config.expiration_time,
        })
      );
    }),
};

class OAuthError {
  readonly _tag = "OAuthError";

  constructor(
    readonly error: string,
    readonly error_description: string | null
  ) {}
}

const OAuthTokens = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.String,
  expires_in: Schema.Number,
  scope: Schema.String,
});
type OAuthTokens = typeof OAuthTokens.Type;

const oauth = {
  CLIENT_ID: "54d11594-84e4-41aa-b438-e81b8fa78ee7",
  REDIRECT_URI: "http://localhost:8976/oauth/callback",
  SUCCESS_URI:
    "https://welcome.developers.workers.dev/wrangler-oauth-consent-granted",
  DENIED_URI:
    "https://welcome.developers.workers.dev/wrangler-oauth-consent-denied",
  SCOPES: [
    "account:read",
    "user:read",
    "workers:write",
    "workers_kv:write",
    "workers_routes:write",
    "workers_scripts:write",
    "workers_tail:read",
    "d1:write",
    "pages:write",
    "zone:read",
    "offline_access",
  ],

  authorize: (authorization: {
    url: string;
    state: string;
    verifier: string;
  }) =>
    Effect.tryPromise({
      try: () => open(authorization.url),
      catch: () => new OAuthError("failed_to_open_browser", null),
    }).pipe(
      Effect.andThen(
        Effect.async<Request>((resume, signal) => {
          const callback = Bun.serve({
            port: 8976,
            fetch: async (req) => {
              resume(Effect.succeed(req));
              return new Response("OK", { status: 200 });
            },
          });
          signal.addEventListener("abort", () => {
            callback.stop();
          });
        })
      ),
      Effect.flatMap((req) => {
        const url = new URL(req.url);
        const error = url.searchParams.get("error");
        const error_description = url.searchParams.get("error_description");
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (error || error_description) {
          return Effect.fail(
            new OAuthError(error ?? "unknown", error_description)
          );
        }
        if (!code) {
          return Effect.fail(new OAuthError("missing_code", null));
        }
        if (!state || state !== authorization.state) {
          return Effect.fail(new OAuthError("invalid_state", null));
        }
        return Effect.succeed({ code, state });
      }),
      Effect.tryPromise({
        try: ({ code }) =>
          fetch("https://dash.cloudflare.com/oauth2/token", {
            method: "POST",
            body: new URLSearchParams({
              code,
              redirect_uri: oauth.REDIRECT_URI,
            }),
          }),
        catch: (error) => new OAuthError("failed_to_fetch_tokens", null),
      }),
      Effect.timeout(1000 * 60 * 5),
      Effect.catchTag("TimeoutException", () =>
        Effect.fail(new OAuthError("timeout", null))
      )
    ),

  generateAuthorizationURL() {
    const state = crypto.randomBytes(32).toString("base64url");
    const verifier = crypto.randomBytes(96).toString("base64url");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: oauth.CLIENT_ID,
      redirect_uri: oauth.REDIRECT_URI,
      scope: oauth.SCOPES.join(" "),
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return {
      url: `https://dash.cloudflare.com/oauth2/auth?${params.toString()}`,
      state,
      verifier,
    };
  },
};
