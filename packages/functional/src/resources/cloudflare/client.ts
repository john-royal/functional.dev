import { FetchHttpClient, HttpClient } from "@effect/platform";
import { formData } from "@effect/platform/HttpBody";
import type { HttpClientError } from "@effect/platform/HttpClientError";
import type { HttpIncomingMessage } from "@effect/platform/HttpIncomingMessage";
import type Cloudflare from "cloudflare";
import { Context, Effect, Layer, pipe, Schema } from "effect";
import type { ParseError } from "effect/ParseResult";

const Script = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  script: Schema.String,
  created_at: Schema.String,
  updated_at: Schema.String,
});

interface ICloudflareClient {
  accounts: {
    list: APIEffect<(typeof Account)["Type"][]>;
  };
  workers: {
    scripts: {
      list: (accountId: string) => APIEffect<(typeof Script)["Type"][]>;
    };
  };
}

class CloudflareError {
  readonly _tag = "CloudflareError";

  constructor(readonly errors: readonly (typeof Message)["Type"][]) {}
}

const Message = Schema.Struct({
  code: Schema.Number,
  message: Schema.String,
});
type Message = (typeof Message)["Type"];

const Account = Schema.Struct({
  id: Schema.String,
});

type APIEffect<T> = Effect.Effect<
  T,
  HttpClientError | ParseError | CloudflareError,
  never
>;

const Envelope = <T extends Schema.Struct.Field>(result: T) => {
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
type Envelope<T extends Schema.Schema.All> = ReturnType<typeof Envelope<T>>;

class Config extends Context.Tag("Config")<
  Config,
  {
    readonly apiToken: string;
  }
>() {}

const withAccountId = Effect.gen(function* () {
  const client = yield* CloudflareClient;
  const accountId = yield* client.accounts.list.pipe(
    Effect.flatMap((accounts) => {
      if (accounts[0]) {
        return Effect.succeed(accounts[0].id);
      }
      return Effect.dieMessage("No account found");
    }),
    // TODO: Improve error handling
    Effect.catchAll((e) => Effect.die(e))
  );
  const workers = yield* client.workers.scripts.list(accountId);
  return { accountId, workers };
});

const transformResponse = <T, R>(schema: Schema.Schema<T, T, R>) => {
  const parse = Schema.decodeUnknown(Envelope(schema), {
    onExcessProperty: "preserve",
  });
  return <E>(self: HttpIncomingMessage<E>) =>
    pipe(
      Effect.flatMap(self.json, parse),
      Effect.flatMap((res) =>
        res.success
          ? Effect.succeed(res.result)
          : Effect.fail(new CloudflareError(res.errors))
      )
    );
};

export class CloudflareClient extends Effect.Service<ICloudflareClient>()(
  "CloudflareClient",
  {
    effect: Effect.gen(function* () {
      const { apiToken } = yield* Config;
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.mapRequestInput((req) => ({
          ...req,
          headers: {
            ...req.headers,
            Authorization: `Bearer ${apiToken}`,
          },
        }))
      );

      return {
        accounts: {
          list: client
            .get("https://api.cloudflare.com/client/v4/accounts")
            .pipe(Effect.flatMap(transformResponse(Schema.Array(Account)))),
        },
        workers: {
          scripts: {
            list: (accountId: string) =>
              client
                .get(
                  `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`
                )
                .pipe(
                  Effect.flatMap(transformResponse(Schema.Array(Schema.Any)))
                ),
            put: (props: {
              accountId: string;
              scriptId: string;
              metadata: Cloudflare.Workers.Scripts.ScriptUpdateParams.Metadata;
              entrypoint: {
                name: string;
                content: string;
              };
            }) => {
              const body = new FormData();
              body.append(
                "metadata",
                new Blob([JSON.stringify(props.metadata)], {
                  type: "application/json",
                })
              );
              body.append(
                props.entrypoint.name,
                new Blob([props.entrypoint.content], {
                  type: "application/javascript+module",
                }),
                props.entrypoint.name
              );
              client
                .put(
                  `https://api.cloudflare.com/client/v4/accounts/${props.accountId}/workers/scripts/${props.scriptId}`,
                  {
                    body: formData(body),
                  }
                )
                .pipe(Effect.flatMap(transformResponse(Schema.Any)));
            },
          },
        },
      };
    }),
  }
) {}

const LiveConfig = Layer.succeed(
  Config,
  Config.of({ apiToken: process.env.CLOUDFLARE_API_TOKEN! })
);
const LiveLayer = Layer.merge(LiveConfig, FetchHttpClient.layer);

Effect.runPromise(
  withAccountId.pipe(
    Effect.provide(CloudflareClient.Default),
    Effect.provide(LiveLayer)
  )
)
  .then((res) => console.dir(res, { depth: null }))
  .catch(console.error);
