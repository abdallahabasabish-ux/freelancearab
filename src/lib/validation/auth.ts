import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(3, "الاسم قصير جدًا").max(60),
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z
    .string()
    .min(8, "كلمة المرور 8 أحرف على الأقل")
    .regex(/[A-Za-z]/, "يجب أن تحتوي على حرف واحد على الأقل")
    .regex(/[0-9]/, "يجب أن تحتوي على رقم واحد على الأقل"),
});

export const loginSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(1, "أدخل كلمة المرور"),
});

export const forgotSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotInput = z.infer<typeof forgotSchema>;
