import toml from "@iarna/toml";
import os from "node:os";
import path from "node:path";
import xdgAppPaths from "xdg-app-paths";

export async function getWranglerAccessToken() {
  const file = await internal.resolveFile();
  const config = await internal.readFile(file);
  if (new Date(config.expiration_time).getTime() < Date.now() - 10 * 1000) {
    const refreshed = await internal.refreshToken(config.refresh_token);
    await internal.writeFile(file, refreshed);
  }
  return config.oauth_token;
}

type InternalWranglerConfig = {
  oauth_token: string;
  expiration_time: string;
  refresh_token: string;
  scopes: string[];
};

const config = {
  WRANGLER_CLIENT_ID: "54d11594-84e4-41aa-b438-e81b8fa78ee7",
  WRANGLER_CONFIG_DIR: xdgAppPaths(".wrangler").config(),
  WRANGLER_CONFIG_LEGACY_DIR: path.join(os.homedir(), ".wrangler"),
};

const internal = {
  async resolveFile() {
    const configDir = (await Bun.file(
      config.WRANGLER_CONFIG_LEGACY_DIR
    ).exists())
      ? config.WRANGLER_CONFIG_LEGACY_DIR
      : config.WRANGLER_CONFIG_DIR;
    const configPath = path.join(configDir, "config", "default.toml");
    const file = Bun.file(configPath);
    if (!(await file.exists())) {
      throw new Error(`Cannot find wrangler config file at ${file.name}`);
    }
    return file;
  },

  async readFile(file: Bun.BunFile): Promise<InternalWranglerConfig> {
    const text = (await file.text()).replace(/\r\n/g, "\n");
    return toml.parse(text) as InternalWranglerConfig;
  },

  async writeFile(file: Bun.BunFile, config: InternalWranglerConfig) {
    await file.write(toml.stringify(config));
  },

  async refreshToken(refreshToken: string) {
    const res = await fetch("https://dash.cloudflare.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: config.WRANGLER_CLIENT_ID,
      }).toString(),
    });
    if (!res.ok) {
      throw new Error(`Failed to refresh access token: ${res.statusText}`);
    }
    const json = (await res.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token: string;
      scope: string;
    };
    return {
      oauth_token: json.access_token,
      refresh_token: json.refresh_token,
      expiration_time: new Date(
        Date.now() + json.expires_in * 1000
      ).toISOString(),
      scopes: json.scope.split(" "),
    };
  },
};
