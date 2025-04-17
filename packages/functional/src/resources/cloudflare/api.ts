import { $app } from "../../context";
import assert from "node:assert";

interface CFMessage {
  code: number;
  message: string;
  error_chain?: CFMessage[];
}
interface CFResponseSuccess<T> {
  success: true;
  errors: CFMessage[];
  messages: CFMessage[];
  result: T;
}
interface CFResponseError {
  success: false;
  errors: CFMessage[];
  messages: CFMessage[];
  result: null;
}
type CFResponse<T> = CFResponseSuccess<T> | CFResponseError;

export class CFError extends Error {
  constructor(readonly messages: CFMessage[], readonly status: number) {
    super(messages.map((m) => m.message).join("\n"));
  }
}

export async function cfFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!apiToken) {
    throw new Error("CLOUDFLARE_API_TOKEN is not set");
  }
  const url = `https://api.cloudflare.com/client/v4/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...options?.headers,
    },
  });
  const data = (await res.json()) as CFResponse<T>;
  if (!data.success) {
    throw new CFError(data.errors, res.status);
  }
  return data.result;
}

export async function requireCloudflareAccountId() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) {
    return process.env.CLOUDFLARE_ACCOUNT_ID;
  }
  const accountId = await $app.cache.wrap("cloudflare-account-id", async () => {
    const accounts = await cfFetch<
      {
        id: string;
      }[]
    >("accounts");
    assert(accounts[0], "No account found");
    return accounts[0].id;
  });
  return accountId;
}
