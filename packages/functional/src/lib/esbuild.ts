import { cloudflare } from "@cloudflare/unenv-preset";
import { defineEnv } from "unenv";
import esbuild from "esbuild";
import path from "node:path";
import { standardURLPlugin } from "./esbuild-plugin-url";
import { nodejsHybridPlugin } from "./esbuild-plugin-nodejs-hybrid";

const { alias, inject, external, polyfill } = defineEnv({
  presets: [cloudflare],
  npmShims: true,
  nodeCompat: true,
}).env;

console.log(inject, polyfill);
export const build = async (entry: string, outdir: string) => {
  console.time("build");
  const result = await esbuild.build({
    entryPoints: [entry],
    outdir,
    bundle: true,
    minify: false,
    sourcemap: "external",
    conditions: ["workerd", "worker", "browser"],
    external: [...external, "cloudflare:*"],
    sourceRoot: path.resolve(path.dirname(entry)),
    alias: {
      ...alias,
      path: "unenv/node/path",
      "path/win32": "unenv/node/path/win32",
      "path/posix": "unenv/node/path/posix",
      "node:path": "unenv/node/path",
      "node:path/win32": "unenv/node/path/win32",
      "node:path/posix": "unenv/node/path/posix",
    },
    metafile: true,
    platform: "browser",
    format: "esm",
    tsconfig: path.resolve(path.dirname(entry), "../tsconfig.json"),
    plugins: [await nodejsHybridPlugin(), standardURLPlugin()],
  });
  console.timeEnd("build");
  const outputs = result.metafile.outputs;
  let entrypoint: Bun.BunFile | undefined;
  let sourcemap: Bun.BunFile | undefined;
  for (const [name, output] of Object.entries(outputs)) {
    if (output.entryPoint) {
      entrypoint = Bun.file(name);
    } else {
      sourcemap = Bun.file(name);
    }
  }
  if (!entrypoint || !sourcemap) {
    throw new Error("No entrypoint or sourcemap found");
  }
  return Object.assign(entrypoint, { sourcemap });
};
