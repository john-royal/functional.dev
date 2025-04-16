// test script for dev server

import { watch } from "fs";
import { Miniflare } from "miniflare";

const script = "./build/test.ts";
const outdir = `./.out`;

async function build(entry: string) {
  const built = await Bun.build({
    entrypoints: [entry],
    target: "node",
    format: "esm",
    sourcemap: "external",
    outdir,
  });
  const entrypoint = built.outputs.find((o) => o.kind === "entry-point");
  if (!entrypoint) {
    throw new Error("No entrypoint found");
  }
  return entrypoint.path;
}

console.time("build");
const scriptPath = await build(script);
console.timeEnd("build");

const miniflare = new Miniflare({
  workers: [
    {
      name: "test",
      scriptPath,
      modules: true,
    },
  ],
});

console.time("start");
await miniflare.ready;
console.timeEnd("start");

const server = Bun.serve({
  fetch(request) {
    return miniflare.dispatchFetch(request) as unknown as Promise<Response>;
  },
});

console.log(`Started dev server at ${server.url.toString()}`);

let updatedAt = Date.now();

const handleUpdate = async () => {
  const now = Date.now();
  updatedAt = now;
  let entry: string;

  console.time("rebuild");
  try {
    entry = await build(script);
  } catch (error) {
    console.error("rebuild failed", error);
    return;
  } finally {
    console.timeEnd("rebuild");
  }
  if (updatedAt > now) {
    console.log("script changed before build finished");
    return;
  }
  console.time("reload");
  try {
    await miniflare.setOptions({
      name: "test",
      scriptPath: entry,
      modules: true,
    });
  } catch (error) {
    console.error("reload failed", error);
  } finally {
    console.timeEnd("reload");
  }
};

watch(script, () => {
  console.log("detected file change");
  handleUpdate();
});
