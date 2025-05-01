import type { APIMessage } from "./types";

export class CFError extends Error {
  readonly code: string;
  readonly status: number;
  readonly data: APIMessage[];

  constructor(input: {
    code: string;
    message: string;
    cause?: unknown;
    status?: number;
    data?: APIMessage[];
  }) {
    super(input.message, { cause: input.cause });
    this.code = input.code;
    this.status = input.status ?? 500;
    this.data = input.data ?? [];
  }
}
