import { z } from "zod";

export const CloudflareName = z
  .string()
  .transform((name) => name.toLowerCase().replace(/[^a-z0-9]/g, "-"));
