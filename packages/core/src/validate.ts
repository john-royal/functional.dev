import { err, ok, ResultAsync } from "neverthrow";
import type { StandardSchemaV1 } from "./vendor/standard-schema";

export function validate<TInput, TOutput>(
  schema: StandardSchemaV1<TInput, TOutput>,
  input: unknown
) {
  return ResultAsync.fromSafePromise(
    Promise.resolve(schema["~standard"].validate(input))
  ).andThen((result) => {
    if (result.issues) {
      return err(result.issues);
    } else {
      return ok(result.value);
    }
  });
}
