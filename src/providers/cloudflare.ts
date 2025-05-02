import { z } from "zod";
import { APIClient, type FetchOptions } from "../lib/api";
import { CloudflareAuth } from "./cloudflare-auth";

interface CloudflareClientOptions {
  accountId?: string;
}

interface CloudflareRequest<T = unknown> extends FetchOptions<unknown> {
  responseSchema?: z.ZodType<T>;
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
    const accounts = await this.get("/accounts", {
      responseSchema: z.array(z.object({ id: z.string() })),
    });
    if (!accounts[0]) {
      throw new Error("No accounts found");
    }
    this.accountId = accounts[0].id;
  }

  async fetch<T = unknown>(
    path: `/${string}`,
    { responseSchema, ...options }: CloudflareRequest<T>,
  ) {
    const res = await this.api.fetch(path, options);
    const json = await res.json();
    const result = CloudflareResponse(responseSchema ?? z.unknown()).parse(
      json,
    );
    if (!res.ok || !result.success) {
      throw new Error(
        `Cloudflare API error (${res.status}) - ${result.errors
          .map((error) => `${error.code}: ${error.message}`)
          .join(", ")}`,
      );
    }
    return result.result as T;
  }

  async get<T>(
    path: `/${string}`,
    options: Pick<CloudflareRequest<T>, "headers" | "responseSchema"> = {},
  ) {
    return this.fetch(path, {
      method: "GET",
      ...options,
    });
  }

  async post<T>(
    path: `/${string}`,
    options: Pick<CloudflareRequest<T>, "headers" | "responseSchema" | "body">,
  ) {
    return this.fetch<T>(path, {
      method: "POST",
      ...options,
    });
  }

  async put<T>(
    path: `/${string}`,
    options: Pick<CloudflareRequest<T>, "headers" | "responseSchema" | "body">,
  ) {
    return this.fetch<T>(path, {
      method: "PUT",
      ...options,
    });
  }

  async patch<T>(
    path: `/${string}`,
    options: Pick<CloudflareRequest<T>, "headers" | "responseSchema" | "body">,
  ) {
    return this.fetch<T>(path, {
      method: "PATCH",
      ...options,
    });
  }

  async delete<T>(
    path: `/${string}`,
    options: Pick<CloudflareRequest<T>, "headers" | "responseSchema"> = {},
  ) {
    return this.fetch<T>(path, {
      method: "DELETE",
      ...options,
    });
  }
}

const CloudflareMessage = z.interface({
  code: z.number(),
  message: z.string(),
  get error_chain() {
    return z.array(CloudflareMessage);
  },
});
type CloudflareMessage = z.infer<typeof CloudflareMessage>;

const CloudflareErrorResponse = z.interface({
  success: z.literal(false),
  errors: z.array(CloudflareMessage),
  messages: z.array(CloudflareMessage),
});
type CloudflareErrorResponse = z.infer<typeof CloudflareErrorResponse>;

const CloudflareSuccessResponse = <T>(result: z.ZodType<T>) =>
  z.object({
    success: z.literal(true),
    errors: z.array(CloudflareMessage),
    messages: z.array(CloudflareMessage),
    result,
  });
type CloudflareSuccessResponse<T> = z.infer<
  ReturnType<typeof CloudflareSuccessResponse<T>>
>;

const CloudflareResponse = <T>(result: z.ZodType<T>) =>
  z.union([CloudflareSuccessResponse(result), CloudflareErrorResponse]);
type CloudflareResponse<T> = z.infer<ReturnType<typeof CloudflareResponse<T>>>;

export const cloudflareApi = new CloudflareClient({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
});
