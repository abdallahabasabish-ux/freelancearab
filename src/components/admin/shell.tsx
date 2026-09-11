import Link from "next/link";
import {
  LayoutDashboard, BookOpen, FolderTree, Users, ClipboardList,
  GraduationCap, Award, Star, Settings, LogOut,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/courses", label: "الكورسات", icon: BookOpen },
  { href: "/admin/categories", label: "التصنيفات", icon: FolderTree },
  { href: "/admin/students", label: "الطلاب", icon: Users },
  { href: "/admin/enrollments", label: "التسجيلات", icon: ClipboardList },
  { href: "/admin/quizzes", label: "الاختبارات", icon: GraduationCap },
  { href: "/admin/certificates", label: "الشهادات", icon: Award },
  { href: "/admin/reviews", label: "التقييمات", icon: Star },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];

export function AdminShell({
  user, children,
}: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <aside className="hidden lg:flex flex-col w-64 border-l border-border min-h-screen sticky top-0">
          <div className="p-5 border-b border-border">
            <Link href="/admin" className="flex items-center gap-2 font-bold">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-foreground">
                <GraduationCap className="h-5 w-5" />
              </span>
              <div className="leading-tight">
                <p className="text-sm">عرب فريلانسر</p>
                <p className="text-[11px] text-muted-foreground font-normal">لوحة الإدارة</p>
              </div>
            </Link>
          </div>
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted transition-colors"
              >
                <n.icon className="h-4 w-4 text-muted-foreground" />
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="p-3 border-t border-border">
            <LogoutButton />
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
            <div className="h-16 px-5 flex items-center justify-between">
              <span className="text-sm font-semibold">لوحة الإدارة</span>
              <span className="text-sm text-muted-foreground">{user.name ?? user.email}</span>
            </div>
          </header>
          <main className="p-5 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
