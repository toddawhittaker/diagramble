import { z } from "zod";
import { Id } from "../id.ts";
import { commonFields } from "./common.ts";

export const Component = z.strictObject({
  dataId: Id.meta({ description: "The data structure or data element that is part of this structure." }),
  occurs: z.enum(["once", "optional", "many"]).meta({ description: "How often the part occurs." }),
  limit: z.int().min(1).nullable().meta({ description: "The most times the part can occur, used only when occurs is many; null for no limit." }),
});
export type Component = z.infer<typeof Component>;

export const DataStructure = z.strictObject({
  kind: z.literal("dataStructure"),
  ...commonFields,
  components: z.array(Component).meta({ description: "The parts of the structure, in order." }),
});
export type DataStructure = z.infer<typeof DataStructure>;

export const AllowedValue = z.strictObject({
  value: z.string(),
  meaning: z.string().meta({ description: "What the value stands for." }),
});
export type AllowedValue = z.infer<typeof AllowedValue>;

export const DataElement = z.strictObject({
  kind: z.literal("dataElement"),
  ...commonFields,
  dataType: z.string().meta({ description: "The type of the data, as text, such as date or text." }),
  allowedValues: z.array(AllowedValue).meta({ description: "The values the element may take, with their meanings; empty for any value." }),
});
export type DataElement = z.infer<typeof DataElement>;
