import { z } from "zod";
import { Id } from "../id.ts";

export const Origin = z
  .enum(["student", "starter", "ai"])
  .meta({ description: "Who created the element: the student, a starter case, or an AI model." });
export type Origin = z.infer<typeof Origin>;

// SPEC.md section 3.2: the fields every element has.
export const commonFields = {
  id: Id,
  name: z.string().meta({ description: "The element's name. May be empty while work is in progress." }),
  description: z.string().meta({ description: "A short description. May be empty." }),
  aliases: z.array(z.string()).meta({ description: "Other names the business uses for the same thing." }),
  notes: z.string().meta({ description: "Working notes and open questions. Never checked." }),
  origin: Origin,
};
