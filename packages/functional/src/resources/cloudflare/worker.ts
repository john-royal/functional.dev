import { $app } from "../../context";
import { Resource, type IResource } from "../base";
import path from "node:path";

export interface IWorker extends IResource {
  kind: "worker";
  options: {
    entry: string;
  };
  state: {
    artifacts?: {
      path: string;
      hash: string | null;
    }[];
  };
}

export class Worker extends Resource<IWorker> {
  readonly kind = "worker";

  async create() {
    const bundle = await this.build();
    return Promise.resolve({
      artifacts: bundle.outputs.map((output) => ({
        path: output.path,
        hash: output.hash,
      })),
    });
  }

  update() {
    return Promise.resolve({});
  }

  delete() {
    return Promise.resolve({});
  }

  private async build() {
    const entry = path.join($app.cwd, this.options.entry);
    return await Bun.build({
      entrypoints: [entry],
      target: "node",
      outdir: path.join($app.out, this.id),
      sourcemap: "inline",
    });
  }
}
