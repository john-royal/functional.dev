import { rmdir } from "node:fs/promises";
import { Resource } from "../../core/resource";
import { haveFilesChanged } from "../../lib/file";
import { BundleFile } from "./bundle-file";
import { TraceInputPlugin } from "./plugins";

type BundleResourceProperties = Resource.CRUDProperties<
  Bun.BuildConfig,
  BundleOutput
>;

interface BundleOutput {
  sources: Record<string, string>;
  artifacts: BundleFile[];
}

export class Bundle extends Resource<BundleResourceProperties> {
  readonly kind = "functional:bundle";

  constructor(
    name: string,
    input: Bun.BuildConfig,
    metadata?: Resource.Metadata,
  ) {
    super(new BundleProvider(), name, input, metadata);
  }
}

class BundleProvider implements Resource.Provider<BundleResourceProperties> {
  create = async (input: Resource.Input<BundleResourceProperties>) => {
    return {
      output: await this.run(input),
    };
  };

  diff = async (
    input: Resource.Input<BundleResourceProperties>,
    state: Resource.State<BundleResourceProperties>,
  ) => {
    if (!Bun.deepEquals(state.input, input)) {
      return "replace";
    }
    if (await haveFilesChanged(state.output.sources)) {
      return "update";
    }
    return "none";
  };
  update = async (input: Resource.Input<BundleResourceProperties>) => {
    return await this.run(input);
  };

  delete = async (state: Resource.State<BundleResourceProperties>) => {
    if (state.input.outdir) {
      await rmdir(state.input.outdir, { recursive: true });
    }
    return;
  };

  run = async (input: Bun.BuildConfig): Promise<BundleOutput> => {
    const traceInputPlugin = new TraceInputPlugin();
    const result = await Bun.build({
      ...input,
      plugins: [...(input.plugins ?? []), traceInputPlugin],
    });
    const [sources, artifacts] = await Promise.all([
      traceInputPlugin.getManifest(),
      Promise.all(
        result.outputs.map((output) => BundleFile.fromBuildArtifact(output)),
      ),
    ]);
    return {
      sources,
      artifacts,
    };
  };
}
