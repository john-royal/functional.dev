import { computeFileHash, verifyFileHashes } from "../lib/file";
import { Resource } from "./resource";

export interface FilesInput {
  paths: string[];
}

export interface FilesOutput {
  files: Record<string, string>;
}

export const Files = Resource<"files", FilesInput, FilesOutput>(
  "files",
  async (ctx) => {
    switch (ctx.phase) {
      case "create":
        return {
          type: "create",
          apply: () => generateFileManifest(ctx.input.paths),
        };
      case "update": {
        const changed = await verifyFileHashes(ctx.output.files);
        if (!changed) {
          return {
            type: "none",
          };
        }
        return {
          type: "update",
          apply: () => generateFileManifest(ctx.input.paths),
        };
      }
      case "delete":
        return {
          type: "delete",
        };
    }
  },
);

const generateFileManifest = async (paths: string[]) => {
  const files: Record<string, string> = {};
  await Promise.all(
    paths.map(async (path) => {
      const file = Bun.file(path);
      const hash = await computeFileHash(file).catch(() => undefined);
      if (!hash) {
        return;
      }
      files[path] = hash;
    }),
  );
  return { files };
};
