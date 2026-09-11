import "server-only";
import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import type { Course, Lesson, Section } from "@/types";

const PUBLISHED = "published";

function mapCourse(d: FirebaseFirestore.DocumentSnapshot): Course {
  return { id: d.id, ...(d.data() as Omit<Course, "id">) };
}

/** كل الكورسات المنشورة — مصدر واحد للـLanding و/courses */
export const getAllPublishedCourses = unstable_cache(
  async (): Promise<Course[]> => {
    const snap = await adminDb
      .collection("courses")
      .where("status", "==", PUBLISHED)
      .limit(200)
      .get();
    return snap.docs.map(mapCourse);
  },
  ["courses-published"],
  { revalidate: 300, tags: ["courses"] }
);

export const getCourseBySlug = unstable_cache(
  async (slug: string): Promise<Course | null> => {
    const snap = await adminDb
      .collection("courses")
      .where("slug", "==", slug)
      .where("status", "==", PUBLISHED)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return mapCourse(snap.docs[0]);
  },
  ["course-by-slug"],
  { revalidate: 300, tags: ["courses"] }
);

export async function getCourseById(id: string): Promise<Course | null> {
  const snap = await adminDb.doc(`courses/${id}`).get();
  return snap.exists ? mapCourse(snap) : null;
}

export interface CourseCurriculumSection extends Section {
  lessons: Lesson[];
}

export async function getCourseCurriculum(courseId: string): Promise<CourseCurriculumSection[]> {
  const sectionsSnap = await adminDb
    .collection(`courses/${courseId}/sections`)
    .orderBy("order", "asc")
    .get();

  const sections = await Promise.all(
    sectionsSnap.docs.map(async (sDoc) => {
      const lessonsSnap = await adminDb
        .collection(`courses/${courseId}/sections/${sDoc.id}/lessons`)
        .orderBy("order", "asc")
        .get();
      const lessons = lessonsSnap.docs.map((l) => ({
        id: l.id,
        ...(l.data() as Omit<Lesson, "id">),
      }));
      return {
        id: sDoc.id,
        ...(sDoc.data() as Omit<Section, "id">),
        lessons,
      };
    })
  );

  return sections;
}

/** فلاتر في الذاكرة — MVP بسيط وسريع. لاحقًا: pagination على السيرفر. */
export function filterCourses(
  courses: Course[],
  opts: {
    q?: string;
    category?: string;
    level?: string;
    price?: "all" | "free" | "paid";
    minRating?: number;
    sort?: "newest" | "popular" | "rating";
  }
): Course[] {
  let out = [...courses];

  if (opts.q) {
    const q = opts.q.trim().toLowerCase();
    out = out.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.shortDescription.toLowerCase().includes(q)
    );
  }
  if (opts.category) out = out.filter((c) => c.categoryId === opts.category);
  if (opts.level) out = out.filter((c) => c.level === opts.level);
  if (opts.price === "free") out = out.filter((c) => c.isFree);
  if (opts.price === "paid") out = out.filter((c) => !c.isFree);
  if (opts.minRating) out = out.filter((c) => c.rating >= opts.minRating!);

  switch (opts.sort) {
    case "popular":
      out.sort((a, b) => b.studentsCount - a.studentsCount);
      break;
    case "rating":
      out.sort((a, b) => b.rating - a.rating);
      break;
    case "newest":
    default:
      out.sort(
        (a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt)
      );
  }
  return out;
}
