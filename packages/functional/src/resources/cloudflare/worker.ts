import type Cloudflare from "cloudflare";
import assert from "node:assert";
import { watch, type FSWatcher, type WatchListener } from "node:fs";
import path from "node:path";
import { $app } from "../../context";
import { Resource, type IResource } from "../base";
import { cfFetch, requireCloudflareAccountId } from "./api";

export interface IWorker extends IResource {
  kind: "worker";
  options: {
    entry: string;
    format?: "esm" | "cjs";
  };
}

export class Worker extends Resource<IWorker> {
  readonly kind = "worker";
  private scriptEntry = path.join($app.cwd, this.options.entry);
  private scriptOutDir = path.join($app.out, this.id);

  async dev() {
    const watchers = new Map<string, FSWatcher>();
    let updatedAt = Date.now();

    const buildDev = async () => {
      const devPlugin: Bun.BunPlugin = {
        name: "dev",
        setup: (builder) => {
          builder.onLoad({ filter: /\.(ts|js)$/ }, (args) => {
            console.log("onLoad", args);
            if (!watchers.has(args.path)) {
              // TODO: A better approach would be for the CLI to watch everything
              // and call a "reload" function here — the problem is we need
              // a way to know which file changes are relevant to this worker.
              watchers.set(args.path, watch(args.path, reload));
            }
          });
        },
      };
      return await this.buildScript([devPlugin]);
    };

    const reload = async () => {
      const now = Date.now();
      updatedAt = now;
      console.time("rebuild");
      const script = await buildDev();
      console.timeEnd("rebuild");
      if (updatedAt > now) {
        console.log("script changed during rebuild");
        return;
      }
      console.time("reload");
      // TODO: Figure out why this sometimes fails.
      // We can try recreating the Miniflare instance, but we should check the performance impact.
      await miniflare.setOptions({
        name: this.name,
        scriptPath: script.path,
        modules: this.scriptFormat === "esm",
      });
      console.timeEnd("reload");
    };

    console.time("setup");
    const [{ Miniflare }, script] = await Promise.all([
      import("miniflare"),
      buildDev(),
    ]);
    console.timeEnd("setup");

    const miniflare = new Miniflare({
      name: this.name,
      scriptPath: script.path,
      modules: this.scriptFormat === "esm",
    });

    return {
      fetch(request: Request) {
        return miniflare.dispatchFetch(request) as unknown as Promise<Response>;
      },
      reload,
      async stop() {
        for (const [path, watcher] of watchers.entries()) {
          console.log("closing watcher", path);
          watcher.close();
        }
        await miniflare.dispose();
      },
    };
  }

  async create() {
    return await this.putScript();
  }

  async update() {
    return await this.putScript();
  }

  async delete() {
    console.time("accountId");
    const accountId = await requireCloudflareAccountId();
    console.timeEnd("accountId");
    console.time("delete");
    const result = await cfFetch(
      `accounts/${accountId}/workers/scripts/${this.name}`,
      {
        method: "DELETE",
      }
    );
    console.timeEnd("delete");
    return result;
  }

  private async putScript() {
    const [script, accountId] = await Promise.all([
      this.buildScript(),
      requireCloudflareAccountId(),
    ]);
    const metadata = this.formatMetadata();

    const formData = new FormData();

    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], {
        type: "application/json",
      })
    );
    const scriptName = this.scriptFormat === "esm" ? "worker.js" : "script";
    formData.append(
      scriptName,
      new Blob([await script.text()], {
        type:
          this.scriptFormat === "esm"
            ? "application/javascript+module"
            : "application/javascript",
      }),
      scriptName
    );

    return await cfFetch(`accounts/${accountId}/workers/scripts/${this.name}`, {
      method: "PUT",
      body: formData,
    });
  }

  private formatMetadata() {
    return {
      compatibility_date: "2025-04-10",
      compatibility_flags: ["nodejs_compat_v2"],
      main_module: this.scriptFormat === "esm" ? "worker.js" : undefined,
      body_part: this.scriptFormat === "cjs" ? "script" : undefined,
    } satisfies Cloudflare.Workers.Scripts.ScriptUpdateParams.Metadata;
  }

  private async buildScript(plugins: Bun.BunPlugin[] = []) {
    const result = await Bun.build({
      entrypoints: [this.scriptEntry],
      target: "node",
      format: this.scriptFormat,
      outdir: this.scriptOutDir,
      sourcemap: "inline",
      plugins,
    });
    const output = result.outputs[0];
    assert(output?.kind === "entry-point", "Expected entry point");
    assert(result.outputs.length === 1, "Expected exactly one output");
    return output;
  }

  private get scriptFormat() {
    return this.options.format === "cjs" ? "cjs" : "esm";
  }
}

const withExponentialBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 10,
  initialDelay = 500
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      console.log("retrying", initialDelay * 2 ** i);
      await new Promise((resolve) =>
        setTimeout(resolve, initialDelay * 2 ** i)
      );
    }
  }
};

class Mutex {
  private promise: Promise<unknown> | null = null;

  async runWith<T>(fn: () => Promise<T>): Promise<T> {
    if (this.promise) {
      console.log("waiting for previous promise");
      return (await this.promise) as Promise<T>;
    }
    const { resolve, reject, promise } = Promise.withResolvers();
    this.promise = promise;
    try {
      const result = await fn();
      resolve(result);
      return result;
    } catch (error) {
      reject(error);
      throw error;
    } finally {
      this.promise = null;
    }
  }
}
