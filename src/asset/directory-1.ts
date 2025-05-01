import { readdir } from "node:fs/promises";
import path from "node:path";
import Ignore from "ignore";
import sha256 from "../lib/sha256";
import { computeFileHash } from "../lib/file";

export interface DirectoryAssetProperties {
  path: string;
  ignore?: string[];
  files: Record<string, string>;
}

export class DirectoryAsset implements DirectoryAssetProperties {
  readonly path: string;
  readonly ignore?: string[];
  readonly files: Record<string, string>;

  constructor(properties: DirectoryAssetProperties) {
    this.path = properties.path;
    this.ignore = properties.ignore;
    this.files = properties.files;
  }

  async isChanged() {
    const other = await DirectoryAsset.read({
      path: this.path,
      ignore: this.ignore,
    });
    return !Bun.deepEquals(this.files, other.files);
  }

  static async read(options: Omit<DirectoryAssetProperties, "files">) {
    const fileNames = await readdir(options.path, { recursive: true });
    const matcher = options.ignore ? Ignore().add(options.ignore) : undefined;
    const files: Record<string, string> = {};
    await Promise.all(
      fileNames.map(async (fileName) => {
        if (matcher?.ignores(fileName)) {
          return;
        }
        const filePath = path.join(options.path, fileName);
        const file = Bun.file(filePath);
        const hash = await computeFileHash(file).catch(() => null);
        if (!hash) {
          return;
        }
        files[filePath] = hash;
      }),
    );
    return new DirectoryAsset({
      path: options.path,
      ignore: options.ignore,
      files,
    });
  }
}
