import { okAsync } from "neverthrow";
import { z } from "zod";
import { $cf } from "../app";
import { Component, type ResourceProvider } from "../resource";
import type { MakeOptional } from "../lib/utils";

const R2BucketStorageClass = z.enum(["Standard", "InfrequentAccess"]);
const R2BucketJurisdiction = z.enum(["default", "eu", "fedramp"]);
const R2BucketLocation = z.enum(["APAC", "EEUR", "ENAM", "WEUR", "WNAM", "OC"]);

export const R2BucketInput = z.object({
  name: z
    .string()
    .min(3)
    .max(64)
    .transform((name) => name.toLowerCase().replace(/[^a-z0-9]/g, "-")),
  locationHint: R2BucketLocation.optional(),
  storageClass: R2BucketStorageClass.optional(),
  jurisdiction: R2BucketJurisdiction.optional(),
});
export type R2BucketInput = z.infer<typeof R2BucketInput>;

export const R2BucketState = z.object({
  name: z.string(),
  creation_date: z.string(),
  location: R2BucketLocation.optional(),
  storage_class: R2BucketStorageClass.optional(),
});
export type R2BucketState = z.infer<typeof R2BucketState>;

export const provider = {
  create: (input) => {
    return $cf
      .fetchWithAccount({
        method: "POST",
        path: "/r2/buckets",
        headers: {
          "cf-r2-jurisdiction": input.jurisdiction ?? "default",
        },
        body: {
          format: "json",
          data: {
            name: input.name,
            locationHint: input.locationHint,
            storageClass: input.storageClass,
          },
        },
        responseSchema: R2BucketState,
      })
      .map((state) => ({
        id: state.name,
        state,
      }));
  },
  read: (id) => {
    return $cf.fetchWithAccount({
      method: "GET",
      path: `/r2/buckets/${id}`,
      responseSchema: R2BucketState,
    });
  },
  diff: (props, current) => {
    return okAsync({
      action: Bun.deepEquals(props, current.props) ? "noop" : "replace",
    });
  },
  delete: ({ state }) => {
    return $cf
      .fetchWithAccount({
        method: "DELETE",
        path: `/r2/buckets/${state.name}`,
        responseSchema: z.unknown(),
      })
      .map(() => undefined);
  },
} satisfies ResourceProvider<R2BucketInput, R2BucketState>;

export class R2Bucket extends Component<R2BucketInput, R2BucketState> {
  constructor(name: string, props: MakeOptional<R2BucketInput, "name"> = {}) {
    super(provider, name, (id) =>
      R2BucketInput.parse({
        name: props.name ?? id,
        ...props,
      })
    );
  }
}
