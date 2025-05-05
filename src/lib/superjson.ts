import * as superjson from "superjson";
import {
  BundleFile,
  type BundleFileProperties,
} from "~/resources/bundle/bundle-file";
import DurableObjectNamespace from "~/resources/durable-object-namespace";

superjson.registerCustom(
  {
    isApplicable: (value: unknown) => value instanceof DurableObjectNamespace,
    serialize: (value: DurableObjectNamespace) => ({
      id: value.id,
      className: value.className,
      scriptName: value.scriptName,
      environment: value.environment,
      sqlite: value.sqlite,
      namespaceId: value.namespaceId,
    }),
    deserialize: (value: {
      id: string;
      className: string;
      scriptName?: string;
      environment?: string;
      sqlite?: boolean;
      namespaceId?: string;
    }) => new DurableObjectNamespace(value.id, value),
  },
  "DurableObjectNamespace",
);

superjson.registerCustom(
  {
    isApplicable: (value: unknown) => value instanceof BundleFile,
    serialize: (value: BundleFile) => ({
      name: value.name,
      hash: value.hash,
      kind: value.kind,
    }),
    deserialize: (value: BundleFileProperties) => new BundleFile(value),
  },
  "BundleFile",
);

export * from "superjson";
