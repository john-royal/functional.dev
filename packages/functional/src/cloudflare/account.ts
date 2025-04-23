import { ResultAsync } from "neverthrow";
import { z } from "zod";
import { APIError, cfFetch, type CFFetchOptions } from "./fetch";

export const fetchCloudflareAccount = (): ResultAsync<
  { id: string; name: string },
  APIError
> => {
  return cfFetch({
    method: "GET",
    path: "/accounts",
    schema: z.array(z.object({ id: z.string(), name: z.string() })),
  }).map((accounts) => {
    if (!accounts[0]) {
      throw new Error("No account found");
    }
    return accounts[0];
  });
};

export const cfFetchAccount = <TBody, TResponse>({
  method,
  path,
  body,
  headers,
  schema,
}: CFFetchOptions<TBody, TResponse>): ResultAsync<TResponse, APIError> => {
  return fetchCloudflareAccount().andThen((account) =>
    cfFetch({
      method,
      path: `/accounts/${account.id}${path}`,
      body,
      headers,
      schema,
    })
  );
};
