export type MaybePromise<T> = T | Promise<T>;
export type UnsetMarker = undefined & {
  __unsetMarker: true;
};
