import z from "zod";

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
      }),
    )
    .optional(),
  transferred_classes: z
    .array(
      z.object({
        from: z.string().optional(),
        from_script: z.string().optional(),
        to: z.string().optional(),
      }),
    )
    .optional(),
});

export const SingleStepMigration = MigrationStep.extend({
  new_tag: z.string().optional(),
  old_tag: z.string().optional(),
});
export type SingleStepMigration = z.infer<typeof SingleStepMigration>;

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

export const WorkersBindingKindAI = z.object({
  name: z.string(),
  type: z.literal("ai"),
});

export const WorkersBindingKindAnalyticsEngine = z.object({
  dataset: z.string(),
  name: z.string(),
  type: z.literal("analytics_engine"),
});

export const WorkersBindingKindAssets = z.object({
  name: z.string(),
  type: z.literal("assets"),
});

export const WorkersBindingKindBrowserRendering = z.object({
  name: z.string(),
  type: z.literal("browser_rendering"),
});

export const WorkersBindingKindD1 = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal("d1"),
});

export const WorkersBindingKindDispatchNamespace = z.object({
  name: z.string(),
  type: z.literal("dispatch_namespace"),
  namespace: z.string(),
  outbound: z
    .object({
      params: z.array(z.string()),
      worker: z.object({
        environment: z.string(),
        service: z.string(),
      }),
    })
    .optional(),
});

export const WorkersBindingKindDurableObjectNamespace = z.object({
  name: z.string(),
  type: z.literal("durable_object_namespace"),
  class_name: z.string(),
  environment: z.string().optional(),
  namespace_id: z.string().optional(),
  script_name: z.string().optional(),
});

export const WorkersBindingKindHyperdrive = z.object({
  name: z.string(),
  type: z.literal("hyperdrive"),
  id: z.string(),
});

export const WorkersBindingKindJson = z.object({
  name: z.string(),
  type: z.literal("json"),
  json: z.string(),
});

export const WorkersBindingKindKVNamespace = z.object({
  name: z.string(),
  type: z.literal("kv_namespace"),
  namespace_id: z.string(),
});

export const WorkersBindingKindMTLSCertificate = z.object({
  certificate_id: z.string(),
  name: z.string(),
  type: z.literal("mtls_certificate"),
});

export const WorkersBindingKindPlainText = z.object({
  name: z.string(),
  type: z.literal("plain_text"),
  text: z.string(),
});

export const WorkersBindingKindPipelines = z.object({
  name: z.string(),
  type: z.literal("pipelines"),
  pipeline: z.string(),
});

export const WorkersBindingKindQueue = z.object({
  name: z.string(),
  type: z.literal("queue"),
  queue_name: z.string(),
});

export const WorkersBindingKindR2Bucket = z.object({
  name: z.string(),
  type: z.literal("r2_bucket"),
  bucket_name: z.string(),
});

export const WorkersBindingKindSecretText = z.object({
  name: z.string(),
  type: z.literal("secret_text"),
  text: z.string(),
});

export const WorkersBindingKindService = z.object({
  name: z.string(),
  type: z.literal("service"),
  environment: z.string(),
  service: z.string(),
});

export const WorkersBindingKindTailConsumer = z.object({
  name: z.string(),
  type: z.literal("tail_consumer"),
  service: z.string(),
});

export const WorkersBindingKindVectorize = z.object({
  name: z.string(),
  type: z.literal("vectorize"),
  index_name: z.string(),
});

export const WorkersBindingKindVersionMetadata = z.object({
  name: z.string(),
  type: z.literal("version_metadata"),
});

export const WorkersBindingKindSecretsStoreSecret = z.object({
  name: z.string(),
  type: z.literal("secrets_store_secret"),
  secret_name: z.string(),
  store_id: z.string(),
});

export const WorkersBindingKindSecretKey = z.object({
  name: z.string(),
  type: z.literal("secret_key"),
  algorithm: z.string(),
  format: z.enum(["raw", "pkcs8", "spki", "jwk"]),
  usages: z.array(
    z.enum([
      "encrypt",
      "decrypt",
      "sign",
      "verify",
      "deriveKey",
      "deriveBits",
      "wrapKey",
      "unwrapKey",
    ]),
  ),
  key_base64: z.string().optional(),
  key_jwk: z.string().optional(),
});

export const WorkersBindingKind = z.union([
  WorkersBindingKindAI,
  WorkersBindingKindAnalyticsEngine,
  WorkersBindingKindAssets,
  WorkersBindingKindBrowserRendering,
  WorkersBindingKindD1,
  WorkersBindingKindDispatchNamespace,
  WorkersBindingKindDurableObjectNamespace,
  WorkersBindingKindHyperdrive,
  WorkersBindingKindJson,
  WorkersBindingKindKVNamespace,
  WorkersBindingKindMTLSCertificate,
  WorkersBindingKindPlainText,
  WorkersBindingKindPipelines,
  WorkersBindingKindQueue,
  WorkersBindingKindR2Bucket,
  WorkersBindingKindSecretText,
  WorkersBindingKindService,
  WorkersBindingKindTailConsumer,
  WorkersBindingKindVectorize,
  WorkersBindingKindVersionMetadata,
  WorkersBindingKindSecretsStoreSecret,
  WorkersBindingKindSecretKey,
]);
export type WorkersBindingKind = z.infer<typeof WorkersBindingKind>;

export const WorkerMetadataInput = z.object({
  assets: WorkerAssetsInput.optional(),
  bindings: z.array(WorkersBindingKind).optional(),
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
export type WorkerMetadataInput = z.infer<typeof WorkerMetadataInput>;

export const WorkerMetadataOutput = z.object({
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
export type WorkerMetadataOutput = z.infer<typeof WorkerMetadataOutput>;
