import { rmdir } from "node:fs/promises";
import { $app } from "~/core/app";
import { Resource } from "~/core/resource";
import { haveFilesChanged } from "~/lib/file";
import type { WithRequired } from "~/lib/types";
import { BundleFile } from "./bundle-file";
import { TraceInputPlugin } from "./plugins";

type BundleResourceProperties = Resource.CRUDProperties<
  WithRequired<Bun.BuildConfig, "outdir">,
  BundleOutput
>;

interface BundleOutput {
  sources: Record<string, string>;
  artifacts: BundleFile[];
}

export class Bundle extends Resource<BundleResourceProperties> {
  readonly kind = "bundle";

  static override get provider() {
    return new BundleProvider();
  }

  constructor(
    name: string,
    input: WithRequired<Bun.BuildConfig, "outdir">,
    metadata?: Resource.Metadata,
  ) {
    super(Bundle.provider, name, input, metadata);
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
    await rmdir($app.path.scope(state.input.outdir), {
      recursive: true,
    });
    return;
  };

  run = async (
    input: Resource.Input<BundleResourceProperties>,
  ): Promise<BundleOutput> => {
    const outdir = $app.path.scope(input.outdir);
    const traceInputPlugin = new TraceInputPlugin();
    const result = await Bun.build({
      ...input,
      outdir,
      plugins: [...(input.plugins ?? []), traceInputPlugin],
    });
    const [sources, artifacts] = await Promise.all([
      traceInputPlugin.getManifest(),
      Promise.all(
        result.outputs.map((output) =>
          BundleFile.fromBuildArtifact(outdir, output),
        ),
      ),
    ]);
    return {
      sources,
      artifacts,
    };
  };
}
