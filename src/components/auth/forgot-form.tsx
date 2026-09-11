"use client";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Mail, Loader2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toaster";
import { forgotSchema, type ForgotInput } from "@/lib/validation/auth";
import { resetPassword } from "@/lib/firebase/auth";

export function ForgotForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotInput>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotInput) => {
    setLoading(true);
    try {
      await resetPassword(data.email);
      setSent(true);
      toast("success", "تم إرسال رابط الاستعادة إلى بريدك");
    } catch {
      // لأسباب أمنية: لا نكشف إن كان البريد مسجلًا أم لا
      setSent(true);
      toast("info", "إذا كان البريد مسجلًا، ستصلك رسالة الاستعادة");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success">
          <Mail className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">تحقّق من بريدك</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          أرسلنا رابط استعادة كلمة المرور إلى بريدك الإلكتروني.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/login"><ArrowRight className="h-4 w-4" /> العودة لتسجيل الدخول</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">استعادة كلمة المرور</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="البريد الإلكتروني" error={errors.email?.message}>
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input {...register("email")} type="email" placeholder="you@example.com" className="pr-10" dir="ltr" autoComplete="email" />
          </div>
        </FormField>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "إرسال رابط الاستعادة"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        تذكرت كلمة المرور؟{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">سجّل الدخول</Link>
      </p>
    </div>
  );
}
