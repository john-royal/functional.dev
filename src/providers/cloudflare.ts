import { APIClient, type FetchOptions } from "../lib/api";

interface CloudflareClientOptions {
  accountId: string;
  apiToken: string;
}

export class CloudflareClient {
  api: APIClient;
  accountId: string;

  constructor(options: CloudflareClientOptions) {
    this.api = new APIClient("https://api.cloudflare.com/client/v4", {
      Authorization: `Bearer ${options.apiToken}`,
    });
    this.accountId = options.accountId;
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
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
});
