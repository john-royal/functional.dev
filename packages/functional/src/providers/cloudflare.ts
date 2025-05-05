import { z } from "zod";
import type { IStore } from "~/lib/store";
import { APIClient, type FetchOptions } from "~/lib/api";
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

  constructor(
    options: CloudflareClientOptions,
    private readonly cache: IStore,
  ) {
    this.auth = new CloudflareAuth();
    this.api = new APIClient("https://api.cloudflare.com/client/v4", () =>
      this.auth.get(),
    );
    this.accountId = options.accountId;
  }

  async init() {
    const [accountId] = await Promise.all([
      this.getAccountId(),
      this.auth.get(),
    ]);
    this.accountId = accountId;
  }

  private async getAccountId() {
    const accountId = await this.cache.get<string>("cloudflare:accountId");
    if (accountId) {
      return accountId;
    }
    const accounts = await this.get("/accounts", {
      responseSchema: z.array(z.object({ id: z.string() })),
    });
    if (!accounts[0]) {
      throw new Error("No accounts found");
    }
    const newAccountId = accounts[0].id;
    await this.cache.set("cloudflare:accountId", newAccountId);
    return newAccountId;
  }

  async fetch<T = unknown>(
    path: `/${string}`,
    { responseSchema, ...options }: CloudflareRequest<T>,
  ) {
    const res = await this.api.fetch(path, options);
    const json = await res.json();
    const parsed = CloudflareResponse(responseSchema ?? z.unknown()).safeParse(
      json,
    );
    if (!parsed.success) {
      console.error("Failed to decode Cloudflare API response", json);
      throw new Error(
        `Failed to decode Cloudflare API response: ${JSON.stringify(parsed.error)}`,
      );
    }
    const { data } = parsed;
    if (!res.ok || !data.success) {
      throw new Error(
        `Cloudflare API error (${res.status}) - ${data.errors?.map((error) => `${error.code}: ${error.message}`).join(", ")}`,
      );
    }
    return data.result as T;
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

const CloudflareMessage = z.object({
  code: z.number(),
  message: z.string(),
  get error_chain() {
    return z.array(CloudflareMessage).optional();
  },
});
type CloudflareMessage = z.infer<typeof CloudflareMessage>;

const CloudflareErrorResponse = z.object({
  success: z.literal(false),
  errors: z.array(CloudflareMessage),
  messages: z.array(CloudflareMessage),
});
type CloudflareErrorResponse = z.infer<typeof CloudflareErrorResponse>;

const CloudflareSuccessResponse = <T>(result: z.ZodType<T>) =>
  z.object({
    success: z.literal(true),
    errors: z.array(CloudflareMessage).nullable(),
    messages: z.array(CloudflareMessage).nullable(),
    result,
  });
type CloudflareSuccessResponse<T> = z.infer<
  ReturnType<typeof CloudflareSuccessResponse<T>>
>;

const CloudflareResponse = <T>(result: z.ZodType<T>) =>
  z.union([CloudflareSuccessResponse(result), CloudflareErrorResponse]);
type CloudflareResponse<T> = z.infer<ReturnType<typeof CloudflareResponse<T>>>;
