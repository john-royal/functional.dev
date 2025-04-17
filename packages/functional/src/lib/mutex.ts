export class Mutex {
  private promise: Promise<unknown> | null = null;

  async runWith<T>(fn: () => Promise<T>): Promise<T> {
    if (this.promise) {
      console.log("waiting for previous promise");
      return (await this.promise) as Promise<T>;
    }
    const { resolve, reject, promise } = Promise.withResolvers();
    this.promise = promise;
    try {
      const result = await fn();
      resolve(result);
      return result;
    } catch (error) {
      reject(error);
      throw error;
    } finally {
      this.promise = null;
    }
  }
}
