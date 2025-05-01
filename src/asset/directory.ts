import { readdir } from "node:fs/promises";
import path from "node:path";
import Ignore from "ignore";
import { computeFileHash } from "../lib/file";
import { Asset } from "./asset";

export interface DirectoryAssetInput {
  path: string;
  ignorePatterns?: string[];
  ignoreFiles?: string[];
}

export interface DirectoryAssetOutput {
  files: Record<string, string>;
}

export class DirectoryAsset extends Asset<
  DirectoryAssetInput,
  DirectoryAssetOutput
> {
  async read() {
    const [fileNames, matcher] = await Promise.all([
      readdir(this.input.path, { recursive: true }),
      this.createMatcher(),
    ]);
    const files: Record<string, string> = {};
    await Promise.all(
      fileNames.map(async (fileName) => {
        if (matcher.ignores(fileName)) {
          return;
        }
        const file = this.getFile(fileName);
        const hash = await computeFileHash(file).catch(() => null);
        if (!hash) {
          return;
        }
        files[fileName] = hash;
      }),
    );
    return {
      files,
    };
  }

  private async createMatcher() {
    const matcher = Ignore().add(this.input.ignorePatterns ?? []);
    if (this.input.ignoreFiles) {
      await Promise.all(
        this.input.ignoreFiles.map(async (fileName) => {
          const file = this.getFile(fileName);
          const text = await file.text();
          matcher.add(text.split("\n"));
        }),
      );
    }
    return matcher;
  }

  private getFile(filePath: string) {
    return Bun.file(path.join(this.input.path, filePath));
  }
}
