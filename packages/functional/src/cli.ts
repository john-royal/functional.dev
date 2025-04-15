#!/usr/bin/env bun

import { $ } from "bun";
import chalk from "chalk";
import { Command, program } from "commander";
import fs from "fs";
import path from "path";
import packageJson from "../package.json";
import { Cache } from "./cli/cache";
import * as wrangler from "./cli/wrangler";
import type { WranglerConfig } from "./cli/wrangler-config";
import type { Resource } from "./config";
import type { Binding, BindingValue } from "./config/binding";
import { Config } from "./config/config";
import { registerResources } from "./config/registry";

const cwd = process.cwd();
const functional = path.join(cwd, ".functional");
const cache = new Cache(path.join(functional, "cache.json"));

const resolveConfigPath = async () => {
  const configPath = path.join(cwd, "functional.config.ts");
  const config = Bun.file(configPath);
  if (await config.exists()) {
    return configPath;
  }
  throw new Error(`No functional.config.ts found in directory ${cwd}`);
};

const configure = async (configPath: string) => {
  await cache.load();

  await Promise.all([ensureAccount(), ensureGitignore()]);
  return await runConfig(configPath);
};

const ensureAccount = async () => {
  const account = await cache.wrap("wrangler-account", wrangler.getAccount);
  if (!account) {
    await wrangler.login();
    cache.set("wrangler-account", wrangler.getAccount());
  }
};

const ensureGitignore = async () => {
  const gitignore = `${cwd}/.gitignore`;
  const file = Bun.file(gitignore);
  if (await file.exists()) {
    const content = await file.text();
    if (!content.includes(".functional")) {
      await file.write(`${content}\n\n# functional\n.functional\n`);
    }
  } else {
    console.log("Creating .gitignore");
    await file.write(
      [
        "# dependencies",
        "node_modules",
        "",
        "# functional",
        ".functional",
      ].join("\n")
    );
  }
};

interface ResolvedResource extends Resource {
  path: string;
  wrangler: string;
}

const runConfig = async (configPath: string): Promise<ResolvedResource[]> => {
  const { default: input } = await import(configPath);
  const { app, env, setup } = Config.parse(input);

  const envProxy = new Proxy(env, {
    get(target, prop: string): Binding {
      if (prop in target && target[prop] !== undefined) {
        return {
          name: prop,
          type: "variable",
          value: target[prop],
        };
      } else {
        console.warn(`Unknown binding: ${prop}`);
        return {
          name: prop,
          type: "variable",
          value: null,
        };
      }
    },
  });

  const resources: Resource[] = await registerResources(() =>
    setup({ app, env: envProxy })
  );

  for (const resource of resources) {
    switch (resource.kind) {
      case "worker": {
        const outputPath = path.join(functional, resource.options.name);
        const wranglerConfigPath = path.join(outputPath, "wrangler.jsonc");
        const wranglerConfig: WranglerConfig = {
          name: `${app.name}-${app.environment}-${resource.options.name}`,
          compatibility_date: "2025-04-10",
          compatibility_flags: ["nodejs_compat_v2"],
          main: path.relative(
            outputPath,
            path.join(cwd, resource.options.entry)
          ),
          vars: resource.options.bindings?.reduce((acc, binding) => {
            acc[binding.name] = binding.value;
            return acc;
          }, {} as Record<string, BindingValue>),
        };
        const wranglerConfigFile = Bun.file(wranglerConfigPath);
        const workerTypesFile = Bun.file(
          path.join(cwd, "worker-configuration.d.ts")
        );
        const newContent = JSON.stringify(wranglerConfig, null, 2);
        if (
          !(await wranglerConfigFile.exists()) ||
          (await wranglerConfigFile.text()) !== newContent ||
          !(await workerTypesFile.exists())
        ) {
          await wranglerConfigFile.write(newContent);
          await $`wrangler types --config ${wranglerConfigPath}`;
        }
        Object.assign(resource, {
          path: outputPath,
          wrangler: wranglerConfigPath,
        });
        break;
      }
    }
  }

  const resolvedConfig = { app, env, resources };
  console.log(resolvedConfig);
  cache.set("config", resolvedConfig);

  return resources as ResolvedResource[];
};

program
  .name("functional")
  .version(packageJson.version)
  .addCommand(
    new Command()
      .name("version")
      .description("Show the version number")
      .action(() => {
        console.log(chalk.blue(`functional v${packageJson.version}`));
      })
  )
  .addCommand(
    new Command()
      .name("dev")
      .description("Start the development server")
      .action(async () => {
        console.log(chalk.blue(`functional dev (v${packageJson.version})`));
        const configPath = await resolveConfigPath();

        async function load() {
          const resources = await configure(configPath);
          const processes: Bun.Subprocess[] = [];
          for (const resource of resources) {
            if (resource.kind === "worker") {
              processes.push(
                Bun.spawn(["wrangler", "dev", "--config", resource.wrangler], {
                  stdin: "inherit",
                  stdout: "inherit",
                  stderr: "inherit",
                })
              );
            }
          }
          return () => {
            for (const process of processes) {
              process.kill();
            }
          };
        }

        let stop: (() => void) | undefined;

        function reload() {
          stop?.();
          load().then((stopFn) => {
            stop = stopFn;
          });
        }

        fs.watch(configPath, () => {
          console.log("Reloading configuration");
          delete require.cache[require.resolve(configPath)];
          reload();
        });

        reload();
      })
  )
  .parse();

await cache.save();
