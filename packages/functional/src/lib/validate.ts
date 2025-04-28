import { err } from "neverthrow";
import { ok } from "neverthrow";
import type { Result } from "neverthrow";
import { z } from "zod";

export function validate<T>(
  schema: z.ZodSchema<T>,
  value: unknown
): Result<T, z.ZodError<T>> {
  const result = schema.safeParse(value);
  if (!result.success) {
    return err(result.error);
  }
  return ok(result.data);
}
