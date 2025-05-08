import { Resource } from "./core/resource";
import { computeFileHash } from "./lib/file";

interface CommandInput {
  /**
   * The command to run
   */
  command: string;
  /**
   * The directory to run the command in
   */
  directory?: string;
  /**
   * The files or directories to watch for changes
   */
  triggers?: string[];
}

type CommandOutput = Record<string, string>;

type CommandResourceProperties = Resource.CRUDProperties<
  CommandInput,
  CommandOutput
>;

export class Command extends Resource<CommandResourceProperties> {
  readonly kind = "command";

  static get provider() {
    return new CommandProvider();
  }

  constructor(name: string, input: CommandInput, metadata?: Resource.Metadata) {
    super(Command.provider, name, input, metadata);
  }
}

class CommandProvider implements Resource.Provider<CommandResourceProperties> {
  create = async (input: Resource.Input<CommandResourceProperties>) => {
    await this.run(input);
    return {
      output: await this.readTriggers(input),
    };
  };

  diff = async (
    input: Resource.Input<CommandResourceProperties>,
    state: Resource.State<CommandResourceProperties>,
  ) => {
    if (!Bun.deepEquals(input, state.input) || !input.triggers) {
      return "replace";
    }
    const triggers = await this.readTriggers(input);
    if (!Bun.deepEquals(triggers, state.output)) {
      return "replace";
    }
    return "none";
  };

  private async readTriggers(
    input: Resource.Input<CommandResourceProperties>,
  ): Promise<CommandOutput> {
    const files: CommandOutput = {};
    if (!input.triggers) {
      return files;
    }
    await Promise.all(
      input.triggers.map(async (trigger) => {
        const glob = new Bun.Glob(trigger);
        for await (const file of glob.scan({
          cwd: input.directory,
        })) {
          files[file] = await computeFileHash(Bun.file(file));
        }
      }),
    );
    return files;
  }

  private async run(input: Resource.Input<CommandResourceProperties>) {
    const { command, directory } = input;
    const child = Bun.spawn(command.split(" "), {
      cwd: directory,
      stdio: ["inherit", "inherit", "inherit"],
    });
    await child.exited;
  }
}
