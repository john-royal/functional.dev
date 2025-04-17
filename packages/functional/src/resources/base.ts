import { $app } from "../context";

/**
 * Common interface for all resources
 */
export interface IResource {
  kind: string;
  id: string;
  options?: any;
  state?: any;
  binding?: any;
}

/**
 * Interface for resources that support bindings
 */
export interface IBindable {
  binding(name?: string): any;
}

/**
 * Interface for resources that support development mode
 */
export interface IDevelopable {
  dev(): Promise<{
    fetch?: (request: Request) => Promise<Response>;
    reload?: () => Promise<void>;
    stop?: () => Promise<void>;
  }>;
}

/**
 * Base resource class that all resource types extend
 */
export abstract class Resource<T extends IResource> {
  abstract readonly kind: T["kind"];
  name: string;

  constructor(readonly id: T["id"], readonly options: T["options"]) {
    this.name = [$app.name, $app.environment, this.id].join("-");
  }

  /**
   * Get stored state for this resource from the cache
   */
  protected async getState(): Promise<T["state"] | undefined> {
    return $app.cache.get<T["state"]>(`state:${this.kind}:${this.id}`);
  }

  /**
   * Save state for this resource to the cache
   */
  protected async saveState(state: T["state"]): Promise<void> {
    $app.cache.set(`state:${this.kind}:${this.id}`, state);
    await $app.cache.save();
  }

  /**
   * Create a new resource
   * Should be implemented by resource types
   */
  abstract create(): Promise<T["state"]>;

  /**
   * Update an existing resource
   * Should be implemented by resource types
   */
  abstract update(prevState: T["state"]): Promise<T["state"]>;

  /**
   * Delete an existing resource
   * Should be implemented by resource types
   */
  abstract delete(prevState: T["state"]): Promise<void>;
}

/**
 * Base class for bindable resources
 */
export abstract class BindableResource<T extends IResource>
  extends Resource<T>
  implements IBindable
{
  abstract binding(name?: string): any;
}

/**
 * Base class for resources that support development mode
 */
export abstract class DevelopableResource<T extends IResource>
  extends Resource<T>
  implements IDevelopable
{
  abstract dev(): Promise<{
    fetch?: (request: Request) => Promise<Response>;
    reload?: () => Promise<void>;
    stop?: () => Promise<void>;
  }>;
}
