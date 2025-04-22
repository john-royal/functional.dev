import { Schema, Console } from "effect";
import { Effect } from "effect";
import { cfFetch } from "./fetch";
import { Store } from "../store";
import { HttpBody } from "@effect/platform";

export const CloudflareAccount = Effect.gen(function* () {
  const store = yield* Store;
  const cached = yield* store.get<{
    readonly id: string;
    readonly name: string;
  }>("cloudflare-account");
  if (cached) return cached;
  const account = yield* cfFetch(
    "GET",
    "/accounts",
    Schema.Array(Schema.Struct({ id: Schema.String, name: Schema.String }))
  ).pipe(
    Effect.flatMap((accounts) => {
      if (accounts[0]) return Effect.succeed(accounts[0]);
      return Effect.dieMessage("No account found");
    }),
    Effect.tap((account) => store.set("cloudflare-account", account))
  );
  return account;
  // return cached ?? cfFetch(
  //     Effect.catchTag("NotFound", () =>
  //       cfFetch(
  //         "GET",
  //         "/accounts",
  //         Schema.Array(
  //           Schema.Struct({
  //             id: Schema.String,
  //             name: Schema.String,
  //           })
  //         )
  //       ).pipe(
  //         Effect.flatMap((accounts) => {
  //           if (accounts[0]) return Effect.succeed(accounts[0]);
  //           return Effect.dieMessage("No account found");
  //         }),
  //         Effect.tap((account) => store.set("cloudflare-account", account))
  //       )
  //     )
  //   );
});
