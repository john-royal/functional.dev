import { Config, Console, Effect, pipe, Schema } from "effect";
import { getWranglerAccessToken } from "./oauth";

const CloudflareAuth = pipe(
  Config.string("CLOUDFLARE_API_TOKEN").pipe(
    Config.map((token) => ({
      Authorization: `Bearer ${token}`,
    }))
  ),
  Config.orElse(() =>
    Config.all([
      Config.string("CLOUDFLARE_API_KEY"),
      Config.string("CLOUDFLARE_EMAIL"),
    ]).pipe(
      Config.map(([apiKey, email]) => ({
        "X-Auth-Key": apiKey,
        "X-Auth-Email": email,
      }))
    )
  ),
  Effect.catchTag("ConfigError", () =>
    getWranglerAccessToken.pipe(
      Effect.map((token) => ({
        Authorization: `Bearer ${token}`,
      }))
    )
  )
);

const CloudflareMessage = Schema.Struct({
  code: Schema.Number,
  message: Schema.String,
});

const CloudflareResponse = <Result extends Schema.Struct.Field>(
  result: Result
) =>
  Schema.Union(
    Schema.Struct({
      success: Schema.Literal(true),
      errors: Schema.Array(CloudflareMessage),
      messages: Schema.Array(CloudflareMessage),
      result,
    }),
    Schema.Struct({
      success: Schema.Literal(false),
      errors: Schema.Array(CloudflareMessage),
      messages: Schema.Array(CloudflareMessage),
    })
  );

const accountId = Config.string("CLOUDFLARE_ACCOUNT_ID").pipe(
  Effect.catchTag("ConfigError", () =>
    CloudflareAuth.pipe(
      Effect.flatMap((auth) =>
        Effect.tryPromise({
          try: () =>
            fetch("https://api.cloudflare.com/client/v4/accounts", {
              headers: auth,
            }).then((res) => res.json()),
          catch: (e) => e,
        }).pipe(
          Effect.flatMap(
            Schema.decodeUnknown(
              CloudflareResponse(
                Schema.Array(Schema.Struct({ id: Schema.String }))
              ),
              { onExcessProperty: "preserve" }
            )
          ),
          Effect.flatMap((res) => {
            if (res.success && res.result[0]) {
              return Effect.succeed(res.result[0].id);
            }
            return Effect.fail(res.errors);
          })
        )
      )
    )
  )
);

const Program = Effect.gen(function* () {
  const auth = yield* CloudflareAuth;
  const a = yield* accountId;
  return { auth, a };
});

Effect.runPromise(Program).then(console.log).catch(console.error);
