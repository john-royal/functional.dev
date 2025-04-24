import type { ResultAsync } from "neverthrow";

export class SingleFlight<TResult, TError> {
  result?: ResultAsync<TResult, TError>;

  run(fn: () => ResultAsync<TResult, TError>): ResultAsync<TResult, TError> {
    if (this.result) {
      return this.result;
    }
    try {
      this.result = fn();
      return this.result;
    } finally {
      this.result = undefined;
    }
  }
}
