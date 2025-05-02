import { Resource, ResourceStub } from "../../resource";
import type { BundleFileProperties } from "../../resources/bundle/bundle-file";
import { BundleFile } from "../../resources/bundle/bundle-file";
import type { DurableObjectNamespaceProperties } from "../../resources/durable-object-namespace";
import DurableObjectNamespace from "../../resources/durable-object-namespace";
import type { SerializableType } from "./common";

const serdeBundleFile: SerializableType<
  "bundle-file",
  BundleFile,
  BundleFileProperties
> = {
  kind: "bundle-file",
  serialize: (value) => ({
    name: value.name,
    hash: value.hash,
    kind: value.kind,
  }),
  deserialize: (value) => new BundleFile(value),
  match: (value) => value instanceof BundleFile,
};

const serdeResource: SerializableType<
  "resource",
  Resource<string, unknown, unknown>,
  { kind: string; name: string; input: unknown; dependencies: string[] }
> = {
  kind: "resource",
  serialize: (value) => ({
    kind: value.kind,
    name: value.name,
    input: value.input,
    dependencies: value.dependencies,
  }),
  deserialize: (value) => new ResourceStub(value),
  match: (value) => value instanceof Resource,
};

const serdeDurableObject: SerializableType<
  "durable-object",
  DurableObjectNamespace,
  DurableObjectNamespaceProperties
> = {
  kind: "durable-object",
  serialize: (value) => ({
    id: value.id,
    className: value.className,
    scriptName: value.scriptName,
    environment: value.environment,
    sqlite: value.sqlite,
    namespaceId: value.namespaceId,
  }),
  deserialize: (value) => new DurableObjectNamespace(value.id, value),
  match: (value) => value instanceof DurableObjectNamespace,
};

const serdeDate: SerializableType<"date", Date, string> = {
  kind: "date",
  serialize: (value) => value.toISOString(),
  deserialize: (value) => new Date(value),
  match: (value) => value instanceof Date,
};

const serdeMap: SerializableType<
  "map",
  Map<unknown, unknown>,
  Record<string, unknown>
> = {
  kind: "map",
  serialize: (value) => Object.fromEntries(value.entries()),
  deserialize: (value) => new Map(Object.entries(value)),
  match: (value) => value instanceof Map,
};

const serdeSet: SerializableType<"set", Set<unknown>, unknown[]> = {
  kind: "set",
  serialize: (value) => Array.from(value),
  deserialize: (value) => new Set(value),
  match: (value) => value instanceof Set,
};

const serdeUndefined: SerializableType<"undefined", undefined, null> = {
  kind: "undefined",
  serialize: () => null,
  deserialize: () => undefined,
  match: (value) => value === undefined,
};

export const serdeTypes = [
  serdeBundleFile,
  serdeDate,
  serdeMap,
  serdeSet,
  serdeUndefined,
  serdeResource,
  serdeDurableObject,
];
