export interface SerializableType<
  TKind extends string,
  TValue,
  TSerializedValue,
> {
  kind: TKind;
  serialize: (value: TValue) => TSerializedValue;
  deserialize: (value: TSerializedValue) => TValue;
  match: (value: unknown) => value is TValue;
}

// biome-ignore lint/suspicious/noExplicitAny: easiest way to handle unknown types here
export type AnySerializableType = SerializableType<string, any, any>;
