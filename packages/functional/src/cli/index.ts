#!/usr/bin/env bun

import { Command, program } from "commander";
import path from "path";
import type { Config } from "../config";
import { $functional, configureFunctional } from "../resources/util";
import { kFunctionalCreateBinding } from "../resources/cloudflare/binding";

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
      for (const item of config.setup()) {
        console.log("deploy", item.scope.globalId);
        const { resource, scope, options } = item;
        const createBinding = resource.binding;
        if (typeof createBinding === "function") {
          console.log(
            `[functional] Setting kFunctionalCreateBinding for ${scope.globalId}`
          );
          item[kFunctionalCreateBinding] = (name?: string) => {
            return createBinding({
              bindingNameOverride: name,
              self: scope,
              options,
              get state() {
                const state = $functional.store.get(`state:${scope.globalId}`);
                if (!state) {
                  throw new Error(
                    `[functional] Resource ${scope.globalId} not found, cannot create binding`
                  );
                }
                return state;
              },
            });
          };
        }
        const state = $functional.store.get(`state:${scope.globalId}`);
        if (state) {
          if (resource.update) {
            const newState = await resource.update?.({
              self: scope,
              options,
              state,
            });
            $functional.store.set(`state:${scope.globalId}`, newState);
          }
        } else {
          const newState = await resource.create?.({
            self: scope,
            options,
          });
          $functional.store.set(`state:${scope.globalId}`, newState);
        }
      }
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
    new Command("sync").description("Sync the project").action(async () => {
      const config = await configure();
      for (const item of config.setup()) {
        const { resource, scope, options } = item;
        const createBinding = resource.binding;
        if (typeof createBinding === "function") {
          console.log(
            `[functional] Setting kFunctionalCreateBinding for ${scope.globalId}`
          );
          item[kFunctionalCreateBinding] = (name?: string) => {
            const state = $functional.store.get(`state:${scope.globalId}`);
            return createBinding({
              bindingNameOverride: name,
              self: scope,
              options,
              state,
            });
          };
        }
        console.log("sync", scope.globalId);
        const currentState = $functional.store.get(`state:${scope.globalId}`);
        const newState = await resource.sync?.({
          self: scope,
          options,
          state: currentState,
        });
        if (newState) {
          $functional.store.set(`state:${scope.globalId}`, newState);
        }
      }
      await $functional.store.save();
      console.log(`[functional] Restored project`);
    })
  )
  .addCommand(
    new Command("types")
      .description("Generate the types for the project")
      .action(async () => {
        console.log("about to configure");
        const config = await configure();
        console.log("about to run types");
        for (const item of config.setup()) {
          console.log("types", item.scope.globalId);
          const { resource, scope, options } = item;
          const createBinding = resource.binding;
          if (typeof createBinding === "function") {
            console.log(
              `[functional] Setting kFunctionalCreateBinding for ${scope.globalId}`
            );
            item[kFunctionalCreateBinding] = (name?: string) => {
              const state = $functional.store.get(`state:${scope.globalId}`);
              return createBinding({
                bindingNameOverride: name,
                self: scope,
                options,
                state,
              });
            };
          }
          await resource.types?.({
            self: scope,
            options,
          });
        }
      })
  );

cli.parse(process.argv);
