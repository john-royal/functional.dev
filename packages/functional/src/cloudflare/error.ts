const CLOUDFLARE_ERRORS = [
  "AUTH_INVALID_WRANGLER_CONFIG",
  "AUTH_FAILED_TO_REFRESH",
  "MISSING_ACCOUNT_ID",
  "FAILED_TO_FETCH",
  "INVALID_JSON",
  "UNEXPECTED_RESPONSE",
  "API_ERROR",
  "NO_RESPONSE",
] as const;
type CFErrorCode = (typeof CLOUDFLARE_ERRORS)[number];

interface CFErrorOptions<Code extends CFErrorCode> {
  code: Code;
  message?: string;
  cause?: unknown;
  metadata?: Record<string, unknown>;
}

export class CFError<Code extends CFErrorCode = CFErrorCode> extends Error {
  readonly code: Code;

  constructor({ code, message, cause }: CFErrorOptions<Code>) {
    super(message ?? code, { cause });
    this.code = code;
  }
}
