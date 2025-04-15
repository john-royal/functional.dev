import * as w from "wrangler";

type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};

export type WranglerConfig = Simplify<w.Unstable_RawConfig>;
