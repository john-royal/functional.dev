import { err, ok, ResultAsync } from "neverthrow";
import { z } from "zod";

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

export interface CFFetchOptions<TBody, TResponse> {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: `/${string}`;
  body?: TBody;
  headers?: Record<string, string>;
  schema: z.ZodSchema<TResponse>;
}

export class APIError extends Error {}

export class FetchError extends APIError {
  constructor(cause?: unknown) {
    super("Failed to fetch", { cause });
  }
}

export class JSONError extends APIError {
  constructor(cause?: unknown) {
    super("Failed to parse JSON", { cause });
  }
}

export class UnexpectedResponseError extends APIError {
  constructor(readonly zodError: z.ZodError) {
    super("Unexpected response");
  }
}

export class CloudflareError extends APIError {
  constructor(
    readonly errors: CFMessage[],
    readonly messages: CFMessage[]
  ) {
    super("Cloudflare error");
  }
}

// unexpected error types:
// - failed to fetch
// - invalid json
// expected error types:
// - server returned error

export const cfFetch = <TBody, TResponse>({
  method,
  path,
  body,
  headers,
  schema,
}: CFFetchOptions<TBody, TResponse>): ResultAsync<TResponse, APIError> => {
  const url = `https://api.cloudflare.com/client/v4${path}`;
  return ResultAsync.fromPromise(
    fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
    (err) => new FetchError(err)
  )
    .map((res) =>
      res.json().catch((err) => {
        throw new JSONError(err);
      })
    )
    .andThen((json) => {
      const parsed = CFResponse(schema).safeParse(json);
      if (!parsed.success)
        return err(new UnexpectedResponseError(parsed.error));
      const { data } = parsed;
      if (!data.success || !data.result) {
        return err(new CloudflareError(data.errors, data.messages));
      }
      return ok(data.result);
    });
};
