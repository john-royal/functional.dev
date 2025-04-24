export class FunctionalError extends Error {}

export class FunctionalAggregateError<T extends Error> extends FunctionalError {
  constructor(public errors: T[]) {
    super(errors.map((e) => e.message).join("\n"));
  }
}

export class InternalError extends FunctionalError {
  constructor(message: string) {
    super(message);
  }

  static fromUnknown(error: unknown) {
    if (error instanceof Error) {
      return new InternalError(error.message);
    }
    return new InternalError(String(error));
  }
}
