import * as superjson from "superjson";
import { BundleFile, type BundleFileProperties } from "~/bundle/bundle-file";
import {
  DurableObjectNamespace,
  type DurableObjectNamespaceProperties,
} from "~/cloudflare/durable-object-namespace";

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

export * from "superjson";
