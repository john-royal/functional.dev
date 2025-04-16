await Bun.build({
  entrypoints: ["./src/miniflare.ts"],
  target: "bun",
  format: "esm",
  outdir: "dist",
});
