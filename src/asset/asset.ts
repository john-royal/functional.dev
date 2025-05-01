export abstract class Asset<TInput, TOutput> {
  constructor(readonly input: TInput) {}

  abstract read(): Promise<TOutput>;
}
