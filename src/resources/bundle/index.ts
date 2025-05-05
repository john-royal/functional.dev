import { rmdir } from "node:fs/promises";
import { Resource } from "../../core/resource";
import { haveFilesChanged } from "../../lib/file";
import type { UnsetMarker } from "../../lib/types";
import { BundleFile } from "./bundle-file";
import { TraceInputPlugin } from "./plugins";

type BundleResourceProperties = Resource.CRUDProperties<
  UnsetMarker,
  Bun.BuildConfig,
  BundleOutput
>;

interface BundleOutput {
  inputs: Record<string, string>;
  artifacts: BundleFile[];
}

const bundleProvider: Resource.Provider<BundleResourceProperties> = {
  create: async (input) => {
    const output = await runBuild(input);
    return {
      output,
    };
  },
  diff: async (input, state) => {
    if (!Bun.deepEquals(state.input, input)) {
      return "replace";
    }
    console.log("state.output.inputs", state.output.inputs);
    if (await haveFilesChanged(state.output.inputs)) {
      return "update";
    }
    return "none";
  },
  update: async (input) => {
    return await runBuild(input);
  },
  delete: async (context) => {
    if (context.input.outdir) {
      await rmdir(context.input.outdir, { recursive: true });
    }
    return;
  },
};

export class Bundle extends Resource<BundleResourceProperties> {
  readonly kind = "functional:bundle";

  constructor(
    name: string,
    input: Bun.BuildConfig,
    metadata?: Resource.Metadata,
  ) {
    super(bundleProvider, name, input, metadata);
  }
}

const runBuild = async (input: Bun.BuildConfig): Promise<BundleOutput> => {
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
