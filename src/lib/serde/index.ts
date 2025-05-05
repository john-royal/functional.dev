import type { AnySerializableType } from "./common";
import { serdeTypes } from "./types";

export class Serde {
  constructor(readonly types: AnySerializableType[]) {}

  serialize = (value: unknown): unknown => {
    if (this.isJSONPrimitive(value)) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((value) => this.serialize(value));
    }
    if (this.isJSONObject(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, value]) => [
          key,
          this.serialize(value),
        ]),
      );
    }
    const type = this.types.find((type) => type.match(value));
    if (!type) {
      throw new Error(`Unknown type: ${JSON.stringify(value)}`);
    }
    return {
      "~kind": type.kind,
      "~value": this.serialize(type.serialize(value)),
    };
  };

  deserialize<T>(value: unknown): T {
    if (this.isSerializedType(value)) {
      const type = this.types.find((type) => type.kind === value["~kind"]);
      if (!type) {
        throw new Error(`Unknown type: ${value["~kind"]}`);
      }
      return type.deserialize(this.deserialize(value["~value"]));
    }
    if (Array.isArray(value)) {
      return value.map((value) => this.deserialize(value)) as T;
    }
    if (this.isJSONObject(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, value]) => [
          key,
          this.deserialize(value),
        ]),
      ) as T;
    }
    return value as T;
  }

  private isSerializedType(
    value: unknown,
  ): value is { "~kind": string; "~value": unknown } {
    return (
      typeof value === "object" &&
      value !== null &&
      "~kind" in value &&
      "~value" in value
    );
  }

  private isJSONPrimitive(
    value: unknown,
  ): value is string | number | boolean | null {
    return (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    );
  }

  private isJSONObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === "object" &&
      value !== null &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }
}

export const serde = new Serde(serdeTypes);
