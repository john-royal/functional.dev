type TypedResponse = Omit<Response, "json"> & {
  json<T>(): Promise<T>;
};

interface JsonBody<T> {
  type: "json";
  value: T;
}

interface FormDataBody {
  type: "form";
  value: FormData;
}

interface FormUrlEncodedBody {
  type: "form-urlencoded";
  value: Record<string, string>;
}

interface FetchOptions<T> {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: JsonBody<T> | FormDataBody | FormUrlEncodedBody;
}

class ApiClient {
  constructor(
    readonly baseUrl: string,
    readonly headers: Record<string, string>,
  ) {}

  async fetch<Body>(
    path: string,
    options: FetchOptions<Body>,
  ): Promise<TypedResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        ...this.headers,
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

class CloudflareClient {
  api: ApiClient;
  accountId = "";

  constructor() {
    this.api = new ApiClient("https://api.cloudflare.com/client/v4", {});
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

export const cloudflareApi = new CloudflareClient();

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
