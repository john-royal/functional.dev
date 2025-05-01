import assert from "node:assert/strict";
import sha256 from "../lib/sha256";

export interface FileAssetProperties {
  path: string;
  type: string;
  hash: string;
  size: number;
}

export class FileAsset implements FileAssetProperties {
  readonly path: string;
  readonly type: string;
  readonly hash: string;
  readonly size: number;

  private readonly file: Bun.BunFile;

  constructor(properties: FileAssetProperties) {
    this.path = properties.path;
    this.type = properties.type;
    this.hash = properties.hash;
    this.size = properties.size;
    this.file = Bun.file(this.path);
  }

  text = async () => this.file.text();

  bytes = async () => this.file.bytes();

  async isChanged() {
    try {
      return this.hash !== (await sha256.file(this.file));
    } catch {
      return true;
    }
  }

  static async fromFile(file: Bun.BunFile) {
    assert(file.name, `File ${file} has no name`);
    const stats = await file.stat();
    return new FileAsset({
      path: file.name,
      type: file.type,
      hash: await sha256.file(file),
      size: stats.size,
    });
  }
}

const file1 = await FileAsset.fromFile(Bun.file("./README.md"));
console.log(await file1.isChanged());
