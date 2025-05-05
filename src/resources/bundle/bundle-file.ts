import path from "node:path";
import { $app } from "~/core/app";
import sha256 from "~/lib/sha256";

export interface BundleFileProperties {
  name: string;
  hash: string;
  kind: Bun.BuildArtifact["kind"];
  directory: string;
}

export class BundleFile implements BundleFileProperties {
  readonly name: string;
  readonly hash: string;
  readonly kind: Bun.BuildArtifact["kind"];
  readonly directory: string;
  private readonly file: Bun.BunFile;

  constructor(properties: BundleFileProperties) {
    this.name = properties.name;
    this.hash = properties.hash;
    this.kind = properties.kind;
    this.directory = properties.directory;
    this.file = Bun.file(
      $app.path.scope(properties.directory, properties.name),
    );
  }

  get type() {
    return this.file.type;
  }

  text = async () => this.file.text();

  bytes = async () => this.file.bytes();

  toJSON = () => ({
    name: this.name,
    hash: this.hash,
    kind: this.kind,
    directory: this.directory,
  });

  static async fromBuildArtifact(outdir: string, artifact: Bun.BuildArtifact) {
    const bytes = await Bun.file(artifact.path)
      .bytes()
      .catch(() => undefined);
    if (!bytes) {
      throw new Error(`Failed to read artifact ${artifact.path}`);
    }
    return new BundleFile({
      name: path.relative(outdir, artifact.path),
      hash: sha256(bytes),
      kind: artifact.kind,
      directory: $app.path.unscope(outdir),
    });
  }
}
