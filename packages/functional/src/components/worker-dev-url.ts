import { okAsync, type ResultAsync } from "neverthrow";
import type { CFClient } from "../cloudflare/client";
import type { CFError } from "../cloudflare/error";
import {
  ResourceComponent,
  type ResourceDiff,
  type ResourceProvider,
  type ResourceState,
} from "../providers/provider";
import z from "zod";
import type { Scope } from "../scope";

interface WorkerURLInput {
  scriptName: string;
  enabled: boolean;
}

const WorkerURLOutput = z.object({
  enabled: z.boolean(),
  previews_enabled: z.boolean(),
});
type WorkerURLOutput = z.infer<typeof WorkerURLOutput>;

export class WorkerURLProvider
  implements ResourceProvider<WorkerURLInput, WorkerURLOutput, CFError>
{
  constructor(readonly client: CFClient) {}

  create(input: WorkerURLInput): ResultAsync<WorkerURLOutput, CFError> {
    return this.put(input);
  }

  diff(
    state: ResourceState<WorkerURLInput, WorkerURLOutput>,
    input: WorkerURLInput
  ): ResultAsync<ResourceDiff, CFError> {
    return okAsync(Bun.deepEquals(state.input, input) ? "noop" : "update");
  }

  update(
    _: ResourceState<WorkerURLInput, WorkerURLOutput>,
    input: WorkerURLInput
  ): ResultAsync<WorkerURLOutput, CFError> {
    return this.put(input);
  }

  delete(state: ResourceState<WorkerURLInput, WorkerURLOutput>) {
    return this.put({
      scriptName: state.input.scriptName,
      enabled: false,
    }).map(() => undefined);
  }

  private put(input: WorkerURLInput): ResultAsync<WorkerURLOutput, CFError> {
    return this.client.fetchWithAccount({
      method: "POST",
      path: `/workers/scripts/${input.scriptName}/subdomain`,
      body: {
        format: "json",
        data: input.enabled
          ? { enabled: true, previews_enabled: true }
          : { enabled: false },
      },
      responseSchema: WorkerURLOutput,
    });
  }
}

export class WorkerURL extends ResourceComponent<
  WorkerURLInput,
  WorkerURLOutput,
  CFError
> {
  constructor(scope: Scope, name: string, input: WorkerURLInput) {
    super(scope, new WorkerURLProvider(scope.client), name, input);
  }
}
