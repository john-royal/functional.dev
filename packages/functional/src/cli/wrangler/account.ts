import { $ } from "bun";
import { z } from "zod";

export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  scopes: z.record(
    z.string(),
    z.union([z.literal("read"), z.literal("write"), z.literal(true)])
  ),
});
export type Account = z.infer<typeof accountSchema>;

export const getAccount = async () => {
  const output = await $`wrangler whoami`.text();
  return parseAccount(output);
};

export const login = async () => {
  await $`wrangler login`;
};

export const parseAccount = (output: string): Account | null => {
  if (output.includes("You are not authenticated")) {
    return null;
  }

  const emailMatch = output.match(/associated with the email ([^\s]+)./);
  const email = emailMatch?.[1];

  const accountNameMatch = output.match(/│\s+(.*?)\s+│\s+([a-f0-9]+)\s+│/);
  const name = accountNameMatch?.[1]?.trim();
  const id = accountNameMatch?.[2]?.trim();

  const scopesSection = output.split("Scope (Access)")[1];

  const scopes: { [key: string]: "read" | "write" | true } = {};
  scopesSection
    ?.matchAll(/^- (.*?)(\s+\((read|write)\))?$/gm)
    .forEach((match) => {
      const scopeName = match[1]!.trim();
      const permission = match[3] ? match[3].trim() : true;
      scopes[scopeName] = permission as "read" | "write" | true;
    });

  return accountSchema.parse({
    id,
    name,
    email,
    scopes,
  });
};
