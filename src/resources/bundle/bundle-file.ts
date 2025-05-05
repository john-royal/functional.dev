import path from "node:path";
import sha256 from "../../lib/sha256";

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
    this.file = Bun.file(path.join(process.cwd(), properties.name));
  }

  get type() {
    return this.file.type;
  }

  text = async () => this.file.text();

  bytes = async () => this.file.bytes();

  static async fromBuildArtifact(artifact: Bun.BuildArtifact) {
    const bytes = await Bun.file(artifact.path)
      .bytes()
      .catch(() => undefined);
    if (!bytes) {
      throw new Error(`Failed to read artifact ${artifact.path}`);
    }
    return new BundleFile({
      name: path.relative(process.cwd(), artifact.path),
      hash: sha256(bytes),
      kind: artifact.kind,
    });
  }
}
