import toml from "@iarna/toml";
import { Effect, Schema } from "effect";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import open from "open";
import xdgAppPaths from "xdg-app-paths";

const config = {
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
};

const InternalWranglerConfig = Schema.Struct({
  oauth_token: Schema.String,
  expiration_time: Schema.String,
  refresh_token: Schema.String,
  scopes: Schema.mutable(Schema.Array(Schema.String)), // this is mutable so the TOML parser doesn't complain
});
type InternalWranglerConfig = typeof InternalWranglerConfig.Type;

const WranglerAccessToken = Effect.gen(function* () {
  const file = yield* WranglerConfigFile;
  const config = yield* file.read;
  if (Date.now() > new Date(config.expiration_time).getTime() - 1000 * 10) {
    const tokens = yield* refresh(config.refresh_token).pipe(
      Effect.tap((tokens) => file.write(tokens))
    );
    return tokens.oauth_token;
  }
  return config.oauth_token;
});

const WranglerConfigFile = Effect.gen(function* () {
  const file = yield* Effect.promise(async () => {
    const WRANGLER_DIR = xdgAppPaths(".wrangler").config();
    const WRANGLER_DIR_LEGACY = path.join(os.homedir(), ".wrangler");

    return (await Bun.file(WRANGLER_DIR_LEGACY).exists())
      ? WRANGLER_DIR_LEGACY
      : WRANGLER_DIR;
  }).pipe(
    Effect.map((directory) => path.join(directory, "config", "default.toml")),
    Effect.map((path) => Bun.file(path))
  );
  return {
    read: Effect.promise(() => file.text()).pipe(
      Effect.map(toml.parse),
      Effect.flatMap(Schema.decodeUnknown(InternalWranglerConfig))
    ),
    write: (config: InternalWranglerConfig) =>
      Effect.promise(() => file.write(toml.stringify(config))),
  };
});

const OAuthTokens = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.String,
  expires_in: Schema.Number,
  scope: Schema.String,
}).pipe(
  Schema.transform(InternalWranglerConfig, {
    decode: (from) => ({
      oauth_token: from.access_token,
      expiration_time: new Date(
        Date.now() + from.expires_in * 1000
      ).toISOString(),
      refresh_token: from.refresh_token,
      scopes: from.scope.split(" "),
    }),
    encode: (to) => ({
      access_token: to.oauth_token,
      expires_in: new Date(to.expiration_time).getTime() - Date.now(),
      refresh_token: to.refresh_token,
      scope: to.scopes.join(" "),
    }),
  })
);
type OAuthTokens = typeof OAuthTokens.Type;

class OAuthError extends Error {
  readonly _tag = "OAuthError";
}

const generateAuthorizationURL = Effect.sync(() => {
  const state = crypto.randomBytes(32).toString("base64url");
  const verifier = crypto.randomBytes(96).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.CLIENT_ID,
    redirect_uri: config.REDIRECT_URI,
    scope: config.SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return {
    url: `https://dash.cloudflare.com/oauth2/auth?${params.toString()}`,
    state,
    verifier,
  };
});

const authorize = Effect.gen(function* () {
  const { state, verifier } = yield* generateAuthorizationURL.pipe(
    Effect.tap(({ url }) => Effect.promise(() => open(url)))
  );
  return yield* callback.pipe(
    Effect.flatMap((result) => {
      if (result.error || result.error_description) {
        return Effect.fail(
          new OAuthError(`${result.error}: ${result.error_description}`)
        );
      }
      if (result.state !== state) {
        return Effect.fail(new OAuthError("State mismatch"));
      }
      if (!result.code) {
        return Effect.fail(new OAuthError("No code"));
      }
      return Effect.succeed(result.code);
    }),
    Effect.flatMap((code) => exchange(code, verifier))
  );
});

const callback = Effect.async<
  Record<"error" | "error_description" | "code" | "state", string | null>
>((resume) => {
  const server = Bun.serve({
    port: 8976,
    fetch: (req) => {
      const url = new URL(req.url);
      const error = url.searchParams.get("error");
      const error_description = url.searchParams.get("error_description");
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      resume(
        Effect.succeed({ error, error_description, code, state }).pipe(
          Effect.tap(() => Effect.promise(() => server.stop()))
        )
      );
      return new Response(
        // TODO: Make sure this works on all browsers
        // The timeout is a workaround for Arc — without it, you return to the browser instead of the CLI.
        `
        <html>
            <body>
                <script>setTimeout(() => window.close(), 500);</script>
            </body>
        </html>
      `,
        {
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
    },
  });
  return Effect.promise(() => server.stop());
}).pipe(Effect.timeout(1000 * 60 * 5));

const exchange = (code: string, verifier: string) =>
  Effect.tryPromise({
    try: async () => {
      const body = new URLSearchParams({
        code,
        grant_type: "authorization_code",
        code_verifier: verifier,
        client_id: config.CLIENT_ID,
        redirect_uri: config.REDIRECT_URI,
      });
      const res = await fetch("https://dash.cloudflare.com/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      if (!res.ok) {
        throw res;
      }
      return await res.json();
    },
    catch: (error) => {
      if (error instanceof Response) {
        return new OAuthError(`${error.status}: ${error.statusText}`);
      }
      return new OAuthError("Unknown error");
    },
  }).pipe(Effect.flatMap(Schema.decodeUnknown(OAuthTokens)));

const refresh = (refreshToken: string) =>
  Effect.tryPromise({
    try: async () => {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: config.CLIENT_ID,
      });
      const res = await fetch("https://dash.cloudflare.com/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      if (!res.ok) {
        throw res;
      }
      return await res.json();
    },
    catch: (error) => {
      if (error instanceof Response) {
        return new OAuthError(`${error.status}: ${error.statusText}`);
      }
      return new OAuthError("Unknown error");
    },
  }).pipe(Effect.flatMap(Schema.decodeUnknown(OAuthTokens)));

export {
  authorize as authorizeCloudflare,
  WranglerAccessToken as getWranglerAccessToken,
};
