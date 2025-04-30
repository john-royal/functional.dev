import { err, ok, okAsync, ResultAsync } from "neverthrow";
import { z } from "zod";
import type { Store } from "../lib/store";
import { validate } from "../lib/validate";
import { CloudflareAuth } from "./auth";
import { CFError } from "./error";

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

const CFErrorResponse = z.object({
  success: z.literal(false),
  errors: z.array(CFMessage),
  messages: z.array(CFMessage),
  result: z.null(),
});

const CFSuccessResponse = <TResult>(result: z.ZodSchema<TResult>) =>
  z.object({
    success: z.literal(true),
    errors: z.array(CFMessage),
    messages: z.array(CFMessage),
    result,
  });

const CFResponse = <TResult>(result: z.ZodSchema<TResult>) =>
  z.discriminatedUnion("success", [CFSuccessResponse(result), CFErrorResponse]);

export class CFClient {
  account?: CloudflareAccount;
  auth = new CloudflareAuth();

  constructor(readonly store: Store) {}

  fetch<TResponse>(
    options: FetchOptions<TResponse>
  ): ResultAsync<TResponse, CFError> {
    const url = `https://api.cloudflare.com/client/v4${options.path}`;

    return this.formatHeaders(options.headers, options.body?.format === "json")
      .andThen((headers) => {
        return ResultAsync.fromPromise(
          fetch(url, {
            method: options.method,
            headers,
            body:
              options.body?.format === "json"
                ? JSON.stringify(options.body.data)
                : options.body?.data,
          }),
          (error) => new CFError({ code: "FAILED_TO_FETCH", cause: error })
        );
      })
      .andThen((res) => {
        const metadata = {
          url,
          status: res.status,
        };
        return ResultAsync.fromPromise(
          res.text(),
          (error) =>
            new CFError({
              code: "NO_RESPONSE",
              cause: error,
              metadata,
            })
        )
          .map((body) => JSON.parse(body))
          .orElse((error) =>
            err(
              new CFError({
                code: "INVALID_JSON",
                cause: error,
                metadata,
              })
            )
          )
          .andThen((json) =>
            validate(CFResponse(options.responseSchema), json).mapErr(
              (error) =>
                new CFError({
                  code: "UNEXPECTED_RESPONSE",
                  cause: error,
                  metadata: {
                    ...metadata,
                    body: json,
                  },
                })
            )
          )
          .andThen((data) => {
            if (!data.success) {
              return err(
                new CFError({
                  code: "API_ERROR",
                  cause: data.errors,
                  metadata,
                })
              );
            }
            console.log(`${options.path}`, data.result);
            return ok(data.result);
          });
      });
  }

  fetchWithAccount<TResponse>(
    options: FetchOptions<TResponse>
  ): ResultAsync<TResponse, CFError> {
    return this.getAccount().andThen((account) =>
      this.fetch({ ...options, path: `/accounts/${account.id}${options.path}` })
    );
  }

  getAccount(): ResultAsync<CloudflareAccount, CFError> {
    if (this.account) {
      return okAsync(this.account);
    }
    return this.store.fetch("cloudflare-account", () =>
      this.fetch({
        path: "/accounts",
        method: "GET",
        responseSchema: z.array(CloudflareAccount),
      }).andThen((accounts) => {
        if (!accounts[0]) {
          return err(new CFError({ code: "MISSING_ACCOUNT_ID" }));
        }
        this.account = accounts[0];
        return ok(this.account);
      })
    );
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
