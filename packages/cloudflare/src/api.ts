import { validate } from "@functional/core/validate";
import { err, ok, okAsync, ResultAsync } from "neverthrow";
import z from "zod";
import { CloudflareAuth } from "./auth";
import { CFError } from "./error";
import { APIResponse, CloudflareAccount } from "./types";

interface FetchOptions<TResponse> {
  path: `/${string}`;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: { format: "json"; data: unknown } | { format: "form"; data: FormData };
  responseSchema: z.ZodSchema<TResponse>;
}

export class CFClient {
  account?: CloudflareAccount;

  constructor(readonly auth: CloudflareAuth) {}

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
          (error) =>
            new CFError({
              code: "FAILED_TO_FETCH",
              message: "Failed to fetch",
              cause: error,
            })
        );
      })
      .andThen((res) => {
        return ResultAsync.fromPromise(
          res.json(),
          (error) =>
            new CFError({
              code: "INVALID_RESPONSE",
              message: "Invalid response",
              cause: error,
            })
        )
          .andThen((json) =>
            validate(APIResponse(options.responseSchema), json).mapErr(
              (error) =>
                new CFError({
                  code: "UNEXPECTED_RESPONSE",
                  message: "Unexpected response",
                  cause: error,
                  status: res.status,
                })
            )
          )
          .andThen((data) => {
            if (!data.success) {
              return err(
                new CFError({
                  code: "API_ERROR",
                  message: data.errors.map((e) => e.message).join(", "),
                  status: res.status,
                  data: data.errors,
                })
              );
            }
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
    return this.fetch({
      path: "/accounts",
      method: "GET",
      responseSchema: z.array(CloudflareAccount),
    }).andThen((accounts) => {
      if (!accounts[0]) {
        return err(
          new CFError({
            code: "MISSING_ACCOUNT_ID",
            message: "Missing account ID",
          })
        );
      }
      this.account = accounts[0];
      return ok(this.account);
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
