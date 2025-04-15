import { expect, describe, it } from "bun:test";
import { parseAccount } from "./account";

const authenticatedInput =
  "\n ⛅️ wrangler 4.11.1\n-------------------\n\nGetting User settings...\n👋 You are logged in with an OAuth Token, associated with the email user@example.com.\n┌──────────────┬──────────────────────────────────┐\n│ Account Name │ Account ID                       │\n├──────────────┼──────────────────────────────────┤\n│ Test User    │ abcdef1234567890abcdef1234567890 │\n└──────────────┴──────────────────────────────────┘\n🔓 Token Permissions: If scopes are missing, you may need to logout and re-login.\nScope (Access)\n- account (read)\n- user (read)\n- workers (write)\n- workers_kv (write)\n- workers_routes (write)\n- workers_scripts (write)\n- workers_tail (read)\n- d1 (write)\n- pages (write)\n- zone (read)\n- ssl_certs (write)\n- ai (write)\n- queues (write)\n- pipelines (write)\n- secrets_store (write)\n- offline_access \n";
const unauthenticatedInput =
  "\n ⛅️ wrangler 4.11.1\n-------------------\n\nGetting User settings...\n👋 You are not authenticated. Please run `wrangler login` to login.\n";

describe("parseAccount", () => {
  it("parses account when authenticated", () => {
    const account = parseAccount(authenticatedInput);
    expect(account).toEqual({
      id: "abcdef1234567890abcdef1234567890",
      name: "Test User",
      email: "user@example.com",
      scopes: {
        account: "read",
        user: "read",
        workers: "write",
        workers_kv: "write",
        workers_routes: "write",
        workers_scripts: "write",
        workers_tail: "read",
        d1: "write",
        pages: "write",
        zone: "read",
        ssl_certs: "write",
        ai: "write",
        queues: "write",
        pipelines: "write",
        secrets_store: "write",
        offline_access: true,
      },
    });
  });

  it("returns null when unauthenticated", () => {
    const account = parseAccount(unauthenticatedInput);
    expect(account).toBeNull();
  });
});
