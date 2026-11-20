import { z } from "zod";

// Letters, digits, `_` and `-` only, so a JSON Patch path never needs escaping;
// the three names are refused because they are special as object keys.
const RESERVED = new Set(["__proto__", "constructor", "prototype"]);

export const Id = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/)
  .refine((value) => !RESERVED.has(value), { message: "This name cannot be used as an id." })
  .meta({ description: "An identifier: 1 to 64 letters, digits, underscores or hyphens, unique within the project." });

export type Id = z.infer<typeof Id>;
