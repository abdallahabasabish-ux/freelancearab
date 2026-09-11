import Link from "next/link";
import { GraduationCap, LogOut, BookOpen, Award, User } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";

const nav = [
  { href: "/dashboard", label: "الرئيسية", icon: BookOpen },
  { href: "/dashboard/courses", label: "كورساتي", icon: BookOpen },
  { href: "/dashboard/certificates", label: "شهاداتي", icon: Award },
  { href: "/dashboard/profile", label: "الملف", icon: User },
];

export function DashboardShell({
  user, children,
}: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            عرب فريلانسر
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-muted-foreground">{user.name ?? user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
