// // Sandbox for trying to get the worker build to work
// // Thought we'd have to switch to esbuild for a second but was able to get it working with Bun!

// // import esbuild from "esbuild";
// import path from "path";
// import { cloudflare } from "unenv";

// const worker = path.join(process.cwd(), "../../examples/worker/index.ts");
// const { alias, external, polyfill } = cloudflare;
// // console.log({ alias, external, polyfill });
// const result = await Bun.build({
//   entrypoints: [worker],
//   outdir: "dist",
//   target: "node",
//   format: "esm",
//   conditions: ["workerd", "worker", "browser"],
//   external,
//   plugins: [
//     {
//       name: "cloudflare",
//       setup(build) {
//         const aliases = new Map<string, string>();
//         for (const [key, value] of Object.entries(alias ?? {})) {
//           if (!key.startsWith("node:") && value.startsWith("node:")) {
//             aliases.set(value, key);
//           }
//         }
//         const aliasRegex = new RegExp(
//           `\\b(${Array.from(aliases.keys()).join("|")})\\b`
//         );
//         build.onResolve({ filter: aliasRegex }, (args) => {
//           console.log("resolve", args);
//           return { path: args.path, namespace: "node", external: true };
//         });
//       },
//     },
//   ],
// });

// // await esbuild.build({
// //   entryPoints: [self.resolvePath(workerOptions.entry)],
// //   outfile: self.resolveOutputPath("worker.js"),
// //   target: "esnext",
// //   format: "esm",
// //   platform: "node",
// //   minify: true,
// //   conditions: ["workerd", "worker", "browser"],
// //   external: [...(external ?? [])],
// //   alias,
// //   bundle: true,
// //   write: true,
// //   metafile: true,
// //   banner: {
// //     js: [
// //       `import { createRequire as topLevelCreateRequire } from 'module';`,
// //       `const require = topLevelCreateRequire("/");`,
// //     ].join("\n"),
// //   },
// // });
// // return Bun.file(self.resolveOutputPath("worker.js"));
