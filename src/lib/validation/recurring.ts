import { z } from "zod";
import { monthCompare } from "../recurring";

const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .transform((m) => m);

export const recurringBaseSchema = z
  .object({
    propertyId: z.string().min(1),
    categoryId: z.string().min(1),
    amount: z
      .preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().positive())
      .transform((v) => Math.round(v * 100)),
    memo: z.string().optional().transform((v) => (v === "" ? undefined : v)),
    dayOfMonth: z
      .preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().int().min(1).max(28))
      .transform((v) => Math.min(Math.max(v, 1), 28)),
    startMonth: monthSchema,
    endMonth: monthSchema.optional().nullable(),
    isActive: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean()),
  })
  .superRefine((val, ctx) => {
    if (val.endMonth && monthCompare(val.endMonth, val.startMonth) < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["endMonth"],
        message: "End month must be after start month",
      });
    }
  });

export const createRecurringSchema = recurringBaseSchema;

export const updateRecurringSchema = recurringBaseSchema.extend({
  id: z.string().min(1),
});
