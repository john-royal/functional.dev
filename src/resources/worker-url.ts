import { cloudflareApi } from "../providers/cloudflare";
import type { CloudflareResponse } from "../providers/cloudflare";
import { Resource } from "../resource";

export interface WorkerURLInput {
  scriptName: string;
  enabled: boolean;
}

export interface WorkerURLOutput {
  url?: string;
}

export default class WorkerURL extends Resource<
  "worker-url",
  WorkerURLInput,
  WorkerURLOutput
> {
  readonly kind = "worker-url";

  async run(
    context: Resource.Context<WorkerURLInput, WorkerURLOutput>,
  ): Promise<Resource.Action<WorkerURLOutput>> {
    if (context.status === "delete") {
      return {
        status: "delete",
        apply: async () => {
          await this.put({
            scriptName: context.input.scriptName,
            enabled: false,
          });
        },
      };
    }
    if (this.input.enabled === !!context.output?.url) {
      return {
        status: "none",
      };
    }
    return {
      status: context.status === "create" ? "create" : "update",
      apply: async () => {
        await this.put(this.input);
        if (this.input.enabled) {
          const subdomain = await this.getSubdomain();
          const url = `https://${this.input.scriptName}.${subdomain}.workers.dev`;
          console.log(`Worker URL: ${url}`);
          return {
            url,
          };
        }
        return {
          url: undefined,
        };
      },
    };
  }

  private async getSubdomain() {
    const res = await cloudflareApi.get(
      `/accounts/${cloudflareApi.accountId}/workers/subdomain`,
    );
    const json = await res.json<CloudflareResponse<{ subdomain: string }>>();
    if (!res.ok || !json.success) {
      throw new Error(json.errors[0]?.message ?? "Unknown error");
    }
    return json.result.subdomain;
  }

  private async put(input: WorkerURLInput): Promise<void> {
    const res = await cloudflareApi.post(
      `/accounts/${cloudflareApi.accountId}/workers/scripts/${input.scriptName}/subdomain`,
      {
        body: {
          type: "json",
          value: input.enabled
            ? { enabled: true, previews_enabled: true }
            : { enabled: false },
        },
      },
    );
    const json = await res.json<CloudflareResponse<WorkerURLOutput | null>>();
    if (!res.ok || !json.success) {
      throw new Error(json.errors[0]?.message ?? "Unknown error");
    }
  }
}
