import * as v from "valibot";

const WorkerAssetsInput = v.object({
  jwt: v.optional(v.string()),
  config: v.object({
    _headers: v.optional(v.string()),
    _redirects: v.optional(v.string()),
    html_handling: v.optional(
      v.union([
        v.literal("auto-trailing-slash"),
        v.literal("force-trailing-slash"),
        v.literal("drop-trailing-slash"),
        v.literal("none"),
      ]),
    ),
    not_found_handling: v.optional(
      v.union([
        v.literal("none"),
        v.literal("404-page"),
        v.literal("single-page-application"),
      ]),
    ),
    run_worker_first: v.optional(v.boolean()),
    serve_directly: v.optional(v.boolean()),
  }),
});

const MigrationStep = v.object({
  deleted_classes: v.optional(v.array(v.string())),
  new_classes: v.optional(v.array(v.string())),
  new_sqlite_classes: v.optional(v.array(v.string())),
  renamed_classes: v.optional(
    v.array(
      v.object({
        from: v.optional(v.string()),
        to: v.optional(v.string()),
      }),
    ),
  ),
  transferred_classes: v.optional(
    v.array(
      v.object({
        from: v.optional(v.string()),
        from_script: v.optional(v.string()),
        to: v.optional(v.string()),
      }),
    ),
  ),
});

export const SingleStepMigration = v.object({
  ...MigrationStep.entries,
  new_tag: v.optional(v.string()),
  old_tag: v.optional(v.string()),
});
export type SingleStepMigration = v.InferOutput<typeof SingleStepMigration>;

const MultipleStepMigration = v.object({
  new_tag: v.optional(v.string()),
  old_tag: v.optional(v.string()),
  steps: v.array(SingleStepMigration),
});

const SmartPlacement = v.object({
  last_analyzed_at: v.optional(v.string()),
  mode: v.optional(v.literal("smart")),
  status: v.optional(
    v.union([
      v.literal("SUCCESS"),
      v.literal("UNSUPPORTED_APPLICATION"),
      v.literal("INSUFFICIENT_INVOCATIONS"),
    ]),
  ),
});

const ConsumerScript = v.object({
  service: v.string(),
  environment: v.optional(v.string()),
  namespace: v.optional(v.string()),
});

export const WorkersBindingKindAI = v.object({
  name: v.string(),
  type: v.literal("ai"),
});

export const WorkersBindingKindAnalyticsEngine = v.object({
  dataset: v.string(),
  name: v.string(),
  type: v.literal("analytics_engine"),
});

export const WorkersBindingKindAssets = v.object({
  name: v.string(),
  type: v.literal("assets"),
});

export const WorkersBindingKindBrowserRendering = v.object({
  name: v.string(),
  type: v.literal("browser_rendering"),
});

export const WorkersBindingKindD1 = v.object({
  id: v.string(),
  name: v.string(),
  type: v.literal("d1"),
});

export const WorkersBindingKindDispatchNamespace = v.object({
  name: v.string(),
  type: v.literal("dispatch_namespace"),
  namespace: v.string(),
  outbound: v.optional(
    v.object({
      params: v.array(v.string()),
      worker: v.object({
        environment: v.string(),
        service: v.string(),
      }),
    }),
  ),
});

export const WorkersBindingKindDurableObjectNamespace = v.object({
  name: v.string(),
  type: v.literal("durable_object_namespace"),
  class_name: v.string(),
  environment: v.optional(v.string()),
  namespace_id: v.optional(v.string()),
  script_name: v.optional(v.string()),
});

export const WorkersBindingKindHyperdrive = v.object({
  name: v.string(),
  type: v.literal("hyperdrive"),
  id: v.string(),
});

export const WorkersBindingKindJson = v.object({
  name: v.string(),
  type: v.literal("json"),
  json: v.string(),
});

export const WorkersBindingKindKVNamespace = v.object({
  name: v.string(),
  type: v.literal("kv_namespace"),
  namespace_id: v.string(),
});

export const WorkersBindingKindMTLSCertificate = v.object({
  certificate_id: v.string(),
  name: v.string(),
  type: v.literal("mtls_certificate"),
});

export const WorkersBindingKindPlainText = v.object({
  name: v.string(),
  type: v.literal("plain_text"),
  text: v.string(),
});

export const WorkersBindingKindPipelines = v.object({
  name: v.string(),
  type: v.literal("pipelines"),
  pipeline: v.string(),
});

export const WorkersBindingKindQueue = v.object({
  name: v.string(),
  type: v.literal("queue"),
  queue_name: v.string(),
});

export const WorkersBindingKindR2Bucket = v.object({
  name: v.string(),
  type: v.literal("r2_bucket"),
  bucket_name: v.string(),
});

export const WorkersBindingKindSecretText = v.object({
  name: v.string(),
  type: v.literal("secret_text"),
  text: v.string(),
});

export const WorkersBindingKindService = v.object({
  name: v.string(),
  type: v.literal("service"),
  environment: v.string(),
  service: v.string(),
});

export const WorkersBindingKindTailConsumer = v.object({
  name: v.string(),
  type: v.literal("tail_consumer"),
  service: v.string(),
});

export const WorkersBindingKindVectorize = v.object({
  name: v.string(),
  type: v.literal("vectorize"),
  index_name: v.string(),
});

export const WorkersBindingKindVersionMetadata = v.object({
  name: v.string(),
  type: v.literal("version_metadata"),
});

export const WorkersBindingKindSecretsStoreSecret = v.object({
  name: v.string(),
  type: v.literal("secrets_store_secret"),
  secret_name: v.string(),
  store_id: v.string(),
});

export const WorkersBindingKindSecretKey = v.object({
  name: v.string(),
  type: v.literal("secret_key"),
  algorithm: v.string(),
  format: v.union([
    v.literal("raw"),
    v.literal("pkcs8"),
    v.literal("spki"),
    v.literal("jwk"),
  ]),
  usages: v.array(
    v.union([
      v.literal("encrypt"),
      v.literal("decrypt"),
      v.literal("sign"),
      v.literal("verify"),
      v.literal("deriveKey"),
      v.literal("deriveBits"),
      v.literal("wrapKey"),
      v.literal("unwrapKey"),
    ]),
  ),
  key_base64: v.optional(v.string()),
  key_jwk: v.optional(v.string()),
});

export const WorkersBindingKind = v.union([
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
export type WorkersBindingKind = v.InferOutput<typeof WorkersBindingKind>;

export const WorkersBindingInput = v.union([
  v.omit(WorkersBindingKindAI, ["name"]),
  v.omit(WorkersBindingKindAnalyticsEngine, ["name"]),
  v.omit(WorkersBindingKindAssets, ["name"]),
  v.omit(WorkersBindingKindBrowserRendering, ["name"]),
  v.omit(WorkersBindingKindD1, ["name"]),
  v.omit(WorkersBindingKindDispatchNamespace, ["name"]),
  v.omit(WorkersBindingKindDurableObjectNamespace, ["name"]),
  v.omit(WorkersBindingKindHyperdrive, ["name"]),
  v.omit(WorkersBindingKindJson, ["name"]),
  v.omit(WorkersBindingKindKVNamespace, ["name"]),
  v.omit(WorkersBindingKindMTLSCertificate, ["name"]),
  v.omit(WorkersBindingKindPlainText, ["name"]),
  v.omit(WorkersBindingKindPipelines, ["name"]),
  v.omit(WorkersBindingKindQueue, ["name"]),
  v.omit(WorkersBindingKindR2Bucket, ["name"]),
  v.omit(WorkersBindingKindSecretText, ["name"]),
  v.omit(WorkersBindingKindService, ["name"]),
  v.omit(WorkersBindingKindTailConsumer, ["name"]),
  v.omit(WorkersBindingKindVectorize, ["name"]),
  v.omit(WorkersBindingKindVersionMetadata, ["name"]),
  v.omit(WorkersBindingKindSecretsStoreSecret, ["name"]),
  v.omit(WorkersBindingKindSecretKey, ["name"]),
]);
export type WorkersBindingInput = v.InferOutput<typeof WorkersBindingInput>;

export const WorkerMetadataInput = v.object({
  assets: v.optional(WorkerAssetsInput),
  bindings: v.optional(v.array(WorkersBindingKind)),
  body_part: v.optional(v.string()),
  compatibility_date: v.optional(v.string()),
  compatibility_flags: v.optional(v.array(v.string())),
  keep_assets: v.optional(v.boolean()),
  keep_bindings: v.optional(v.array(v.string())),
  logpush: v.optional(v.boolean()),
  main_module: v.optional(v.string()),
  migrations: v.optional(v.union([SingleStepMigration, MultipleStepMigration])),
  observability: v.optional(
    v.object({
      enabled: v.boolean(),
      head_sampling_rate: v.optional(v.number()),
    }),
  ),
  placement: v.optional(SmartPlacement),
  tags: v.optional(v.array(v.string())),
  tail_consumers: v.optional(v.array(ConsumerScript)),
  usage_model: v.optional(v.literal("standard")),
});
export type WorkerMetadataInput = v.InferOutput<typeof WorkerMetadataInput>;

export const WorkerMetadataOutput = v.object({
  id: v.optional(v.string()),
  created_on: v.optional(v.string()),
  etag: v.optional(v.string()),
  has_assets: v.optional(v.boolean()),
  has_modules: v.optional(v.boolean()),
  logpush: v.optional(v.boolean()),
  modified_on: v.optional(v.string()),
  placement: v.optional(SmartPlacement),
  startup_time_ms: v.optional(v.number()),
  tail_consumers: v.nullable(v.array(ConsumerScript)),
  usage_model: v.optional(v.literal("standard")),
});
export type WorkerMetadataOutput = v.InferOutput<typeof WorkerMetadataOutput>;
