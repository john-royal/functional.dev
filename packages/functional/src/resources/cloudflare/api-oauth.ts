import toml from "@iarna/toml";
import os from "node:os";
import path from "node:path";
import xdgAppPaths from "xdg-app-paths";
import crypto from "node:crypto";
import open from "open";

export async function getWranglerAccessToken() {
  const file = await config.resolveFile();
  if (!(await file.exists())) {
    const tokens = await oauth.authorize();
    await config.write(file, tokens);
    return tokens.access_token;
  }
  const values = await config.read(file);
  if (new Date(values.expiration_time).getTime() < Date.now() - 10 * 1000) {
    const tokens = await oauth.refresh(values.refresh_token);
    await config.write(file, tokens);
    return tokens.access_token;
  }
  return values.oauth_token;
}

type InternalWranglerConfig = {
  oauth_token: string;
  expiration_time: string;
  refresh_token: string;
  scopes: string[];
};

const config = {
  WRANGLER_DIR: xdgAppPaths(".wrangler").config(),
  WRANGLER_DIR_LEGACY: path.join(os.homedir(), ".wrangler"),

  async resolveFile() {
    const configDir = (await Bun.file(this.WRANGLER_DIR_LEGACY).exists())
      ? this.WRANGLER_DIR_LEGACY
      : this.WRANGLER_DIR;
    const configPath = path.join(configDir, "config", "default.toml");
    return Bun.file(configPath);
  },

  async read(file: Bun.BunFile): Promise<InternalWranglerConfig> {
    const text = (await file.text()).replace(/\r\n/g, "\n");
    return toml.parse(text) as InternalWranglerConfig;
  },

  async write(file: Bun.BunFile, tokens: OAuthTokens) {
    const config: InternalWranglerConfig = {
      oauth_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiration_time: new Date(
        Date.now() + tokens.expires_in * 1000
      ).toISOString(),
      scopes: tokens.scope.split(" "),
    };
    await file.write(toml.stringify(config));
  },
};

interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

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

  async authorize() {
    const { promise, resolve, reject } = Promise.withResolvers<OAuthTokens>();
    const authorization = this.generateAuthorizationURL();
    const callback = Bun.serve({
      port: 8976,
      fetch: async (req) => {
        const url = new URL(req.url);
        const error = url.searchParams.get("error");
        const error_description = url.searchParams.get("error_description");
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (error || error_description) {
          reject(
            new Error(
              `OAuth authorization failed: ${error} ${error_description}`
            )
          );
          return Response.redirect(this.DENIED_URI, 307);
        }
        if (!code) {
          reject(new Error("Missing code from OAuth callback"));
          return Response.redirect(this.DENIED_URI, 307);
        }
        if (!state || state !== authorization.state) {
          reject(new Error("Invalid state from OAuth callback"));
          return Response.redirect(this.DENIED_URI, 307);
        }
        try {
          const res = await oauth.exchange(code, authorization.verifier);
          resolve(res);
          return Response.redirect(this.SUCCESS_URI, 307);
        } catch (error) {
          reject(
            new Error("Failed to exchange code for token", { cause: error })
          );
          return Response.redirect(this.DENIED_URI, 307);
        }
      },
    });
    open(authorization.url);
    const timeout = setTimeout(
      () => reject(new Error("OAuth authorization timed out")),
      1000 * 60 * 5
    );
    return promise.finally(() => {
      clearTimeout(timeout);
      callback.stop();
    });
  },

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

  async exchange(code: string, verifier: string) {
    const body = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      code_verifier: verifier,
      client_id: oauth.CLIENT_ID,
      redirect_uri: oauth.REDIRECT_URI,
    });
    const res = await fetch("https://dash.cloudflare.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    return (await res.json()) as OAuthTokens;
  },

  async refresh(refreshToken: string) {
    const res = await fetch("https://dash.cloudflare.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: oauth.CLIENT_ID,
      }).toString(),
    });
    if (!res.ok) {
      throw new Error(`Failed to refresh access token: ${res.statusText}`);
    }
    return (await res.json()) as OAuthTokens;
  },
};
