import { Config, Effect, Schema } from "effect";

export const R2BucketOptions = Schema.mutable(
  Schema.Struct({
    name: Schema.optional(Schema.String),
    locationHint: Schema.optional(
      Schema.Literal("apac", "eeur", "enam", "weur", "wnam", "oc")
    ),
    storageClass: Schema.optional(
      Schema.Literal("Standard", "InfrequentAccess")
    ),
    jurisdiction: Schema.optional(Schema.Literal("default", "eu", "fedramp")),
  })
);
export type R2BucketOptions = typeof R2BucketOptions.Type;

export const R2BucketState = Schema.Struct({
  name: Schema.String,
  creation_date: Schema.String,
  location: Schema.optional(
    Schema.Literal("apac", "eeur", "enam", "weur", "wnam", "oc")
  ),
  storage_class: Schema.optional(
    Schema.Literal("Standard", "InfrequentAccess")
  ),
});
export type R2BucketState = typeof R2BucketState.Type;

const fetch = Effect.gen(function* () {});

const createR2Bucket = (options: R2BucketOptions) =>
  Effect.gen(function* () {});
