import * as superjson from "superjson";
import {
  BundleFile,
  type BundleFileProperties,
} from "~/resources/bundle/bundle-file";
import DurableObjectNamespace, {
  type DurableObjectNamespaceProperties,
} from "~/resources/durable-object-namespace";

superjson.registerCustom(
  {
    isApplicable: (value: unknown) => value instanceof DurableObjectNamespace,
    serialize: (value: DurableObjectNamespace) => value.toJSON(),
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
