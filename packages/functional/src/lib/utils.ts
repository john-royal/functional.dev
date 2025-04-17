export const isENOENT = (error: unknown): error is Error & { code: "ENOENT" } =>
  error instanceof Error && "code" in error && error.code === "ENOENT";
