import { rmdir } from "node:fs/promises";
import { verifyFileHashes } from "../../lib/file";
import { Resource } from "../../resource";
import { BundleFile } from "./bundle-file";
import { TraceInputPlugin } from "./plugins";

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
        if (
          !Bun.deepEquals(this.input, context.input) ||
          (await verifyFileHashes(context.output.inputs))
        ) {
          return {
            status: "update",
            apply: () => runBuild(this.input),
          };
        }
        return {
          status: "none",
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
