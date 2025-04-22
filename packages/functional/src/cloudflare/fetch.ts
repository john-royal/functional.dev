import { Console, Effect, Schema } from "effect";
import {
  FetchHttpClient,
  HttpBody,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpMethod,
  Headers,
} from "@effect/platform";
import { AuthHeaders } from "./auth";

const CFMessage = Schema.Struct({
  code: Schema.Number,
  message: Schema.String,
});

const CFResponse = <T>(schema: Schema.Schema<T>) =>
  Schema.Union(
    Schema.Struct({
      success: Schema.Literal(false),
      errors: Schema.Array(CFMessage),
      messages: Schema.Array(CFMessage),
    }),
    Schema.Struct({
      success: Schema.Literal(true),
      errors: Schema.Array(CFMessage),
      messages: Schema.Array(CFMessage),
      result: schema,
    })
  );
type CFResponse<T> = ReturnType<typeof CFResponse<T>>["Type"];

export const cfFetch = <T>(
  method: HttpMethod.HttpMethod,
  path: `/${string}`,
  schema: Schema.Schema<T>,
  body: HttpBody.HttpBody = HttpBody.empty,
  headers: Headers.Input = Headers.empty
) =>
  Effect.gen(function* () {
    const auth = yield* AuthHeaders;
    const http = yield* HttpClient.HttpClient;
    const res = yield* HttpClientRequest.make(method)(path).pipe(
      HttpClientRequest.prependUrl("https://api.cloudflare.com/client/v4"),
      HttpClientRequest.setHeaders(auth),
      HttpClientRequest.setHeaders(headers),
      HttpClientRequest.setBody(body),
      http.execute,
      Effect.flatMap(
        HttpClientResponse.schemaBodyJson(CFResponse(schema), {
          onExcessProperty: "preserve",
        })
      ),
      Effect.tap(Console.log),

      Effect.flatMap((res) =>
        res.success ? Effect.succeed(res.result) : Effect.fail(res.errors)
      )
    );
    return res;
  });
