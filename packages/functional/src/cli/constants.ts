import { version } from "../../package.json" with { type: "json" };

export const CLI_MODE: "local" | "package" = "local";
export const VERSION = version;
