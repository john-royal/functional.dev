export function unenvBuildPlugin(): Bun.BunPlugin {
  return {
    name: "unenv",
    setup: (build) => {
      build.onResolve({ filter: /(node:)?(fs|fs\/promises)/ }, (args) => {
        if (
          args.resolveDir.includes("node_modules/unenv") &&
          !args.path.startsWith("node:")
        ) {
          return null;
        }
        const name = args.path.replace("node:", "");
        const path = Bun.fileURLToPath(
          import.meta.resolve(`unenv/node/${name}`)
        );
        return { path };
      });
    },
  };
}
