import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  type: z.enum(["STARTUP", "COLLEGE"]).default("STARTUP"),
  batchName: z.string().trim().optional(),
  academicYear: z.string().trim().optional(),
  image: z.union([
    z.instanceof(File),
    z.string().transform((value) => value === "" ? undefined : value),
  ])
  .optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Must be 1 or more characters").optional(),
  type: z.enum(["STARTUP", "COLLEGE"]).optional(),
  image: z.union([
    z.instanceof(File),
    z.string().transform((value) => value === "" ? undefined : value),
  ])
  .optional(),
});
