import * as superjson from "superjson";
import { BundleFile, type BundleFileProperties } from "~/bundle/bundle-file";
import {
  DurableObjectNamespace,
  type DurableObjectNamespaceProperties,
} from "~/cloudflare/durable-object-namespace";
import { $app } from "~/core/app";
import { Secret } from "~/secret";
import type { Encrypted } from "./encryption";

superjson.registerCustom(
  {
    isApplicable: (value: unknown) => value instanceof DurableObjectNamespace,
    serialize: (value: DurableObjectNamespace) =>
      DurableObjectNamespace.toJSON(value),
    deserialize: (value: DurableObjectNamespaceProperties) =>
      new DurableObjectNamespace(value.id, value),
  },
  "DurableObjectNamespace",
);

superjson.registerCustom(
  {
    isApplicable: (value: unknown) => value instanceof BundleFile,
    serialize: (value: BundleFile) => value.toJSON(),
    deserialize: (value: BundleFileProperties) => new BundleFile(value),
  },
  "BundleFile",
);

superjson.registerCustom(
  {
    isApplicable: (value: unknown) => value instanceof Secret,
    serialize: (value: Secret) => $app.encrypt(value.value),
    deserialize: (value: Encrypted) => new Secret($app.decrypt(value)),
  },
  "Secret",
);

export * from "superjson";
