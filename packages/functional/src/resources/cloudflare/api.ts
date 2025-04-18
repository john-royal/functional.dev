import assert from "node:assert";
import { $functional } from "../util";

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
interface CFResponseInternalError {
  code: number;
  error: string;
}
type CFResponse<T> =
  | CFResponseSuccess<T>
  | CFResponseError
  | CFResponseInternalError;

export class CFError extends Error {
  constructor(
    readonly error: CFMessage[] | CFResponseInternalError,
    readonly status: number,
    readonly metadata?: Record<string, unknown>
  ) {
    super(
      "error" in error
        ? `Cloudflare API error: ${error.error} (code ${error.code})`
        : error.map((e) => e.message).join("\n")
    );
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
  path = path.startsWith("/") ? path.slice(1) : path;
  const url = `https://api.cloudflare.com/client/v4/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...options?.headers,
    },
  });
  const data = (await res.json().catch(() => {
    throw new CFError(
      {
        code: res.status,
        error: `Server returned ${
          res.status
        } with non-JSON body (${res.headers.get("content-type")})`,
      },
      res.status,
      {
        url,
        body: options?.body,
      }
    );
  })) as CFResponse<T>;
  if ("success" in data) {
    if (!data.success) {
      throw new CFError(data.errors, res.status, {
        url,
        body: options?.body,
      });
    }
    return data.result;
  }
  throw new CFError(data, res.status, {
    url,
    body: options?.body,
  });
}

export async function requireCloudflareAccountId() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) {
    return process.env.CLOUDFLARE_ACCOUNT_ID;
  }
  const accountId = await $functional.store.fetch(
    "cloudflare-account-id",
    async () => {
      const accounts = await cfFetch<
        {
          id: string;
        }[]
      >("accounts");
      assert(accounts[0], "No account found");
      return accounts[0].id;
    }
  );
  return accountId;
}

export function normalizeCloudflareName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}
