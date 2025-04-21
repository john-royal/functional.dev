import { defineEnv } from "unenv";
import { cloudflare } from "@cloudflare/unenv-preset";
import { createHash } from "node:crypto";
const { alias, inject, external, polyfill } = defineEnv({
  presets: [cloudflare],
  npmShims: true,
}).env;
console.log(JSON.stringify({ alias, inject, external, polyfill }, null, 2));

const result = await Bun.build({
  entrypoints: ["../../examples/openauth/issuer.ts"],
  target: "node",
  splitting: true,
  sourcemap: "external",
  define: {
    "import.meta.url": "/",
  },
  plugins: [
    {
      name: "functional-build",
      setup(build) {
        const aliasRegex = new RegExp(`^(${Object.keys(alias).join("|")})$`);

        build.config.external = [...(external ?? []), "cloudflare:*"];

        build.onResolve({ filter: aliasRegex }, (args) => {
          const resolved = alias[args.path];
          if (!resolved) {
            throw new Error(`Alias not found: ${args.path}`);
          }
          const resolvedURL = import.meta.resolve(resolved);
          if (resolvedURL.startsWith("file://")) {
            return {
              path: Bun.fileURLToPath(resolvedURL),
              external: false,
            };
          }
        });

        build.onLoad({ filter: /.*/ }, async (args) => {
          const text = await Bun.file(args.path).text();
          const contents = [];
          if (text.match(/performance/)) {
            console.log("polyfill", args.path);
            contents.push(...(polyfill.map((p) => `import "${p}";`) ?? []));
          }
          if (text.match(/(console)|(process)/)) {
            contents.push(
              ...(Object.entries(inject).map(
                ([k, v]) => `import ${k} from "${v}";`
              ) ?? [])
            );
          }
          return {
            contents: [...contents, text].join("\n"),
          };
        });

        build.onResolve(
          {
            filter:
              /@cloudflare\/unenv-preset\/node\/(process|console|performance)/,
          },
          (args) => {
            const resolved = import.meta.resolve(args.path);
            if (resolved.startsWith("file://")) {
              return {
                path: Bun.fileURLToPath(resolved),
                external: false,
              };
            }
            return null;
          }
        );
      },
    },
  ],
  outdir: "./dist",
});

console.log(
  await Promise.all(
    result.outputs.map(async (o) => ({
      kind: o.kind,
      path: o.path,
      size: o.size,
      type: o.type,
      hash: createHash("sha256")
        .update(await Bun.file(o.path).bytes())
        .digest("hex"),
    }))
  )
);
