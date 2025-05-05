import z from "zod";
import { Resource } from "../../core/resource";
import { cloudflareApi } from "../../providers/cloudflare";

export interface WorkerURLInput {
  scriptName: string;
  enabled: boolean;
}

export interface WorkerURLOutput {
  url?: string;
}

export type WorkerURLProperties = Resource.CRUDProperties<
  string,
  WorkerURLInput,
  WorkerURLOutput
>;

export class WorkerURLProvider
  implements Resource.Provider<WorkerURLProperties>
{
  async create(input: Resource.Input<WorkerURLProperties>) {
    return {
      providerId: input.scriptName,
      output: await this.update(input),
    };
  }

  async diff(
    input: Resource.Input<WorkerURLProperties>,
    state: Resource.State<WorkerURLProperties>,
  ): Promise<Resource.Diff> {
    if (Bun.deepEquals(input, state.input)) {
      return "none";
    }
    return "update";
  }

  async update(input: Resource.Input<WorkerURLProperties>) {
    const [subdomain] = await Promise.all([
      input.enabled ? this.getSubdomain() : undefined,
      this.put(input),
    ]);
    return {
      url: subdomain
        ? `https://${input.scriptName}.${subdomain}.workers.dev`
        : undefined,
    };
  }

  async delete(state: Resource.State<WorkerURLProperties>) {
    await this.put({
      scriptName: state.input.scriptName,
      enabled: false,
    });
  }

  private async getSubdomain() {
    const res = await cloudflareApi.get(
      `/accounts/${cloudflareApi.accountId}/workers/subdomain`,
      {
        responseSchema: z.object({
          subdomain: z.string(),
        }),
      },
    );
    return res.subdomain;
  }

  private async put(input: WorkerURLInput): Promise<void> {
    await cloudflareApi.post(
      `/accounts/${cloudflareApi.accountId}/workers/scripts/${input.scriptName}/subdomain`,
      {
        body: {
          type: "json",
          value: input.enabled
            ? { enabled: true, previews_enabled: true }
            : { enabled: false },
        },
        responseSchema: z.union([
          z.object({
            enabled: z.boolean(),
            previews_enabled: z.boolean(),
          }),
          z.null(),
        ]),
      },
    );
  }
}

export class WorkerURL extends Resource<WorkerURLProperties> {
  readonly kind = "cloudflare:worker:url";

  constructor(
    name: string,
    input: WorkerURLInput,
    metadata?: Resource.Metadata,
  ) {
    super(new WorkerURLProvider(), name, input, metadata);
  }
}
