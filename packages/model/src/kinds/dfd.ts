import { z } from "zod";
import { Id } from "../id.ts";
import { commonFields } from "./common.ts";

const ordinal = z.int().min(0);

export const Process = z.strictObject({
  kind: z.literal("process"),
  ...commonFields,
  parentProcessId: Id.nullable().meta({ description: "The process this one decomposes, or null for process 0." }),
  ordinal: ordinal.meta({ description: "The last part of the process number. 0 only for process 0." }),
  processDescription: z.string().meta({ description: "The longer step-by-step text of what the process does." }),
});
export type Process = z.infer<typeof Process>;

export const ExternalEntity = z.strictObject({
  kind: z.literal("externalEntity"),
  ...commonFields,
});
export type ExternalEntity = z.infer<typeof ExternalEntity>;

export const DataStore = z.strictObject({
  kind: z.literal("dataStore"),
  ...commonFields,
  ordinal: z.int().min(1).meta({ description: "The number in the store's label, D followed by this number. Never renumbered." }),
});
export type DataStore = z.infer<typeof DataStore>;

export const DataFlow = z.strictObject({
  kind: z.literal("dataFlow"),
  ...commonFields,
  diagramId: Id.meta({ description: "The one diagram the flow belongs to." }),
  sourceId: Id.nullable().meta({ description: "The element the flow starts from, or null while unattached." }),
  targetId: Id.nullable().meta({ description: "The element the flow ends at, or null while unattached." }),
  dataId: Id.meta({ description: "The one data structure or data element the flow carries; its name is the flow's label." }),
});
export type DataFlow = z.infer<typeof DataFlow>;

export const ControlFlow = z.strictObject({
  kind: z.literal("controlFlow"),
  ...commonFields,
  diagramId: Id.meta({ description: "The one diagram the control flow belongs to." }),
  targetId: Id.meta({ description: "The process the event starts, shown on the control flow's diagram." }),
});
export type ControlFlow = z.infer<typeof ControlFlow>;
