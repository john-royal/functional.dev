import { rmdir } from "node:fs/promises";
import { verifyFileHashes } from "../../lib/file";
import { BundleFile } from "./bundle-file";
import { TraceInputPlugin } from "./plugins";
import { Resource } from "../../resource";

interface BundleOutput {
  inputs: Record<string, string>;
  artifacts: BundleFile[];
}

export default class Bundle extends Resource<
  "bundle",
  Bun.BuildConfig,
  BundleOutput
> {
  readonly kind = "bundle";

  async run(
    context: Resource.Context<Bun.BuildConfig, BundleOutput>,
  ): Promise<Resource.Action<BundleOutput>> {
    switch (context.status) {
      case "create":
        return {
          status: "create",
          apply: () => runBuild(this.input),
        };
      case "update": {
        const { changed } = await verifyFileHashes(context.output.inputs);
        if (!changed) {
          return {
            status: "none",
          };
        }
        return {
          status: "update",
          apply: () => runBuild(this.input),
        };
      }
      case "delete": {
        const outdir = context.input.outdir;
        return {
          status: "delete",
          apply: outdir ? () => rmdir(outdir, { recursive: true }) : undefined,
        };
      }
    }
  }
}

const runBuild = async (input: Bun.BuildConfig) => {
  const traceInputPlugin = new TraceInputPlugin();
  const result = await Bun.build({
    ...input,
    plugins: [...(input.plugins ?? []), traceInputPlugin],
  });
  const [inputs, artifacts] = await Promise.all([
    traceInputPlugin.getManifest(),
    Promise.all(
      result.outputs.map((output) => BundleFile.fromBuildArtifact(output)),
    ),
  ]);
  return {
    inputs,
    artifacts,
  };
};
