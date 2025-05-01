import path from "node:path";
import { computeFileHash } from "../lib/file";

export interface BundleFileProperties {
  name: string;
  hash: string;
  kind: Bun.BuildArtifact["kind"];
}

export class BundleFile implements BundleFileProperties {
  readonly name: string;
  readonly hash: string;
  readonly kind: Bun.BuildArtifact["kind"];
  private readonly file: Bun.BunFile;

  constructor(properties: BundleFileProperties) {
    this.name = properties.name;
    this.hash = properties.hash;
    this.kind = properties.kind;
    this.file = Bun.file(this.name);
  }

  text = async () => this.file.text();

  bytes = async () => this.file.bytes();

  static async fromBuildArtifact(artifact: Bun.BuildArtifact) {
    return new BundleFile({
      name: path.relative(artifact.path, process.cwd()),
      hash: await computeFileHash(artifact),
      kind: artifact.kind,
    });
  }
}
