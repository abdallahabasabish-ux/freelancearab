import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* الجانب الترويجي */}
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-brand text-brand-foreground relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 opacity-[.07] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
        <Link href="/" className="relative flex items-center gap-2 font-bold text-lg">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
            <GraduationCap className="h-5 w-5" />
          </span>
          عرب فريلانسر
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-snug">
            ابدأ رحلتك نحو الاحتراف في العمل الحر
          </h2>
          <p className="mt-4 text-brand-foreground/80 leading-relaxed">
            كورسات عملية، شهادات موثقة، ومتابعة دقيقة لتقدمك.
          </p>
        </div>
        <p className="relative text-xs text-brand-foreground/60">
          © {new Date().getFullYear()} عرب فريلانسر
        </p>
      </aside>

      {/* المحتوى */}
      <main className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
