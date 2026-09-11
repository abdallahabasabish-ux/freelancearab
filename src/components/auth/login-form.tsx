"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Mail, Lock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { GoogleButton } from "./google-button";
import { useToast } from "@/components/ui/toaster";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { loginWithEmail, loginWithGoogle } from "@/lib/firebase/auth";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    try {
      await loginWithEmail(data.email, data.password);
      toast("success", "مرحبًا بعودتك!");
      router.replace(next);
      router.refresh();
    } catch (e: any) {
      const msg =
        e?.code === "auth/invalid-credential" || e?.code === "auth/wrong-password"
          ? "البريد أو كلمة المرور غير صحيحة"
          : e?.code === "auth/too-many-requests"
          ? "تم تجاوز عدد المحاولات، حاول لاحقًا"
          : "تعذّر تسجيل الدخول";
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
        <h1 className="text-2xl md:text-3xl font-bold">تسجيل الدخول</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          تابع من حيث توقفت في رحلتك التعليمية.
        </p>
      </header>

      <GoogleButton onClick={onGoogle} loading={googleLoading} label="الدخول عبر Google" />

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">أو بالبريد الإلكتروني</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="البريد الإلكتروني" error={errors.email?.message}>
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input {...register("email")} type="email" placeholder="you@example.com" className="pr-10" autoComplete="email" dir="ltr" />
          </div>
        </FormField>

        <FormField label="كلمة المرور" error={errors.password?.message}>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input {...register("password")} type="password" placeholder="••••••••" className="pr-10" autoComplete="current-password" dir="ltr" />
          </div>
        </FormField>

        <div className="flex items-center justify-end">
          <Link href="/forgot-password" className="text-xs text-brand hover:underline">
            نسيت كلمة المرور؟
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "تسجيل الدخول"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ليس لديك حساب؟{" "}
        <Link href="/register" className="font-semibold text-brand hover:underline">
          أنشئ حسابًا
        </Link>
      </p>
    </div>
  );
}
