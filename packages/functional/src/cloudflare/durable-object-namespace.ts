import type { Bindable } from "~/binding";
import type { WorkersBindingInput } from "./worker/types";

export interface DurableObjectNamespaceProperties {
  id: string;
  className: string;
  scriptName?: string;
  environment?: string;
  sqlite?: boolean;
  namespaceId?: string;
}

export class DurableObjectNamespace
  implements DurableObjectNamespaceProperties, Bindable
{
  className: string;
  scriptName?: string;
  environment?: string;
  sqlite?: boolean;
  namespaceId?: string;

  constructor(
    readonly id: string,
    properties: Omit<DurableObjectNamespaceProperties, "id">,
  ) {
    this.className = properties.className;
    this.scriptName = properties.scriptName;
    this.environment = properties.environment;
    this.sqlite = properties.sqlite;
    this.namespaceId = properties.namespaceId;
  }

  getBinding(): WorkersBindingInput {
    return {
      type: "durable_object_namespace",
      class_name: this.className,
      environment: this.environment,
      namespace_id: this.namespaceId,
      script_name: this.scriptName,
    };
  }

  static toJSON = (namespace: DurableObjectNamespace) => ({
    id: namespace.id,
    className: namespace.className,
    scriptName: namespace.scriptName,
    environment: namespace.environment,
    sqlite: namespace.sqlite,
    namespaceId: namespace.namespaceId,
  });
}
