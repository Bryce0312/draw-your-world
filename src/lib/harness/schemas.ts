import { z } from "zod";

const visualFact = z.string()
  .trim()
  .min(1)
  .max(96)
  .refine((value) => !/```|<svg|<\/svg|<script|\n/i.test(value), "Visual facts must be short plain text.");

export const drawingFeaturesSchema = z.object({
  source: z.literal("vision_observation"),
  objects: z.object({
    house: z.enum(["present", "absent", "uncertain"]),
    tree: z.enum(["present", "absent", "uncertain"]),
    person: z.enum(["present", "absent", "uncertain"]),
  }),
  observations: z.array(visualFact).max(8),
  layout: z.object({
    housePosition: z.enum(["left", "center", "right", "uncertain"]),
    treePosition: z.enum(["left", "center", "right", "uncertain"]),
    personPosition: z.enum(["left", "center", "right", "uncertain"]),
    relativeSizes: z.array(visualFact).max(5),
    objectRelations: z.array(visualFact).max(5),
  }),
  visibleDetails: z.array(visualFact).max(10),
  uncertainties: z.array(visualFact).max(5),
});

export const transformResponseSchema = z.object({
  imageUrl: z.string().url(),
  appliedPrompt: z.string(),
});
