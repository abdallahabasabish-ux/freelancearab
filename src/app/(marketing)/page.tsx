import Link from "next/link";
import { ArrowLeft, Sparkles, GraduationCap, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* خلفية خفيفة — بدون gradients مبالغ فيها */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_80%_0%,hsl(var(--brand)/.08),transparent_60%),radial-gradient(50%_40%_at_10%_20%,hsl(var(--accent)/.10),transparent_60%)]"
        />
        <div className="container grid lg:grid-cols-2 gap-12 items-center py-20 lg:py-28">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              امتداد رسمي لمدونة عرب فريلانسر
            </span>

            <h1 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.15] tracking-tight">
              تعلّم مهارات <span className="text-brand">العمل الحر</span>
              <br />
              وابدأ طريقك بثقة
            </h1>

            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-xl">
              كورسات عربية متخصصة، محتوى عملي، شهادات إتمام، ومتابعة دقيقة لتقدمك —
              كل ما تحتاجه للانتقال من التعلم إلى أول عميل.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/courses">
                  استكشف الكورسات <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/register">
                  <GraduationCap className="h-4 w-4" />
                  ابدأ التعلم مجانًا
                </Link>
              </Button>
            </div>

            {/* شريط ثقة */}
            <dl className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              {[
                { k: "كورسات", v: "متخصصة" },
                { k: "محتوى", v: "عملي 100%" },
                { k: "شهادات", v: "قابلة للتحقق" },
              ].map((s) => (
                <div key={s.k}>
                  <dt className="text-xs text-muted-foreground">{s.k}</dt>
                  <dd className="mt-1 text-sm font-semibold">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Visual — بطاقة تعلّم مصغّرة */}
          <div className="relative animate-fade-in">
            <div className="relative rounded-2xl border border-border bg-card shadow-elevated overflow-hidden">
              <div className="aspect-video bg-gradient-to-br from-brand/90 to-brand-800 grid place-items-center">
                <PlayCircle className="h-14 w-14 text-white/90" strokeWidth={1.4} />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">أساسيات العمل الحر</p>
                    <p className="text-xs text-muted-foreground mt-0.5">12 درسًا · مبتدئ</p>
                  </div>
                  <span className="text-xs font-semibold text-accent">مجاني</span>
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-2/3 bg-brand" />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">أكملت 67%</p>
              </div>
            </div>

            {/* بطاقة عائمة صغيرة */}
            <div className="hidden md:block absolute -bottom-6 -left-6 w-56 rounded-2xl border border-border bg-card shadow-card p-4">
              <p className="text-xs text-muted-foreground">آخر درس</p>
              <p className="mt-1 text-sm font-semibold line-clamp-1">كيف تكتب أول عرض احترافي؟</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-accent" />
                <span className="text-[11px] text-muted-foreground">تابع من حيث توقفت</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
