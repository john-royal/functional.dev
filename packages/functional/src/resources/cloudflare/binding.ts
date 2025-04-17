import type { CreateBindingContext } from "../resource";

export interface WorkersBindingKindAI {
  name: string;
  type: "ai";
}

export interface WorkersBindingKindAnalyticsEngine {
  dataset: string;
  name: string;
  type: "analytics_engine";
}

export interface WorkersBindingKindAssets {
  name: string;
  type: "assets";
}

export interface WorkersBindingKindBrowserRendering {
  name: string;
  type: "browser_rendering";
}

export interface WorkersBindingKindD1 {
  id: string;
  name: string;
  type: "d1";
}

export interface WorkersBindingKindDispatchNamespace {
  name: string;
  type: "dispatch_namespace";
  namespace: string;
  outbound?: {
    params: string[];
    worker: {
      environment: string;
      service: string;
    };
  };
}

export interface WorkersBindingKindDurableObjectNamespace {
  name: string;
  type: "durable_object_namespace";
  class_name: string;
  environment?: string;
  namespace_id?: string;
  script_name?: string;
}

export interface WorkersBindingKindHyperdrive {
  name: string;
  type: "hyperdrive";
  id: string;
}

export interface WorkersBindingKindJson {
  name: string;
  type: "json";
  json: string;
}

export interface WorkersBindingKindKVNamespace {
  name: string;
  type: "kv_namespace";
  namespace_id: string;
}

export interface WorkersBindingKindMTLSCertificate {
  certificate_id: string;
  name: string;
  type: "mtls_certificate";
}

export interface WorkersBindingKindPlainText {
  name: string;
  type: "plain_text";
  text: string;
}

export interface WorkersBindingKindPipelines {
  name: string;
  type: "pipelines";
  pipeline: string;
}

export interface WorkersBindingKindQueue {
  name: string;
  type: "queue";
  queue_name: string;
}

export interface WorkersBindingKindR2Bucket {
  name: string;
  type: "r2_bucket";
  bucket_name: string;
}

export interface WorkersBindingKindSecretText {
  name: string;
  type: "secret_text";
  text: string;
}

export interface WorkersBindingKindService {
  name: string;
  type: "service";
  environment: string;
  service: string;
}

export interface WorkersBindingKindTailConsumer {
  name: string;
  type: "tail_consumer";
  service: string;
}

export interface WorkersBindingKindVectorize {
  name: string;
  type: "vectorize";
  index_name: string;
}

export interface WorkersBindingKindVersionMetadata {
  name: string;
  type: "version_metadata";
}

export interface WorkersBindingKindSecretsStoreSecret {
  name: string;
  type: "secrets_store_secret";
  secret_name: string;
  store_id: string;
}

export interface WorkersBindingKindSecretKey {
  name: string;
  type: "secret_key";
  algorithm: string;
  format: "raw" | "pkcs8" | "spki" | "jwk";
  usages: (
    | "encrypt"
    | "decrypt"
    | "sign"
    | "verify"
    | "deriveKey"
    | "deriveBits"
    | "wrapKey"
    | "unwrapKey"
  )[];
  key_base64?: string;
  key_jwk?: string;
}

export type WorkersBindingKind =
  | WorkersBindingKindAI
  | WorkersBindingKindAnalyticsEngine
  | WorkersBindingKindAssets
  | WorkersBindingKindBrowserRendering
  | WorkersBindingKindD1
  | WorkersBindingKindDispatchNamespace
  | WorkersBindingKindDurableObjectNamespace
  | WorkersBindingKindHyperdrive
  | WorkersBindingKindJson
  | WorkersBindingKindKVNamespace
  | WorkersBindingKindMTLSCertificate
  | WorkersBindingKindPlainText
  | WorkersBindingKindPipelines
  | WorkersBindingKindQueue
  | WorkersBindingKindR2Bucket
  | WorkersBindingKindSecretText
  | WorkersBindingKindService
  | WorkersBindingKindTailConsumer
  | WorkersBindingKindVectorize
  | WorkersBindingKindVersionMetadata
  | WorkersBindingKindSecretsStoreSecret
  | WorkersBindingKindSecretKey;

export const kFunctionalCreateBinding = "functional.createBinding";

export type AnyBinding =
  | WorkersBindingKind
  | { [kFunctionalCreateBinding]: () => WorkersBindingKind };
