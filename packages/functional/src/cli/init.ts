import { $ } from "bun";
import path from "node:path";
import { CLI_MODE, VERSION } from "./constants";
import type { CLIConfig } from "./types";
import dedent from "dedent";

export class InitCommand {
  pkgFile: Bun.BunFile;
  pkg: Promise<{
    name?: string;
    scripts?: Record<string, string>;
    packageManager?: string;
    devDependencies?: Record<string, string>;
  }>;

  constructor(private readonly config: CLIConfig) {
    this.pkgFile = Bun.file(path.join(this.config.directory, "package.json"));
    this.pkg = this.pkgFile.json().catch(() => {
      throw new Error("package.json not found");
    });
  }

  async run() {
    await Promise.all([
      this.ensureDependencies(),
      this.ensureGitignore(),
      this.ensureConfig(),
    ]);
  }

  async ensureDependencies() {
    const pkg = await this.pkg;
    const hasFunctionalDev = !!pkg.devDependencies?.["functional.dev"];
    if (!hasFunctionalDev) {
      const packageManager =
        pkg.packageManager?.split("@")[0] ??
        (await detectPackageManagerFromLockfile(this.config.directory));
      const version = CLI_MODE === "local" ? "workspace:*" : `^${VERSION}`;
      pkg.devDependencies ??= {};
      pkg.devDependencies["functional.dev"] = version;
      await this.pkgFile.write(JSON.stringify(pkg, null, 2));
      await $`${packageManager} install`;
    }
  }

  async ensureGitignore() {
    const file = Bun.file(path.join(this.config.directory, ".gitignore"));
    let content = (await file.text().catch(() => "")).trim();
    let write = false;
    if (!content.includes("node_modules")) {
      content += "\n\n# dependencies\nnode_modules";
      write = true;
    }
    if (!content.includes(".functional")) {
      content += "\n\n# functional\n.functional";
      write = true;
    }
    if (!content.includes(".env")) {
      content += "\n\n# environment\n.env";
      write = true;
    }
    if (write) {
      await file.write(content + "\n");
    }
  }

  async ensureConfig() {
    const file = Bun.file(path.join(this.config.directory, this.config.config));
    if (await file.exists()) {
      return;
    }
    const projectName =
      (await this.pkg).name ?? path.basename(this.config.directory);
    await file.write(
      dedent`import { defineConfig } from "functional.dev/config";
    
    export default defineConfig({
      name: "${projectName}",
      setup: () => {
        // Define your setup here
      },
    });
    `
    );
  }
}

const detectPackageManagerFromLockfile = async (
  directory: string
): Promise<"npm" | "yarn" | "pnpm" | "bun"> => {
  const lockfiles = {
    "package-lock.json": "npm",
    "yarn.lock": "yarn",
    "pnpm-lock.yaml": "pnpm",
    "bun.lockb": "bun",
    "bun.lock": "bun",
  } as const;
  for (const [lockfileName, packageManager] of Object.entries(lockfiles)) {
    // TODO: Detect workspace lockfile
    const file = Bun.file(path.join(directory, lockfileName));
    if (await file.exists()) {
      return packageManager;
    }
  }
  // TODO: Prompt user to select package manager
  return "bun";
};
