import * as v from "valibot";
import { $cloudflare } from "~/core/app";
import { Resource } from "~/core/resource";

export interface WorkerURLInput {
  scriptName: string;
  enabled: boolean;
}

export interface WorkerURLOutput {
  url?: string;
}

export type WorkerURLProperties = Resource.CRUDProperties<
  WorkerURLInput,
  WorkerURLOutput,
  string
>;

export class WorkerURL extends Resource<WorkerURLProperties> {
  readonly kind = "cloudflare:worker:url";

  static get provider(): Resource.Provider<WorkerURLProperties> {
    return new WorkerURLProvider();
  }

  constructor(
    name: string,
    input: WorkerURLInput,
    metadata?: Resource.Metadata,
  ) {
    super(WorkerURL.provider, name, input, metadata);
  }
}

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
      if (state.output.url) {
        console.log(`[${input.scriptName}] URL: ${state.output.url}`);
      }
      return "none";
    }
    return "update";
  }

  async update(input: Resource.Input<WorkerURLProperties>) {
    const [subdomain] = await Promise.all([
      input.enabled ? this.getSubdomain() : undefined,
      this.put(input),
    ]);
    if (subdomain) {
      const url = `https://${input.scriptName}.${subdomain}.workers.dev`;
      console.log(`[${input.scriptName}] URL: ${url}`);
      return {
        url,
      };
    }
    return {};
  }

  async delete(state: Resource.State<WorkerURLProperties>) {
    await this.put({
      scriptName: state.input.scriptName,
      enabled: false,
    });
  }

  private async getSubdomain() {
    const res = await $cloudflare.get(
      `/accounts/${$cloudflare.accountId}/workers/subdomain`,
      {
        responseSchema: v.object({
          subdomain: v.string(),
        }),
      },
    );
    return res.subdomain;
  }

  private async put(input: WorkerURLInput): Promise<void> {
    await $cloudflare.post(
      `/accounts/${$cloudflare.accountId}/workers/scripts/${input.scriptName}/subdomain`,
      {
        body: {
          type: "json",
          value: input.enabled
            ? { enabled: true, previews_enabled: true }
            : { enabled: false },
        },
        responseSchema: v.union([
          v.object({
            enabled: v.boolean(),
            previews_enabled: v.boolean(),
          }),
          v.null(),
        ]),
      },
    );
  }
}
