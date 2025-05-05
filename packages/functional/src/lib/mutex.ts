export class Mutex {
  private _locked = false;
  private _waiters: Array<() => void> = [];

  /**
   * Acquires the mutex, returning a release function.
   */
  acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const release = () => {
        this._locked = false;
        const next = this._waiters.shift();
        if (next) next();
      };

      if (!this._locked) {
        this._locked = true;
        resolve(release);
      } else {
        this._waiters.push(() => resolve(release));
        console.log("waiting for mutex", this._waiters.length);
      }
    });
  }

  /**
   * Runs the given callback exclusively, releasing the lock afterwards.
   */
  async runExclusive<T>(callback: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await callback();
    } finally {
      release();
    }
  }

  /**
   * Checks if the mutex is currently locked.
   */
  isLocked(): boolean {
    return this._locked;
  }
}
