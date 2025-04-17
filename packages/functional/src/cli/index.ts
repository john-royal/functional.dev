#!/usr/bin/env bun

import { Command, program } from "commander";
import path from "path";
import type { Config } from "../config";
import { $functional, configureFunctional } from "../resources/util";

const configure = async (): Promise<Config> => {
  const configPath = cli.getOptionValue("config");

  try {
    console.log(`[functional] Using config file at ${configPath}`);
    const file = await import(configPath);
    const config = file.default;
    configureFunctional({
      app: {
        name: config.name,
        environment:
          config.environment ?? process.env.NODE_ENV ?? "development",
      },
    });
    console.log(`[functional] App: ${$functional.app.name}`);
    console.log(`[functional] Environment: ${$functional.app.environment}`);
    return config;
  } catch (error) {
    console.error(`[functional] Cannot find config file at ${configPath}.`);
    process.exit(1);
  }
};

const cli = program
  .name("functional")
  .version("0.0.1")
  .option(
    "-c, --config <path>",
    "Path to the functional config file",
    path.join(process.cwd(), "functional.config.ts")
  )
  .addCommand(
    new Command("dev")
      .description("Start the development server")
      .hook("preAction", async () => {})
      .action(async () => {
        console.log(`[functional] Starting development server`);
        const config = await configure();
        const resources = config.setup().map((r) => {
          return {
            ...r,
            scope: r.scope,
          };
        });
        console.log(resources);
      })
  )
  .addCommand(
    new Command("types")
      .description("Generate the types for the project")
      .action(async () => {
        const config = await configure();
        for (const { resource, scope, options } of config.setup()) {
          await resource.types?.({
            self: scope,
            options,
          });
        }
      })
  );

cli.parse(process.argv);
