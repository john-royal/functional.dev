import { Command } from "commander";
import chalk from "chalk";
import { version } from "../../package.json" with { type: "json" };
import type { CLIConfig } from "./types";
import { InitCommand } from "./init";
import { AsyncLocalStorage } from "node:async_hooks";

console.log(`
${chalk.greenBright("functional.dev")}
${chalk.gray(`v${version}`)}
`);

const program = new Command();

program
  .name("functional.dev")
  .version(version)
  .description("The functional.dev CLI")
  .option(
    "-d, --directory <directory>",
    "The directory to run the command in",
    process.cwd()
  )
  .option(
    "-c, --config <config>",
    "The config file to use, relative to the directory",
    "functional.config.ts"
  );

program.command("init").action(async () => {
  const config = program.opts<CLIConfig>();
  const init = new InitCommand(config);
  await init.run();
});

const storage = new AsyncLocalStorage<{
  config: CLIConfig;
}>();

program.hook("preAction", (command, actionCommand) => {
  if (actionCommand.name() === "init") {
    return;
  }
  const config = command.opts<CLIConfig>();
  storage.enterWith({ config });
});

program.command("dev").action(() => {
  const { config } = storage.getStore()!;
  console.log("dev", config);
});

program.command("build").action(() => {
  console.log("build");
});

program.parse(process.argv);
