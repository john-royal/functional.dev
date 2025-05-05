export interface DurableObjectNamespaceProperties {
  id: string;
  className: string;
  scriptName?: string;
  environment?: string;
  sqlite?: boolean;
  namespaceId?: string;
}

export default class DurableObjectNamespace
  implements DurableObjectNamespaceProperties
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

  static toJSON = (namespace: DurableObjectNamespace) => ({
    id: namespace.id,
    className: namespace.className,
    scriptName: namespace.scriptName,
    environment: namespace.environment,
    sqlite: namespace.sqlite,
    namespaceId: namespace.namespaceId,
  });
}
