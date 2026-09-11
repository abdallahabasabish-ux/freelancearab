import { LoginForm } from "@/components/auth/login-form";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "تسجيل الدخول" };
export default function LoginPage() { return <LoginForm />; }
