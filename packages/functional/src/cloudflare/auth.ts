import { pipe, Config, Effect, Schema, Console } from "effect";
import xdgAppPaths from "xdg-app-paths";
import path from "path";
import os from "os";
import toml from "@iarna/toml";

export const AuthHeaders = pipe(
  Config.string("CLOUDFLARE_API_TOKEN").pipe(
    Config.map((token) => ({
      Authorization: `Bearer ${token}`,
    }))
  ),
  Config.orElse(() =>
    Config.all([
      Config.string("CLOUDFLARE_API_KEY"),
      Config.string("CLOUDFLARE_EMAIL"),
    ]).pipe(
      Config.map(([apiKey, email]) => ({
        "X-Auth-Key": apiKey,
        "X-Auth-Email": email,
      }))
    )
  ),
  Effect.catchTag("ConfigError", () =>
    WranglerAuth.pipe(
      Effect.map((token) => ({
        Authorization: `Bearer ${token}`,
      }))
    )
  )
);

const WranglerConfig = Schema.Struct({
  oauth_token: Schema.String,
  refresh_token: Schema.String,
  expiration_time: Schema.String,
  scopes: Schema.Array(Schema.String),
});
type WranglerConfig = typeof WranglerConfig.Type;

const WranglerAuth = Effect.gen(function* () {
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

const OAuthTokens = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.String,
  expires_in: Schema.Number,
  scope: Schema.String,
  token_type: Schema.String,
});

const refresh = (token: string) =>
  Effect.promise(() =>
    fetch("https://dash.cloudflare.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token,
        client_id: "54d11594-84e4-41aa-b438-e81b8fa78ee7",
      }),
    }).then((res) => res.json())
  ).pipe(
    Effect.flatMap(Schema.decodeUnknown(OAuthTokens)),
    Effect.map(
      (tokens): WranglerConfig => ({
        oauth_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiration_time: new Date(
          Date.now() + tokens.expires_in * 1000
        ).toISOString(),
        scopes: tokens.scope.split(" "),
      })
    )
  );

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
      Effect.flatMap(Schema.decodeUnknown(WranglerConfig))
    ),
    write: (config: WranglerConfig) =>
      Effect.promise(() =>
        file.write(
          toml.stringify({
            oauth_token: config.oauth_token,
            refresh_token: config.refresh_token,
            expiration_time: config.expiration_time,
            scopes: [...config.scopes], // Type 'readonly string[]' is not assignable to type 'AnyJson'.
          })
        )
      ),
  };
});
