import { okAsync, type ResultAsync } from "neverthrow";
import { z } from "zod";
import { cfFetchAccount } from "../cloudflare/account";
import { Component, type ComponentAction } from "../component";
import { useCF } from "../app";

const R2BucketStorageClass = z.enum(["Standard", "InfrequentAccess"]);
const R2BucketJurisdiction = z.enum(["default", "eu", "fedramp"]);
const R2BucketLocation = z.enum(["APAC", "EEUR", "ENAM", "WEUR", "WNAM", "OC"]);

export const R2BucketInput = z.object({
  name: z.string(),
  locationHint: R2BucketLocation.optional(),
  storageClass: R2BucketStorageClass.optional(),
  jurisdiction: R2BucketJurisdiction.optional(),
});
export type R2BucketInput = z.infer<typeof R2BucketInput>;
type R2BucketRawInput = Omit<R2BucketInput, "name"> & { name?: string };

export const R2BucketState = z.object({
  name: z.string(),
  creation_date: z.string(),
  location: R2BucketLocation.optional(),
  storage_class: R2BucketStorageClass.optional(),
});
export type R2BucketState = z.infer<typeof R2BucketState>;

export class R2Bucket extends Component<
  "R2Bucket",
  R2BucketState,
  R2BucketInput,
  R2BucketRawInput
> {
  readonly kind = "R2Bucket";

  constructor(id: string, props: R2BucketRawInput = {}) {
    super(id, props);
  }

  normalizeInput(id: string, props: R2BucketRawInput): R2BucketInput {
    return R2BucketInput.parse({
      name: props.name ?? id,
      locationHint: props.locationHint,
      storageClass: props.storageClass,
      jurisdiction: props.jurisdiction,
    });
  }

  async plan(phase: "up" | "down"): Promise<ComponentAction | null> {
    switch (phase) {
      case "up": {
        if (!this.state) {
          return "create";
        }
        if (
          this.input.name !== this.state.output.name ||
          this.input.locationHint !== this.state.output.location ||
          this.input.storageClass !== this.state.output.storage_class ||
          this.input.jurisdiction !== this.state.input.jurisdiction
        ) {
          return "replace";
        }
        return null;
      }
      case "down": {
        return this.state ? "delete" : null;
      }
    }
  }

  create(): ResultAsync<void, Error> {
    return useCF()
      .fetchWithAccount({
        method: "POST",
        path: `/r2/buckets`,
        body: {
          format: "json",
          data: {
            name: this.input.name,
            locationHint: this.input.locationHint,
            storageClass: this.input.storageClass,
          },
        },
        responseSchema: R2BucketState,
      })
      .andThen((state) => {
        this.setState(state);
        return okAsync();
      });
  }

  delete(): ResultAsync<void, Error> {
    return useCF()
      .fetchWithAccount({
        method: "DELETE",
        path: `/r2/buckets/${this.input.name}`,
        responseSchema: z.any(),
      })
      .andThen(() => {
        this.setState(null);
        return okAsync();
      });
  }
}
