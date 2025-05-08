import * as v from "valibot";
import { APIClient, type FetchOptions } from "~/lib/api";
import type { IStore } from "~/lib/store";
import { CloudflareAuth } from "./auth";

interface CloudflareClientOptions {
  accountId?: string;
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type AnySchema<T> = v.BaseSchema<T, any, any>;

interface CloudflareRequest<T> extends FetchOptions<unknown> {
  responseSchema?: AnySchema<T>;
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
      responseSchema: v.array(v.object({ id: v.string() })),
    });
    if (!accounts[0]) {
      throw new Error("No accounts found");
    }
    const newAccountId = accounts[0].id;
    await this.cache.set("cloudflare:accountId", newAccountId);
    return newAccountId;
  }

  async fetch<T>(
    path: `/${string}`,
    { responseSchema, ...options }: CloudflareRequest<T>,
  ) {
    const res = await this.api.fetch(path, options);
    const json = await res.json();
    const parsed = v.safeParse(
      CloudflareResponse<T>(
        responseSchema ?? (v.unknown() as v.BaseSchema<T, T, v.BaseIssue<T>>),
      ),
      json,
    );
    if (!parsed.success) {
      console.error(
        "Failed to decode Cloudflare API response",
        json,
        parsed.issues,
      );
      throw new Error("Failed to decode Cloudflare API response");
    }
    const { output } = parsed;
    if (!res.ok || !output.success) {
      throw new Error(
        `Cloudflare API error (${res.status}) - ${output.errors?.map((error) => `${error.code}: ${error.message}`).join(", ")}`,
      );
    }
    return output.result;
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

const CloudflareMessage = v.object({
  code: v.number(),
  message: v.string(),
  error_chain: v.optional(v.any()),
});
type CloudflareMessage = v.InferOutput<typeof CloudflareMessage>;

const CloudflareErrorResponse = v.object({
  success: v.literal(false),
  errors: v.array(CloudflareMessage),
  messages: v.array(CloudflareMessage),
});
type CloudflareErrorResponse = v.InferOutput<typeof CloudflareErrorResponse>;

const CloudflareSuccessResponse = <T>(
  result: v.BaseSchema<T, T, v.BaseIssue<T>>,
) =>
  v.object({
    success: v.literal(true),
    errors: v.nullable(v.array(CloudflareMessage)),
    messages: v.nullable(v.array(CloudflareMessage)),
    result,
  });
type CloudflareSuccessResponse<T> = v.InferOutput<
  ReturnType<typeof CloudflareSuccessResponse<T>>
>;

const CloudflareResponse = <T>(result: v.BaseSchema<T, T, v.BaseIssue<T>>) =>
  v.union([CloudflareSuccessResponse(result), CloudflareErrorResponse]);
type CloudflareResponse<T> = v.InferOutput<
  ReturnType<typeof CloudflareResponse<T>>
>;
