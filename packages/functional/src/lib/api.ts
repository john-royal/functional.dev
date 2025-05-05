import type { MaybePromise } from "./types";

export type TypedResponse = Omit<Response, "json"> & {
  json<T>(): Promise<T>;
};

export interface JsonBody<T> {
  type: "json";
  value: T;
}

export interface FormDataBody {
  type: "form";
  value: FormData;
}

export interface FormUrlEncodedBody {
  type: "form-urlencoded";
  value: Record<string, string>;
}

export interface FetchOptions<T> {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: JsonBody<T> | FormDataBody | FormUrlEncodedBody;
}

export class APIClient {
  constructor(
    readonly baseUrl: string,
    readonly headers: () => MaybePromise<Record<string, string>>,
  ) {}

  async fetch<Body>(
    path: string,
    options: FetchOptions<Body>,
  ): Promise<TypedResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        ...(await this.headers()),
        ...options.headers,
        ...(options.body?.type === "form-urlencoded" && {
          "Content-Type": "application/x-www-form-urlencoded",
        }),
        ...(options.body?.type === "json" && {
          "Content-Type": "application/json",
        }),
      },
      method: options.method,
      body:
        options.body?.type === "json"
          ? JSON.stringify(options.body.value)
          : options.body?.type === "form"
            ? options.body.value
            : options.body?.type === "form-urlencoded"
              ? new URLSearchParams(options.body.value)
              : undefined,
    });
    return response as TypedResponse;
  }
}
