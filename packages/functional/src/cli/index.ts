#!/usr/bin/env bun

import { Command, program } from "commander";
import path from "path";
import type { Config } from "../config";
import { $functional, configureFunctional } from "../resources/util";

const configure = async (): Promise<Config> => {
  const cwd = cli.getOptionValue("directory");
  const relativeConfigPath = cli.getOptionValue("config");

  const configPath = path.join(cwd, relativeConfigPath);

  try {
    console.log(process.env.TEST_SECRET_VAR);
    console.log(`[functional] Using config file at ${configPath}`);
    const file = await import(configPath);
    const config = file.default;
    await configureFunctional({
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
    "-d, --directory <path>",
    "Path to the directory to run the command in",
    process.cwd()
  )
  .option(
    "-c, --config <path>",
    "Path to the functional config file, relative to the working directory",
    "functional.config.ts"
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
    new Command("deploy").description("Deploy the project").action(async () => {
      console.log(`[functional] Deploying project`);
      const config = await configure();
      await Promise.all(
        config.setup().map(async ({ resource, scope, options }) => {
          const state = $functional.store.get(`state:${scope.globalId}`);
          if (state) {
            await resource.update?.({
              self: scope,
              options,
              state,
            });
          } else {
            const state = await resource.create?.({
              self: scope,
              options,
            });
            $functional.store.set(`state:${scope.globalId}`, state);
          }
        })
      );
      console.log(`[functional] Deployed project`);
      await $functional.store.save();
      console.log(`[functional] Exiting`);
    })
  )
  .addCommand(
    new Command("remove").description("Remove the project").action(async () => {
      console.log(`[functional] Removing project`);
      const config = await configure();
      console.log(Array.from($functional.store.keys()));
      await Promise.all(
        config.setup().map(async ({ resource, scope, options }) => {
          const state = $functional.store.get(`state:${scope.globalId}`);
          if (!state) {
            console.log(
              `[functional] Resource ${scope.globalId} not found, skipping`
            );
            return;
          }
          await resource.delete?.({
            self: scope,
            options,
            state,
          });
          $functional.store.delete(`state:${scope.globalId}`);
        })
      );
      console.log(`[functional] Removed project`);
      await $functional.store.save();
      console.log(`[functional] Exiting`);
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
