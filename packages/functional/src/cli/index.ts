import { Command } from "commander";
import chalk from "chalk";
import { version } from "../../package.json" with { type: "json" };
import type { CLIConfig } from "./types";
import { InitCommand } from "./init";

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
  const { directory, config } = program.opts<CLIConfig>();
  const init = new InitCommand({ directory, config });
  await init.run();
  console.log("init");
});

program.hook("preAction", (command) => {
  const { directory, config } = command.opts<CLIConfig>();
  console.log("preAction", directory, config);
});

program.command("dev").action(() => {
  console.log("dev");
});

program.command("build").action(() => {
  console.log("build");
});

program.parse(process.argv);
