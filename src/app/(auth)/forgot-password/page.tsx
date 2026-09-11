import { ForgotForm } from "@/components/auth/forgot-form";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "استعادة كلمة المرور" };
export default function ForgotPasswordPage() { return <ForgotForm />; }
