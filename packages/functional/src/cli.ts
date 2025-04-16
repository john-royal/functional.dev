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
import {
  functionalSecretSymbol,
  type Binding,
  type BindingValue,
} from "./config/binding";
import type { Config } from "./config/config";
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
  const config = (await import(configPath)).default as Config;

  const isBinding = (value: unknown): value is Binding =>
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "type" in value;

  const envProxy = new Proxy(config.env, {
    get(target, prop: string): Binding {
      if (!(prop in target) || typeof target[prop] === "undefined") {
        throw new Error(`Unknown binding: ${prop}`);
      }
      const value = target[prop];

      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        return {
          name: prop,
          type: "variable",
          value,
        };
      }

      if (functionalSecretSymbol in value) {
        const envName =
          (value[functionalSecretSymbol] as string | undefined) ?? prop;
        const valueFromEnv = process.env[envName];
        if (valueFromEnv === undefined) {
          throw new Error(`Unknown secret: ${envName}`);
        }
        return {
          name: prop,
          type: "secret",
          value: valueFromEnv,
        };
      }

      throw new Error(`Unknown binding: ${prop}`);
    },
  }) as Record<string, Binding>;

  const resources: Resource[] = await registerResources(() =>
    config.setup({ env: envProxy })
  );

  for (const resource of resources) {
    switch (resource.kind) {
      case "worker": {
        let devVars = "";
        const outputPath = path.join(functional, resource.options.name);
        const wranglerConfigPath = path.join(outputPath, "wrangler.jsonc");
        const wranglerConfig: WranglerConfig = {
          name: `${config.name}-${resource.options.name}`,
          compatibility_date: "2025-04-10",
          compatibility_flags: ["nodejs_compat_v2"],
          main: path.relative(
            outputPath,
            path.join(cwd, resource.options.entry)
          ),
          vars: resource.options.bindings?.reduce((acc, b) => {
            const binding = b;
            console.log(binding);
            if (binding.type === "variable") {
              acc[binding.name] = binding.value;
            } else {
              devVars += `${binding.name}=${JSON.stringify(binding.value)}\n`;
            }
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
          await Bun.write(path.join(outputPath, ".dev.vars"), devVars);
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

  const resolvedConfig = { ...config, resources };
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
