import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (!user.isAdmin) redirect("/dashboard"); // حماية مزدوجة — Middleware + هنا
  return <AdminShell user={user}>{children}</AdminShell>;
}
