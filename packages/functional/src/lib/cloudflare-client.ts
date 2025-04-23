import { okAsync, type ResultAsync } from "neverthrow";
import { z } from "zod";
import { CloudflareAuth } from "./cloudflare-auth";

const CloudflareAccount = z.object({
  id: z.string(),
  name: z.string(),
});
type CloudflareAccount = z.infer<typeof CloudflareAccount>;

interface FetchOptions<TResponse> {
  path: `/${string}`;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: { format: "json"; data: unknown } | { format: "form"; data: FormData };
  responseSchema: z.ZodSchema<TResponse>;
}

const CFMessage = z.object({
  code: z.number(),
  message: z.string(),
});
type CFMessage = z.infer<typeof CFMessage>;

const CFResponse = <TResult>(result: z.ZodSchema<TResult>) =>
  z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      errors: z.array(CFMessage),
      messages: z.array(CFMessage),
      result,
    }),
    z.object({
      success: z.literal(false),
      errors: z.array(CFMessage),
      messages: z.array(CFMessage),
      result: z.null(),
    }),
  ]);
type CFResponse<TResult> = z.infer<ReturnType<typeof CFResponse<TResult>>>;

export class CFClient {
  account?: CloudflareAccount;
  auth = new CloudflareAuth();

  fetch<TResponse>(
    options: FetchOptions<TResponse>
  ): ResultAsync<TResponse, Error> {
    return this.formatHeaders(options.headers, options.body?.format === "json")
      .map((headers) => {
        const url = `https://api.cloudflare.com/client/v4${options.path}`;
        return fetch(url, {
          method: options.method,
          headers,
          body:
            options.body?.format === "json"
              ? JSON.stringify(options.body.data)
              : options.body?.data,
        });
      })
      .map((res) => res.json())
      .map((json) => CFResponse(options.responseSchema).parse(json))
      .map((data) => {
        if (!data.success) {
          throw new Error(data.errors.map((e) => e.message).join("\n"));
        }
        return data.result as TResponse;
      });
  }

  fetchWithAccount<TResponse>(
    options: FetchOptions<TResponse>
  ): ResultAsync<TResponse, Error> {
    return this.getAccount().andThen((account) =>
      this.fetch({ ...options, path: `/accounts/${account.id}${options.path}` })
    );
  }

  getAccount(): ResultAsync<CloudflareAccount, Error> {
    if (this.account) {
      return okAsync(this.account);
    }
    return this.fetch({
      path: "/accounts",
      method: "GET",
      responseSchema: z.array(CloudflareAccount),
    }).map((accounts) => {
      if (!accounts[0]) {
        throw new Error("No account found");
      }
      this.account = accounts[0];
      return this.account;
    });
  }

  private formatHeaders(
    headers: Record<string, string> | undefined,
    json: boolean
  ) {
    return this.auth.get().map(
      (authHeaders): Record<string, string> => ({
        ...authHeaders,
        ...headers,
        ...(json ? { "Content-Type": "application/json" } : {}),
      })
    );
  }
}
