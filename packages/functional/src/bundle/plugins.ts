import path from "node:path";
import { computeFileHash } from "~/lib/file";

export class TraceInputPlugin implements Bun.BunPlugin {
  readonly name = "trace-input";

  files = new Map<string, Promise<string>>();

  setup = (build: Bun.PluginBuilder) => {
    build.onLoad({ filter: /.*/ }, ({ path }) => {
      if (!this.files.has(path)) {
        this.files.set(path, computeFileHash(Bun.file(path)));
      }
      return;
    });
  };

  async getManifest(): Promise<Record<string, string>> {
    return Object.fromEntries(
      await Promise.all(
        this.files
          .entries()
          .map(async (file) => [
            path.relative(process.cwd(), file[0]),
            await file[1],
          ]),
      ),
    );
  }
}
