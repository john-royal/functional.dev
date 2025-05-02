import type { BundleFileProperties } from "../../resources/bundle/bundle-file";
import { BundleFile } from "../../resources/bundle/bundle-file";
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
];
