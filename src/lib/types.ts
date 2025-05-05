export type MaybePromise<T> = T | Promise<T>;
export type UnsetMarker = undefined & {
  __unsetMarker: true;
};
export type WithRequired<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;
