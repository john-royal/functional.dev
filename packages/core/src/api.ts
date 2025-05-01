import { err, ResultAsync } from "neverthrow";
import { validate } from "./validate";
import type { StandardSchemaV1 } from "./vendor/standard-schema";

export interface FetchOptions<TSuccess, TError> {
  path: `/${string}`;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?:
    | { format: "json"; data: unknown }
    | { format: "form"; data: FormData }
    | { format: "urlencoded"; data: Record<string, string> };
  response: {
    success: StandardSchemaV1<TSuccess>;
    error: StandardSchemaV1<TError>;
  };
}

export abstract class APIError<TError> extends Error {}

export class FetchError extends APIError<never> {
  constructor() {
    super("Failed to fetch");
  }
}
export class InvalidJSONError extends APIError<never> {
  constructor() {
    super("Invalid JSON");
  }
}
export class UnexpectedResponseError extends APIError<never> {
  constructor(readonly issues: readonly StandardSchemaV1.Issue[]) {
    super("Unexpected response");
  }
}
export class APIException<TError> extends APIError<TError> {
  constructor(readonly data: TError) {
    super("API exception");
  }
}

export function createFetcher(options: {
  base: string;
  headers: () => ResultAsync<Record<string, string>, APIError<any>>;
}) {
  const formatHeaders = (
    inputHeaders?: Record<string, string>,
    body?: "form" | "json" | "urlencoded"
  ) => {
    return options.headers().map((defaultHeaders) => ({
      ...defaultHeaders,
      ...inputHeaders,
      ...(body === "json" ? { "Content-Type": "application/json" } : {}),
      ...(body === "urlencoded"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    }));
  };
  const formatBody = (body: FetchOptions<unknown, unknown>["body"]) => {
    switch (body?.format) {
      case "json":
        return JSON.stringify(body.data);
      case "form":
        return body.data;
      case "urlencoded":
        return new URLSearchParams(body.data).toString();
      default:
        return undefined;
    }
  };
  const validateResponse = <T>(
    schema: StandardSchemaV1<T>,
    json: unknown
  ): ResultAsync<T, UnexpectedResponseError> => {
    return validate(schema, json).mapErr(
      (issues) => new UnexpectedResponseError(issues)
    );
  };
  return <TSuccess, TError>(
    input: FetchOptions<TSuccess, TError>
  ): ResultAsync<TSuccess, APIError<TError>> => {
    const url = `${options.base}${input.path}`;
    return formatHeaders(input.headers, input.body?.format).andThen((headers) =>
      ResultAsync.fromPromise(
        fetch(url, {
          method: input.method,
          headers,
          body: formatBody(input.body),
        }),
        () => new FetchError()
      ).andThen((response) =>
        ResultAsync.fromPromise(
          response.json(),
          () => new InvalidJSONError()
        ).andThen((json) =>
          response.ok
            ? validateResponse(input.response.success, json)
            : validateResponse(input.response.error, json).andThen((error) =>
                err(new APIException(error))
              )
        )
      )
    );
  };
}
