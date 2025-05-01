import { z } from "zod";

export const ProviderConfig = z.interface({
  "apiKey?": z.string(),
  "apiEmail?": z.string(),
  "apiToken?": z.string(),
  "accountId?": z.string(),
});
export type ProviderConfig = z.infer<typeof ProviderConfig>;

export const APIMessage = z.interface({
  code: z.number(),
  message: z.string(),
  get error_chain() {
    return z.array(APIMessage);
  },
});
export type APIMessage = z.infer<typeof APIMessage>;

export const APIErrorResponse = z.interface({
  success: z.literal(false),
  errors: z.array(APIMessage),
  messages: z.array(APIMessage),
  result: z.null(),
});
export type APIErrorResponse = z.infer<typeof APIErrorResponse>;

export const APISuccessResponse = <T>(result: z.ZodSchema<T>) =>
  z.interface({
    success: z.literal(true),
    errors: z.array(APIMessage),
    messages: z.array(APIMessage),
    result,
  });
export type APISuccessResponse<T> = z.infer<
  ReturnType<typeof APISuccessResponse<T>>
>;

export const APIResponse = <T>(result: z.ZodSchema<T>) =>
  z.discriminatedUnion("success", [
    APIErrorResponse,
    APISuccessResponse(result),
  ]);
export type APIResponse<T> = z.infer<ReturnType<typeof APIResponse<T>>>;

export const CloudflareAccount = z.object({
  id: z.string(),
  name: z.string(),
});
export type CloudflareAccount = z.infer<typeof CloudflareAccount>;
