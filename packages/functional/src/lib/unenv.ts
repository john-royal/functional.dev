import { cloudflare } from "@cloudflare/unenv-preset";
import { defineEnv } from "unenv";

export function unenvCloudflarePlugin(): Bun.BunPlugin {
  const { alias, inject, external, polyfill } = defineEnv({
    presets: [cloudflare],
    npmShims: true,
  }).env;

  const aliasRegex = new RegExp(`^(${Object.keys(alias).join("|")})$`);

  return {
    name: "cloudflare-unenv",
    setup(build) {
      build.config.external = [
        ...(build.config.external ?? []),
        ...(external ?? []),
        "cloudflare:*",
      ];
      build.config.define = {
        ...(build.config.define ?? {}),
        "import.meta.url": "/",
      };
      build.onResolve({ filter: aliasRegex }, (args) => {
        const resolved = import.meta.resolve(alias[args.path]!);
        if (resolved.startsWith("file://")) {
          console.log({
            alias: alias[args.path],
            importer: args.importer,
            resolved,
          });
          return { path: Bun.fileURLToPath(resolved), external: false };
        }
        return null;
      });
      // build.onLoad({ filter: /\.(ts|js)$/ }, async (args) => {
      //   const text = await Bun.file(args.path).text();
      //   return {
      //     contents: [
      //       ...polyfill.map((p) => `import "${p}";`),
      //       ...Object.entries(inject)
      //         .filter(([k]) => !text.includes(`import ${k} from`))
      //         .map(([k, v]) => `import ${k} from "${v}";`),
      //       text,
      //     ].join("\n"),
      //   };
      // });
    },
  };
}
