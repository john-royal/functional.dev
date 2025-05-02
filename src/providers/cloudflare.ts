import { APIClient, type FetchOptions } from "../lib/api";
import { CloudflareAuth } from "./cloudflare-auth";

interface CloudflareClientOptions {
  accountId?: string;
}

export class CloudflareClient {
  api: APIClient;
  auth: CloudflareAuth;
  accountId?: string;

  constructor(options: CloudflareClientOptions) {
    this.auth = new CloudflareAuth();
    this.api = new APIClient("https://api.cloudflare.com/client/v4", () =>
      this.auth.get(),
    );
    this.accountId = options.accountId;
  }

  async init() {
    if (this.accountId) {
      return;
    }
    const res = await this.get("/accounts");
    const json = await res.json<CloudflareResponse<{ id: string }[]>>();
    if (!res.ok || !json.success) {
      throw new Error(json.errors[0]?.message ?? "Unknown error");
    }
    if (!json.result[0]) {
      throw new Error("No accounts found");
    }
    this.accountId = json.result[0].id;
  }

  async fetch<T>(path: `/${string}`, options: FetchOptions<T>) {
    return this.api.fetch<T>(path, options);
  }

  async get<T>(
    path: `/${string}`,
    options?: Pick<FetchOptions<never>, "headers">,
  ) {
    return this.fetch<T>(path, {
      method: "GET",
      ...options,
    });
  }

  async post<T>(path: `/${string}`, options?: Omit<FetchOptions<T>, "method">) {
    return this.fetch<T>(path, {
      method: "POST",
      ...options,
    });
  }

  async put<T>(path: `/${string}`, options?: Omit<FetchOptions<T>, "method">) {
    return this.fetch<T>(path, {
      method: "PUT",
      ...options,
    });
  }

  async patch<T>(
    path: `/${string}`,
    options?: Omit<FetchOptions<T>, "method">,
  ) {
    return this.fetch<T>(path, {
      method: "PATCH",
      ...options,
    });
  }

  async delete<T>(
    path: `/${string}`,
    options?: Pick<FetchOptions<never>, "headers">,
  ) {
    return this.fetch<T>(path, {
      method: "DELETE",
      ...options,
    });
  }
}

interface CloudflareMessage {
  code: number;
  message: string;
  error_chain?: CloudflareMessage[];
}

interface CloudflareSuccessResponse<T> {
  success: true;
  errors: CloudflareMessage[];
  messages: CloudflareMessage[];
  result: T;
}

interface CloudflareErrorResponse {
  success: false;
  errors: CloudflareMessage[];
  messages: CloudflareMessage[];
}

export type CloudflareResponse<T> =
  | CloudflareSuccessResponse<T>
  | CloudflareErrorResponse;

export const cloudflareApi = new CloudflareClient({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
});
