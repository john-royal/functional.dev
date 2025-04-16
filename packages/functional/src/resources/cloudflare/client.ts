import { HttpClient, HttpClientResponse } from "@effect/platform";
import type { HttpClientError } from "@effect/platform/HttpClientError";
import { Effect, Schema } from "effect";
import type { ParseError } from "effect/ParseResult";

interface ICloudflareClient {
  accounts: {
    list: APIEffect<(typeof Account)["Type"][]>;
  };
}

class APIError {
  readonly _tag = "APIError";

  constructor(readonly errors: readonly (typeof Message)["Type"][]) {}
}

const Message = Schema.Struct({
  code: Schema.Number,
  message: Schema.String,
});

const Account = Schema.Struct({
  id: Schema.String,
});

type APIEffect<T> = Effect.Effect<
  T,
  HttpClientError | ParseError | APIError,
  never
>;

const Envelope = <T extends Schema.Schema.All>(result: T) => {
  return Schema.Union(
    Schema.Struct({
      success: Schema.Literal(true),
      errors: Schema.Array(Message),
      messages: Schema.Array(Message),
      result,
    }),
    Schema.Struct({
      success: Schema.Literal(false),
      errors: Schema.Array(Message),
      messages: Schema.Array(Message),
      result: Schema.Null,
    })
  );
};

export class CloudflareClient extends Effect.Service<ICloudflareClient>()(
  "CloudflareClient",
  {
    effect: Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;

      return {
        accounts: {
          list: client
            .get("https://api.cloudflare.com/client/v4/accounts")
            .pipe(
              Effect.flatMap(
                HttpClientResponse.schemaBodyJson(
                  Envelope(Schema.Array(Account))
                )
              ),
              Effect.flatMap((res) => {
                if (res.success) {
                  return Effect.succeed(res.result);
                }
                return Effect.fail(new APIError(res.errors));
              })
            ),
        },
      };
    }),
  }
) {}
