export class DetachedPromise<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  status: "pending" | "fulfilled" | "rejected" = "pending";

  constructor() {
    const { promise, resolve, reject } = Promise.withResolvers<T>();
    this.promise = promise;
    this.resolve = (value) => {
      this.status = "fulfilled";
      resolve(value);
    };
    this.reject = (reason) => {
      this.status = "rejected";
      reject(reason);
    };
  }
}
