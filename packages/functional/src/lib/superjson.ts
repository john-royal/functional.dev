import * as superjson from "superjson";
import { BundleFile, type BundleFileProperties } from "~/bundle/bundle-file";
import {
  DurableObjectNamespace,
  type DurableObjectNamespaceProperties,
} from "~/cloudflare/durable-object-namespace";
import { $app } from "~/core/app";
import { type EncryptedValue, SecretString } from "./secret";

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
    isApplicable: (value: unknown) => value instanceof SecretString,
    serialize: (value: SecretString) => value.encrypt($app.key),
    deserialize: (value: EncryptedValue) => SecretString.from(value, $app.key),
  },
  "SecretString",
);

export * from "superjson";
