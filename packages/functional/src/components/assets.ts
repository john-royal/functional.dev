import { okAsync, ResultAsync } from "neverthrow";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import ignore from "ignore";
import type { ResourceProvider } from "../providers/provider";

interface AssetProps {
  path: string;
}

interface AssetState {
  manifest: Record<string, FileState>;
}

interface FileState {
  size: number;
  hash: string;
}

export const provider = {
  create: (input) => {
    return ResultAsync.fromSafePromise(readAssets(input.path));
  },
  diff: (state, input) => {
    if (input.path !== state.input.path) {
      return okAsync({
        action: "replace",
      });
    }
    return ResultAsync.fromSafePromise(readAssets(input.path)).map(
      (output) => ({
        action: Bun.deepEquals(output.manifest, state.output.manifest)
          ? "noop"
          : "update",
      })
    );
  },
} satisfies ResourceProvider<AssetProps, AssetState, never>;

const readAssets = async (path: string): Promise<AssetState> => {
  const files = await readdir(path, { recursive: true });

  const ingoreMatcher = ignore().add([
    ".assetsignore",
    "_headers",
    "_redirects",
  ]);
  const ignoreFile = Bun.file(join(path, ".assetsignore"));
  if (await ignoreFile.exists()) {
    const ignoreContent = await ignoreFile.text();
    ingoreMatcher.add(ignoreContent.split("\n"));
  }

  const manifest: Record<string, FileState> = {};
  await Promise.all(
    files.map(async (fileName) => {
      if (ingoreMatcher.ignores(fileName)) {
        return;
      }

      const filePath = join(path, fileName);
      const file = Bun.file(filePath);

      const stats = await file.stat();

      if (!stats.isDirectory()) {
        manifest[fileName] = {
          size: stats.size,
          hash: createHash("sha256")
            .update(await file.bytes())
            .digest("hex"),
        };
      }
    })
  );
  return {
    manifest,
  };
};
