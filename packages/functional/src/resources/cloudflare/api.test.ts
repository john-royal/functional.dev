import { describe, expect, it } from "bun:test";
import assert from "node:assert";
import { CloudflareAPI } from "./api";

assert(process.env.CLOUDFLARE_API_TOKEN, "CLOUDFLARE_API_TOKEN is not set");

describe("CloudflareAPI", () => {
  it("user.get", async () => {
    const api = new CloudflareAPI(process.env.CLOUDFLARE_API_TOKEN!);
    const user = await api.user.get();
    expect(user).toBeDefined();
  });

  it("accounts.list", async () => {
    const api = new CloudflareAPI(process.env.CLOUDFLARE_API_TOKEN!);
    const accounts = await api.accounts.list();
    expect(accounts).toBeDefined();
  });

  it("workers.scripts.list", async () => {
    const api = new CloudflareAPI(process.env.CLOUDFLARE_API_TOKEN!);
    const scripts = await api.workers.scripts.list();
    expect(scripts).toBeDefined();
  });
});
