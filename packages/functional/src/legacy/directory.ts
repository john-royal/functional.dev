import { readdir } from "node:fs/promises";
import Ignore from "ignore";
import { Resource } from "./resource";
import { Files, type FilesOutput } from "./resources/bundle/files";

export interface DirectoryInput {
  path: string;
  ignorePatterns?: string[];
  ignoreFiles?: string[];
}

export const Directory = Resource<"directory", DirectoryInput, FilesOutput>(
  "directory",
  async (ctx) => {
    if (ctx.phase === "delete") {
      return ctx.result("delete");
    }
    const [fileNames, matcher] = await Promise.all([
      readdir(ctx.input.path, { recursive: true }),
      createIgnoreMatcher(ctx.input.ignorePatterns, ctx.input.ignoreFiles),
    ]);
    return Files({
      paths: fileNames.filter((fileName) => !matcher.ignores(fileName)),
    });
  },
);

const createIgnoreMatcher = async (
  ignorePatterns?: string[],
  ignoreFiles?: string[],
) => {
  const matcher = Ignore().add(ignorePatterns ?? []);
  if (ignoreFiles) {
    await Promise.all(
      ignoreFiles.map(async (fileName) => {
        const file = Bun.file(fileName);
        const text = await file.text();
        matcher.add(text.split("\n"));
      }),
    );
  }
  return matcher;
};
