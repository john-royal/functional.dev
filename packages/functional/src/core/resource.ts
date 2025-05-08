import type { UnsetMarker } from "~/lib/types";
import { $app } from "./app";

export type AnyResource = Resource<Resource.Properties>;

export abstract class Resource<T extends Resource.Properties> {
  abstract readonly kind: string;

  // biome-ignore lint/suspicious/noExplicitAny: required for derived class output type to satisfy Resource.Provider
  static get provider(): Resource.Provider<any> {
    throw new Error("Not implemented");
  }

  constructor(
    readonly provider: Resource.Provider<T>,
    readonly name: string,
    readonly input: T["input"]["in"],
    readonly metadata: Resource.Metadata = {
      dependsOn: [],
    },
  ) {
    $app.register(this);
  }

  getDerivedInput(): Promise<T["input"]["out"]> {
    return Promise.resolve(this.input as T["input"]["out"]);
  }

  getDerivedOutput(output: T["output"]["in"]): Promise<T["output"]["out"]> {
    return Promise.resolve(output as T["output"]["out"]);
  }
}

export namespace Resource {
  export interface Properties {
    provider: string;
    kind: string;
    name: string;
    input: {
      in: unknown;
      out: unknown;
    };
    output: {
      providerId: unknown;
      in: unknown;
      out: unknown;
    };
    dependencies: string[];
    dependents: string[];
    createdAt: number;
    updatedAt: number;
  }

  export interface CRUDProperties<TInput, TOutput, TID = UnsetMarker>
    extends Properties {
    input: { in: TInput; out: TInput };
    output: { providerId: TID; in: TOutput; out: TOutput };
  }

  export interface Provider<T extends Properties> {
    create: (input: Input<T>) => Promise<CreateResult<T>>;
    read?: (providerId: T["output"]["providerId"]) => Promise<Output<T>>;
    diff: (input: Input<T>, state: State<T>) => Promise<Diff>;
    update?: (input: Input<T>, state: State<T>) => Promise<Output<T>>;
    delete?: (state: State<T>) => Promise<void>;
    dev?: (input: Input<T>) => Promise<unknown>;
  }
  type WithProviderID<
    T extends Properties,
    U,
  > = T["output"]["providerId"] extends UnsetMarker
    ? U & {
        providerId?: undefined;
      }
    : U & {
        providerId: T["output"]["providerId"];
      };

  export type CreateResult<T extends Properties> = WithProviderID<
    T,
    {
      output: T["output"]["in"];
    }
  >;

  export type State<T extends Properties> = WithProviderID<
    T,
    {
      input: T["input"]["out"];
      output: T["output"]["in"];
    }
  >;

  export type Output<T extends Properties> = T["output"]["in"];

  export type Input<T extends Properties> = T["input"]["out"];

  export type Diff = "update" | "replace" | "none";

  export interface Metadata {
    dependsOn: string[];
  }
}
