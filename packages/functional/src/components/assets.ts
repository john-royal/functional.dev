import { okAsync, ResultAsync } from "neverthrow";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ResourceProvider } from "../resource";
import ignore from "ignore";

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
  create: (props) => {
    return ResultAsync.fromSafePromise(readAssets(props.path)).map((state) => ({
      id: props.path,
      state,
    }));
  },
  diff: (props, current) => {
    if (props.path !== current.props.path) {
      return okAsync({
        action: "replace",
      });
    }
    return ResultAsync.fromSafePromise(readAssets(props.path)).map((dir) => {
      return {
        action: Bun.deepEquals(current.state.manifest, dir.manifest)
          ? "noop"
          : "replace",
      };
    });
  },
  delete: () => {
    return okAsync();
  },
} satisfies ResourceProvider<AssetProps, AssetState>;

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
