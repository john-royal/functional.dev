import { rmdir } from "node:fs/promises";
import { verifyFileHashes } from "../lib/file";
import { Resource } from "../resource";
import { BundleFile } from "./bundle-file";
import { TraceInputPlugin } from "./plugins";

interface BundleOutput {
  inputs: Record<string, string>;
  artifacts: BundleFile[];
}

export const Bundle = Resource<"bundle", Bun.BuildConfig, BundleOutput>(
  "bundle",
  async (ctx) => {
    switch (ctx.phase) {
      case "create":
        return ctx.result("create", () => runBuild(ctx.input));
      case "update": {
        const changed = await verifyFileHashes(ctx.output.inputs);
        if (!changed) {
          return ctx.result("none");
        }
        return ctx.result("update", () => runBuild(ctx.input));
      }
      case "delete": {
        const outdir = ctx.input.outdir;
        return ctx.result("delete", outdir ? () => rmdir(outdir) : undefined);
      }
    }
  },
);

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
