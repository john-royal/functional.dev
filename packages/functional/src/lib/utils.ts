type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

export type RequiredKeys<T> = Exclude<keyof T, OptionalKeys<T>>;

export type WithoutOptionalKeys<T> = Pick<T, RequiredKeys<T>>;

export type MaybePromise<T> = T | Promise<T>;

export type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};

export type MakeOptional<T, K extends keyof T> = Simplify<
  Omit<T, K> & Partial<Pick<T, K>>
>;

export type MaybeArray<T> = T | T[];
