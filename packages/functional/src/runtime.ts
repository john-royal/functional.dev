import { FetchHttpClient } from "@effect/platform";
import { Layer, Effect } from "effect";
import { Store, StoreLive } from "./store";

export const runtime = Layer.provideMerge(
  Layer.succeed(Store, StoreLive),
  FetchHttpClient.layer
);
