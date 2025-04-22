import { FetchHttpClient, HttpBody, HttpClient } from "@effect/platform";
import { Console, Effect, pipe, Layer, Schema } from "effect";
import { CloudflareAccount } from "./cloudflare/account";
import { cfFetch } from "./cloudflare/fetch";
import { Store, StoreLive } from "./store";
import { runtime } from "./runtime";
import { toMillis } from "effect/Duration";

const R2BucketStorageClass = Schema.Literal("Standard", "InfrequentAccess");
const R2BucketJurisdiction = Schema.Literal("default", "eu", "fedramp");
const R2BucketLocation = Schema.Literal(
  "APAC",
  "EEUR",
  "ENAM",
  "WEUR",
  "WNAM",
  "OC"
);

export const R2BucketProps = Schema.Struct({
  name: Schema.optional(Schema.String),
  locationHint: Schema.optional(R2BucketLocation),
  storageClass: Schema.optional(R2BucketStorageClass),
  jurisdiction: Schema.optional(R2BucketJurisdiction),
});
export type R2BucketProps = typeof R2BucketProps.Type;

export const R2BucketState = Schema.Struct({
  name: Schema.String,
  creation_date: Schema.String,
  location: Schema.optional(R2BucketLocation),
  storage_class: Schema.optional(R2BucketStorageClass),
});
export type R2BucketState = typeof R2BucketState.Type;

export const R2Bucket = (props: R2BucketProps) =>
  Effect.gen(function* () {
    const store = yield* Store;
    const account = yield* Effect.timed(CloudflareAccount).pipe(
      Effect.tap(([duration, account]) =>
        Console.log(`Cloudflare account fetched in`, duration.toString())
      ),
      Effect.map(([_, account]) => account)
    );
    const cached = yield* store.get<R2BucketState>("cloudflare-r2-bucket");
    if (cached) {
      Console.log("Using cached bucket");
      yield* cfFetch(
        "DELETE",
        `/accounts/${account.id}/r2/buckets/${cached.name}`,
        Schema.Any
      );
      yield* store.set("cloudflare-r2-bucket", undefined);
      return cached;
    }
    const bucket = yield* cfFetch(
      "POST",
      `/accounts/${account.id}/r2/buckets`,
      R2BucketState,
      HttpBody.unsafeJson(props)
    ).pipe(Effect.tap((bucket) => store.set("cloudflare-r2-bucket", bucket)));
    return bucket;
  });

console.time("program");
Effect.gen(function* () {
  const [duration, account] = yield* Effect.timed(CloudflareAccount);
  console.log(`Cloudflare account fetched in`, toMillis(duration));
  return account;
})
  .pipe(Effect.provide(runtime), Effect.runPromise)
  .then((exit) => {
    console.timeEnd("program");
    // console.log(exit);
  })
  .catch((error) => {
    console.error(error);
  });
