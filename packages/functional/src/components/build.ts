import { err, okAsync, ResultAsync } from "neverthrow";
import { rm } from "node:fs/promises";
import { InternalError } from "../lib/error";
import type { MaybeArray } from "../lib/utils";
import type { ResourceProvider } from "../resource";
import { Component } from "../resource";

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

type BuildError = MaybeArray<InternalError | BuildMessage | ResolveMessage>;

export const provider = {
  create: (props) => {
    return build(props).map((state) => ({
      id: "abc",
      state,
    }));
  },
  hydrate: (state) => ({
    entry: BuildFile.fromJSON(state.entry),
    files: state.files.map(BuildFile.fromJSON),
    manifest: state.manifest,
  }),
  diff: (props, current) => {
    if (!Bun.deepEquals(props, current.props)) {
      return okAsync({
        action: "replace",
      });
    }
    return hasChanged(current.state.manifest).map((changed) => ({
      action: changed ? "update" : "noop",
    }));
  },
  update: (state, props) => {
    return build(props);
  },
  delete: ({ props }) => {
    return ResultAsync.fromSafePromise(rm(props.outdir, { recursive: true }));
  },
} satisfies ResourceProvider<BuildProps, BuildState, BuildError>;

export class Build extends Component<BuildProps, BuildState, BuildError> {
  constructor(name: string, props: BuildProps) {
    super(provider, name, props);
  }
}

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
        return error.errors.map((error) =>
          error instanceof BuildMessage || error instanceof ResolveMessage
            ? error
            : InternalError.fromUnknown(error)
        );
      }
      return InternalError.fromUnknown(error);
    }
  ).andThen((result) => {
    const entry = result.outputs.find((o) => o.kind === "entry-point");
    if (!entry) {
      return err(new InternalError("No entry point found"));
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
          hasFileChangedPromise(path, metadata).then((changed) => {
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
const hasFileChangedPromise = (
  path: string,
  metadata: { size: number; mtime: number }
): Promise<boolean> => {
  return hasFileChanged(path, metadata).unwrapOr(true);
};

const hasFileChanged = (
  path: string,
  metadata: { size: number; mtime: number }
): ResultAsync<boolean, never> => {
  const file = Bun.file(path);
  return ResultAsync.fromSafePromise(file.stat()).map((stat) => {
    if (stat.mtimeMs !== metadata.mtime) {
      console.log("changed", path, stat.mtimeMs, metadata.mtime);
    }
    return stat.mtimeMs !== metadata.mtime;
  });
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
