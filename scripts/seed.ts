import { adminDb } from "../src/lib/firebase/admin";
import { nanoid } from "nanoid";

async function seed() {
  const now = Date.now();
  const batch = adminDb.batch();

  // 1) التصنيفات
  const categories = [
    { name: "العمل الحر", slug: "freelancing", icon: "briefcase" },
    { name: "كتابة المحتوى", slug: "content", icon: "pen-line" },
    { name: "SEO", slug: "seo", icon: "search" },
    { name: "التصميم", slug: "design", icon: "palette" },
    { name: "البرمجة", slug: "code", icon: "code-2" },
    { name: "التسويق الرقمي", slug: "marketing", icon: "megaphone" },
    { name: "الذكاء الاصطناعي", slug: "ai", icon: "sparkles" },
    { name: "Blogger و WordPress", slug: "blogging", icon: "globe" },
  ].map((c, i) => ({ id: c.slug, ...c, order: i, isActive: true }));
  categories.forEach((c) => batch.set(adminDb.doc(`categories/${c.id}`), c));

  // 2) كورسات تجريبية
  const courses = [
    { title: "أساسيات العمل الحر", slug: "freelancing-basics", cat: "freelancing", level: "beginner", featured: true },
    { title: "كتابة أول عرض احترافي", slug: "first-proposal", cat: "content", level: "beginner", featured: true },
    { title: "أساسيات SEO للفريلانسر", slug: "seo-basics", cat: "seo", level: "intermediate", featured: true },
    { title: "بناء ملف أعمال احترافي", slug: "portfolio-building", cat: "design", level: "beginner", featured: false },
    { title: "استخدام أدوات الذكاء الاصطناعي في العمل الحر", slug: "ai-for-freelancers", cat: "ai", level: "intermediate", featured: true },
  ];

  for (const c of courses) {
    const courseId = c.slug;
    batch.set(adminDb.doc(`courses/${courseId}`), {
      title: c.title,
      slug: c.slug,
      shortDescription: "وصف مختصر تجريبي للكورس.",
      description: "وصف كامل تجريبي للكورس — سيتم استبداله لاحقًا.",
      thumbnail: `https://picsum.photos/seed/${courseId}/800/450`,
      categoryId: c.cat,
      level: c.level,
      isFree: true,
      price: 0,
      currency: "USD",
      isFeatured: c.featured,
      status: "published",
      instructorName: "فريق عرب فريلانسر",
      durationMinutes: 180,
      lessonsCount: 4,
      sectionsCount: 2,
      rating: 4.8,
      ratingsCount: 24,
      studentsCount: 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    });

    // قسمان + درسان لكل قسم
    for (let s = 1; s <= 2; s++) {
      const sectionId = `sec-${s}`;
      batch.set(adminDb.doc(`courses/${courseId}/sections/${sectionId}`), {
        title: s === 1 ? "مقدمة" : "التطبيق العملي",
        order: s,
      });
      for (let l = 1; l <= 2; l++) {
        batch.set(
          adminDb.doc(`courses/${courseId}/sections/${sectionId}/lessons/les-${s}-${l}`),
          {
            title: `الدرس ${l} — ${s === 1 ? "نظرة عامة" : "تمرين"}`,
            type: l === 2 && s === 2 ? "quiz" : "video",
            order: l,
            durationMinutes: 12,
            videoId: "dQw4w9WgXcQ",
          }
        );
      }
    }
  }

  // 3) عدّادات عامة
  batch.set(adminDb.doc("stats/global"), {
    students: 0,
    courses: courses.length,
    lessons: courses.length * 4,
    certificates: 0,
  });

  await batch.commit();
  console.log("✅ Seed done — Demo data created.");
}

seed().catch((e) => { console.error(e); process.exit(1); });
