import { readdir } from "node:fs/promises";
import path from "node:path";
import Ignore from "ignore";
import { Resource } from "~/core/resource";
import sha256 from "~/lib/sha256";

export interface WorkerAssetsInput {
  scriptName: string;
  path: string;
}

export type WorkerAssetsManifest = Record<
  string,
  {
    size: number;
    hash: string;
  }
>;

export interface WorkerAssetsOutput {
  headers?: string;
  redirects?: string;
  manifest: WorkerAssetsManifest;
}

export type WorkerAssetsProperties = Resource.CRUDProperties<
  WorkerAssetsInput,
  WorkerAssetsOutput
>;

export class WorkerAssetsProvider
  implements Resource.Provider<WorkerAssetsProperties>
{
  async create(
    input: WorkerAssetsInput,
  ): Promise<{ output: WorkerAssetsOutput }> {
    return {
      output: await this.get(input),
    };
  }

  async diff(
    input: WorkerAssetsInput,
    state: { input: WorkerAssetsInput; output: WorkerAssetsOutput },
  ): Promise<"update" | "replace" | "none"> {
    const output = await this.get(input);
    if (
      output.headers === state.output.headers &&
      output.redirects === state.output.redirects &&
      Bun.deepEquals(output.manifest, state.output.manifest)
    ) {
      return "none";
    }
    return "replace";
  }

  private async get(input: WorkerAssetsInput) {
    const readText = (name: string) =>
      Bun.file(path.join(process.cwd(), input.path, name))
        .text()
        .catch(() => undefined);
    const [fileNames, ignore, headers, redirects] = await Promise.all([
      readdir(path.join(process.cwd(), input.path), { recursive: true }),
      readText(".assetsignore"),
      readText("_headers"),
      readText("_redirects"),
    ]);
    const matcher = Ignore().add([
      ".assetsignore",
      "_headers",
      "_redirects",
      ...(ignore?.split("\n") ?? []),
    ]);
    const manifest: WorkerAssetsManifest = {};
    await Promise.all(
      fileNames.map(async (fileName) => {
        if (matcher.ignores(fileName)) {
          return;
        }
        const filePath = path.join(input.path, fileName);
        const file = Bun.file(filePath);
        const stat = await file.stat();
        if (!stat.isDirectory()) {
          if (!fileName.startsWith("/")) {
            // biome-ignore lint/style/noParameterAssign: Cloudflare requires paths to start with a slash
            fileName = `/${fileName}`;
          }
          const bytes = await file.bytes();
          const hash = sha256(bytes).slice(0, 32);
          manifest[fileName] = {
            size: stat.size,
            hash,
          };
        }
      }),
    );
    return {
      headers,
      redirects,
      manifest,
    };
  }
}

export default class WorkerAssets extends Resource<WorkerAssetsProperties> {
  readonly kind = "cloudflare:worker:assets";

  constructor(name: string, input: WorkerAssetsInput) {
    super(new WorkerAssetsProvider(), name, input);
  }
}
