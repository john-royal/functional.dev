import { ok, okAsync, ResultAsync } from "neverthrow";
import assert from "node:assert";
import z from "zod";
import type { CFClient } from "../cloudflare/client";
import type { CFError } from "../cloudflare/error";
import type {
  Component,
  ResourceAction,
  ResourceDiff,
  ResourceProvider,
  ResourceState,
} from "../providers/provider";
import type { Scope } from "../scope";
import { type AssetInput } from "./assets";
import { Build, BuildError } from "./build";
import { WorkerAssets } from "./worker-assets";
import { WorkerURL } from "./worker-dev-url";
import { join } from "node:path";

export interface WorkerRawInput {
  path: string;
  assets?: AssetInput;
  url?: boolean;
}

const WorkerAssetsInput = z.object({
  jwt: z.string().optional(),
  config: z.object({
    _headers: z.string().optional(),
    _redirects: z.string().optional(),
    html_handling: z
      .enum([
        "auto-trailing-slash",
        "force-trailing-slash",
        "drop-trailing-slash",
        "none",
      ])
      .optional(),
    not_found_handling: z
      .enum(["none", "404-page", "single-page-application"])
      .optional(),
    run_worker_first: z.boolean().optional(),
    serve_directly: z.boolean().optional(),
  }),
});

const MigrationStep = z.object({
  deleted_classes: z.array(z.string()).optional(),
  new_classes: z.array(z.string()).optional(),
  new_sqlite_classes: z.array(z.string()).optional(),
  renamed_classes: z
    .array(
      z.object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .optional(),
  transferred_classes: z
    .array(
      z.object({
        from: z.string().optional(),
        from_script: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .optional(),
});

const SingleStepMigration = MigrationStep.extend({
  new_tag: z.string().optional(),
  old_tag: z.string().optional(),
});

const MultipleStepMigration = z.object({
  new_tag: z.string().optional(),
  old_tag: z.string().optional(),
  steps: z.array(SingleStepMigration),
});

const SmartPlacement = z.object({
  last_analyzed_at: z.string().optional(),
  mode: z.literal("smart").optional(),
  status: z
    .enum(["SUCCESS", "UNSUPPORTED_APPLICATION", "INSUFFICIENT_INVOCATIONS"])
    .optional(),
});

const ConsumerScript = z.object({
  service: z.string(),
  environment: z.string().optional(),
  namespace: z.string().optional(),
});

const WorkerMetadataInput = z.object({
  assets: WorkerAssetsInput.optional(),
  bindings: z.array(z.record(z.string(), z.string())).optional(),
  body_part: z.string().optional(),
  compatibility_date: z.string().optional(),
  compatibility_flags: z.array(z.string()).optional(),
  keep_assets: z.boolean().optional(),
  keep_bindings: z.array(z.string()).optional(),
  logpush: z.boolean().optional(),
  main_module: z.string().optional(),
  migrations: z.union([SingleStepMigration, MultipleStepMigration]).optional(),
  observability: z
    .object({
      enabled: z.boolean(),
      head_sampling_rate: z.number().optional(),
    })
    .optional(),
  placement: SmartPlacement.optional(),
  tags: z.array(z.string()).optional(),
  tail_consumers: z.array(ConsumerScript).optional(),
  usage_model: z.literal("standard").optional(),
});
type WorkerMetadataInput = z.infer<typeof WorkerMetadataInput>;

const WorkerInput = z.object({
  name: z.string(),
  metadata: WorkerMetadataInput,
  files: z.array(
    z.object({
      name: z.string(),
      content: z.string(),
      type: z.string(),
    })
  ),
});
type WorkerInput = z.infer<typeof WorkerInput>;

const WorkerOutput = z.object({
  id: z.string().optional(),
  created_on: z.string().optional(),
  etag: z.string().optional(),
  has_assets: z.boolean().optional(),
  has_modules: z.boolean().optional(),
  logpush: z.boolean().optional(),
  modified_on: z.string().optional(),
  placement: SmartPlacement.optional(),
  startup_time_ms: z.number().optional(),
  tail_consumers: z.array(ConsumerScript).nullable(),
  usage_model: z.literal("standard").optional(),
});
type WorkerOutput = z.infer<typeof WorkerOutput>;

class WorkerScriptProvider
  implements ResourceProvider<WorkerInput, WorkerOutput, Error>
{
  constructor(readonly client: CFClient) {}

  create(input: WorkerInput): ResultAsync<WorkerOutput, Error> {
    return this.putScript(input);
  }

  diff(
    state: ResourceState<WorkerInput, WorkerOutput>,
    input: WorkerInput
  ): ResultAsync<ResourceDiff, Error> {
    return okAsync(Bun.deepEquals(state.input, input) ? "noop" : "update");
  }

  update(
    _: ResourceState<WorkerInput, WorkerOutput>,
    input: WorkerInput
  ): ResultAsync<WorkerOutput, Error> {
    return this.putScript(input);
  }

  private putScript(input: WorkerInput): ResultAsync<WorkerOutput, CFError> {
    console.log("putScript", JSON.stringify(input, null, 2));
    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(input.metadata)], {
        type: "application/json",
      })
    );
    for (const file of input.files) {
      formData.append(
        file.name,
        new Blob([file.content], { type: file.type }),
        file.name
      );
    }
    return this.client.fetchWithAccount({
      method: "PUT",
      path: `/workers/scripts/${input.name}`,
      body: { format: "form", data: formData },
      responseSchema: WorkerOutput,
    });
  }

  delete(
    state: ResourceState<WorkerInput, WorkerOutput>
  ): ResultAsync<void, Error> {
    return this.client.fetchWithAccount({
      method: "DELETE",
      path: `/workers/scripts/${state.output.id}`,
      responseSchema: z.any(),
    });
  }
}

export class Worker implements Component<Error> {
  build: Build;
  assets?: WorkerAssets;
  url?: WorkerURL;
  provider: WorkerScriptProvider;

  constructor(
    readonly scope: Scope,
    readonly name: string,
    readonly input: WorkerRawInput
  ) {
    this.build = new Build(scope.extend(`${name}:bundle`), `${name}:bundle`, {
      path: input.path,
      format: "esm",
      outdir: join(scope.app.path, "dist"),
      target: "browser",
      minify: true,
      sourcemap: "external",
    });
    this.assets = input.assets
      ? new WorkerAssets(scope.extend(`${name}:assets`), `${name}:assets`, {
          scriptName: this.name,
          path: input.assets.path,
        })
      : undefined;
    this.url = input.url
      ? new WorkerURL(
          scope.extend(`${name}:url`),
          `${name}:url`,
          {
            scriptName: this.name,
            enabled: true,
          },
          {
            dependsOn: [this.name],
          }
        )
      : undefined;

    this.provider = new WorkerScriptProvider(scope.client);

    this.scope.register(this, {
      dependsOn: [this.build.name, this.assets?.name].filter(
        (name) => name !== undefined
      ),
    });
  }

  prepare = (
    phase: "up" | "down"
  ): ResultAsync<ResourceAction<Error> | null, Error> => {
    if (phase === "down") {
      const state = this.scope.getState<WorkerInput, WorkerOutput>();
      if (!state) {
        return okAsync(null);
      }
      console.log("delete");
      return okAsync({
        action: "delete",
        handler: () => this.delete(state),
      });
    }
    return ResultAsync.combine([
      this.build.action,
      this.assets?.action ?? okAsync(null),
    ]).andThen(([buildAction, assetsAction]) => {
      const state = this.scope.getState<WorkerInput, WorkerOutput>();
      if (!state) {
        return okAsync<ResourceAction<Error>>({
          action: "create",
          handler: () => this.getWorkerInput().andThen(this.create),
        });
      }
      if (buildAction || assetsAction) {
        return okAsync<ResourceAction<Error>>({
          action: "update",
          handler: () => {
            return this.getWorkerInput().andThen((input) =>
              this.provider.diff(state, input).andThen((diff) => {
                if (diff === "noop") {
                  return ok();
                }
                return this.update(state, input);
              })
            );
          },
        });
      }
      return this.getWorkerInput().andThen((input) =>
        this.provider.diff(state, input).map((diff) => {
          if (diff === "noop") {
            return null;
          }
          return {
            action: "update",
            handler: () => this.update(state, input),
          } satisfies ResourceAction<Error>;
        })
      );
    });
  };

  private create = (input: WorkerInput) => {
    return this.provider
      .create(input)
      .map((output) => this.scope.setState({ input, output }));
  };

  private update = (
    state: ResourceState<WorkerInput, WorkerOutput>,
    input: WorkerInput
  ) => {
    return this.provider
      .update(state, input)
      .map((output) => this.scope.setState({ input, output }));
  };

  private delete = (state: ResourceState<WorkerInput, WorkerOutput>) => {
    return this.provider.delete(state).map(() => this.scope.deleteState());
  };

  private getWorkerInput = (): ResultAsync<WorkerInput, BuildError> => {
    console.log("getWorkerInput");
    return ResultAsync.combine([
      this.build.output.map(async (output) => {
        assert(output, new Error(`No output for ${this.name}`));
        return {
          main_module:
            output.format === "esm"
              ? output.entry.path.replace(`${this.scope.app.path}/dist/`, "")
              : undefined,
          body_part:
            output.format === "cjs"
              ? output.entry.path.replace(`${this.scope.app.path}/dist/`, "")
              : undefined,
          files: await Promise.all(
            [output.entry, ...output.files].map(async (file) => ({
              name: file.path.replace(`${this.scope.app.path}/dist/`, ""),
              content: await file.text(),
              // TODO: support other types
              type:
                file.kind === "sourcemap"
                  ? "application/source-map"
                  : output.format === "esm"
                    ? "application/javascript+module"
                    : "application/javascript",
            }))
          ),
        };
      }),
      this.assets?.output ?? okAsync(null),
    ]).andThen(([buildOutput, assetsOutput]) => {
      const metadata: WorkerMetadataInput = {
        assets: assetsOutput
          ? {
              jwt: assetsOutput.jwt,
              config: {
                _headers: assetsOutput.headers,
                _redirects: assetsOutput.redirects,
              },
            }
          : undefined,
        compatibility_date: "2025-04-28",
        compatibility_flags: [],
        keep_assets: false,
        keep_bindings: [],
        logpush: false,
        main_module: buildOutput.main_module,
        body_part: buildOutput.body_part,
        migrations: undefined,
        observability: {
          enabled: true,
        },
        placement: {
          mode: "smart",
        },
        tags: [],
        tail_consumers: [],
        usage_model: "standard",
      };
      return ok({
        name: this.name,
        metadata,
        files: buildOutput.files,
      });
    });
  };
}
