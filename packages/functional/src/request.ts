import { err, errAsync, ok, Result, ResultAsync } from "neverthrow";
import { z } from "zod";

type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};

type ExtractRouteParams<T extends string> =
  T extends `${infer Start}:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & ExtractRouteParams<Rest>
    : T extends `${infer Start}:${infer Param}`
      ? { [K in Param]: string }
      : never;

type Test = ExtractRouteParams<"/users/:id/posts/:postId">;

interface RequestConfig<TPath extends string> {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: TPath;
  schema?: {
    headers?: z.ZodObject<any>;
    query?: z.ZodObject<any>;
    body?: z.ZodObject<any>;
    response?: z.ZodObject<any>;
  };
}
type RequestInputParams<TPath extends string> =
  ExtractRouteParams<TPath> extends never
    ? { params?: never }
    : { params: Simplify<ExtractRouteParams<TPath>> };

export const defineRequest = <TPath extends string>(
  config: RequestConfig<TPath>
) => {
  return (input: RequestInputParams<TPath>) => {};
};

const request = defineRequest({
  method: "GET",
  path: "/users/:userId/posts/:postId",
});
