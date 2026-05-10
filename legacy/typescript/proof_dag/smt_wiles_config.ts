import { z } from "zod";

export const SmtWilesConfigSchema = z.object({
  vertices: z.number().int().min(2),
  description: z.string().min(1),
  z3_assertions_python: z.string().min(1).describe("Python code inserting boolean assertions into 'solver' instance based on 'adj' NxN 2D array."),
  r: z.number().int().optional(),
  s: z.number().int().optional(),
});

export type SmtWilesConfig = z.infer<typeof SmtWilesConfigSchema>;
