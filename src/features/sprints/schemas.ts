import { z } from "zod";
import { SprintStatus } from "./types";

export const createSprintSchema = z.object({
  workspaceId: z.string().trim().min(1, "Required"),
  projectId: z.string().trim().nullish(),
  name: z.string().trim().min(1, "Sprint name is required"),
  goal: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const updateSprintSchema = z.object({
  name: z.string().trim().min(1, "Sprint name is required").optional(),
  goal: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.nativeEnum(SprintStatus).optional(),
});
