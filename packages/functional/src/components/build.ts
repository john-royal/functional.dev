import { err, okAsync, ResultAsync } from "neverthrow";
import { rm } from "node:fs/promises";
import type { ResourceProvider } from "../providers/provider";

export interface BuildProps {
  path: string;
  format: "esm" | "cjs";
  outdir: string;
  target: "node" | "browser" | "bun";
  minify: boolean;
  sourcemap: "external" | "inline" | "none";
}

interface BuildManifest {
  [key: string]: {
    size: number;
    mtime: number;
  };
}

export interface BuildState {
  entry: BuildFile;
  files: BuildFile[];
  manifest: BuildManifest;
}

export const provider = {
  create: (props) => {
    return build(props);
  },
  // hydrate: (state: BuildState) => ({
  //   entry: BuildFile.fromJSON(state.entry),
  //   files: state.files.map(BuildFile.fromJSON),
  //   manifest: state.manifest,
  // }),
  diff: (state, input) => {
    if (!Bun.deepEquals(input, state.input)) {
      return okAsync({
        action: "replace",
      });
    }
    return hasChanged(state.output.manifest).map((changed) => ({
      action: changed ? "update" : "noop",
    }));
  },
  update: (_, props) => {
    return build(props);
  },
  delete: ({ input }) => {
    return ResultAsync.fromSafePromise(rm(input.outdir, { recursive: true }));
  },
} satisfies ResourceProvider<BuildProps, BuildState, BuildError>;

class TraceInputPlugin implements Bun.BunPlugin {
  readonly name = "trace-input";

  files = new Map<string, Promise<unknown>>();
  manifest: BuildManifest = {};

  setup = (build: Bun.PluginBuilder) => {
    build.onLoad({ filter: /.*/ }, (args) => {
      if (!this.files.has(args.path)) {
        this.files.set(args.path, this.processFile(args.path));
      }
      return;
    });
  };

  getManifest = async () => {
    await Promise.all(Array.from(this.files.values()));
    return this.manifest;
  };

  private processFile = async (path: string) => {
    const file = await Bun.file(path).stat();
    this.manifest[path] = {
      size: file.size,
      mtime: file.mtimeMs,
    };
  };
}

class BuildError extends Error {
  readonly errors?: (BuildMessage | ResolveMessage)[];
  constructor(
    message: string,
    options?: ErrorOptions & { errors?: (BuildMessage | ResolveMessage)[] }
  ) {
    super(message, options);
    this.errors = options?.errors;
  }
}

const build = (props: BuildProps) => {
  const traceInputPlugin = new TraceInputPlugin();
  return ResultAsync.fromPromise(
    Bun.build({
      entrypoints: [props.path],
      outdir: props.outdir,
      format: props.format,
      target: props.target,
      minify: props.minify,
      sourcemap: props.sourcemap,
      plugins: [traceInputPlugin],
    }),
    (error) => {
      if (error instanceof AggregateError) {
        return new BuildError(error.message, {
          errors: error.errors,
        });
      }
      return new BuildError("An unexpected error occurred", {
        cause: error,
      });
    }
  ).andThen((result) => {
    const entry = result.outputs.find((o) => o.kind === "entry-point");
    if (!entry) {
      return err(new BuildError("No entry point found"));
    }
    return ResultAsync.fromSafePromise(traceInputPlugin.getManifest()).map(
      (manifest) => ({
        entry: BuildFile.fromArtifact(entry),
        files: result.outputs
          .filter((o) => o.kind !== "entry-point")
          .map((o) => BuildFile.fromArtifact(o)),
        manifest,
      })
    );
  });
};

const hasChanged = (manifest: BuildManifest) => {
  return ResultAsync.fromSafePromise(
    new Promise<boolean>((resolve) => {
      let isResolved = false;
      Promise.all(
        Object.entries(manifest).map(([path, metadata]) =>
          hasFileChanged(path, metadata).then((changed) => {
            if (changed && !isResolved) {
              isResolved = true;
              console.log("changed", path);
              resolve(true);
            }
          })
        )
      ).then(() => {
        if (!isResolved) {
          isResolved = true;
          resolve(false);
        }
      });
    })
  );
};
const hasFileChanged = async (
  path: string,
  metadata: { size: number; mtime: number }
): Promise<boolean> => {
  const file = Bun.file(path);
  try {
    const stat = await file.stat();
    return stat.mtimeMs !== metadata.mtime;
  } catch {
    return true;
  }
};

type BuildFileKind =
  | "entry-point"
  | "chunk"
  | "asset"
  | "sourcemap"
  | "bytecode";

class BuildFile {
  constructor(
    readonly path: string,
    readonly kind: BuildFileKind,
    readonly file: Blob = Bun.file(path)
  ) {}

  text = () => this.file.text();
  bytes = () => this.file.bytes();

  toJSON = () => ({
    path: this.path,
    kind: this.kind,
  });

  toString = () => JSON.stringify(this);

  static fromJSON = (
    input:
      | {
          path: string;
          kind: BuildFileKind;
        }
      | BuildFile
  ) => {
    if (input instanceof BuildFile) {
      return input;
    }
    return new BuildFile(input.path, input.kind);
  };

  static fromArtifact = (artifact: Bun.BuildArtifact) => {
    return new BuildFile(artifact.path, artifact.kind, artifact);
  };
}
