"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Mail, Lock, User2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { GoogleButton } from "./google-button";
import { useToast } from "@/components/ui/toaster";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { loginWithGoogle, registerWithEmail } from "@/lib/firebase/auth";

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true);
    try {
      await registerWithEmail(data.name, data.email, data.password);
      toast("success", "تم إنشاء الحساب بنجاح، مرحبًا بك!");
      router.replace(next);
      router.refresh();
    } catch (e: any) {
      const msg =
        e?.code === "auth/email-already-in-use" ? "هذا البريد مستخدم مسبقًا" :
        e?.code === "auth/weak-password" ? "كلمة المرور ضعيفة" :
        "حدث خطأ أثناء إنشاء الحساب";
      toast("error", msg);
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      toast("success", "تم تسجيل الدخول");
      router.replace(next);
      router.refresh();
    } catch {
      toast("error", "تعذّر تسجيل الدخول بجوجل");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">أنشئ حسابك</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          انطلق في رحلتك التعليمية — الحساب مجاني بالكامل.
        </p>
      </header>

      <GoogleButton onClick={onGoogle} loading={googleLoading} label="التسجيل عبر Google" />

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">أو بالبريد الإلكتروني</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="الاسم الكامل" error={errors.name?.message}>
          <div className="relative">
            <User2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input {...register("name")} placeholder="مثال: محمد أحمد" className="pr-10" autoComplete="name" />
          </div>
        </FormField>

        <FormField label="البريد الإلكتروني" error={errors.email?.message}>
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input {...register("email")} type="email" placeholder="you@example.com" className="pr-10" autoComplete="email" dir="ltr" />
          </div>
        </FormField>

        <FormField label="كلمة المرور" error={errors.password?.message} hint="8 أحرف على الأقل، وتحتوي حرفًا ورقمًا">
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input {...register("password")} type="password" placeholder="••••••••" className="pr-10" autoComplete="new-password" dir="ltr" />
          </div>
        </FormField>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "إنشاء الحساب"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        لديك حساب؟{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          سجّل الدخول
        </Link>
      </p>
    </div>
  );
}
