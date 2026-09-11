import { getSessionUser } from "@/lib/auth/session";
import { BookOpen, Award, TrendingUp, GraduationCap } from "lucide-react";

export default async function DashboardHome() {
  const user = await getSessionUser();
  const kpis = [
    { label: "كورساتي", value: "0", icon: BookOpen },
    { label: "مكتملة", value: "0", icon: GraduationCap },
    { label: "نسبة التقدم", value: "0%", icon: TrendingUp },
    { label: "شهادات", value: "0", icon: Award },
  ];
  return (
    <div>
      <h1 className="text-2xl font-bold">أهلًا، {user?.name ?? "بك"} 👋</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        هذه لوحة التحكم — سيتم بناء المحتوى الكامل في المرحلة P4.
      </p>
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{k.label}</span>
              <k.icon className="h-4 w-4 text-brand" />
            </div>
            <p className="mt-3 text-2xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
