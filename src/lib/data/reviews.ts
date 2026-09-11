import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { Review } from "@/types";

export async function getCourseReviews(courseId: string, limit = 10): Promise<Review[]> {
  const snap = await adminDb
    .collection("reviews")
    .where("courseId", "==", courseId)
    .where("status", "==", "visible")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Review, "id">) }));
}

/** للـTestimonials في الـLanding — آخر تقييمات عالية التقييم */
export async function getTestimonials(limit = 6): Promise<Review[]> {
  const snap = await adminDb
    .collection("reviews")
    .where("status", "==", "visible")
    .orderBy("createdAt", "desc")
    .limit(30)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Review, "id">) }))
    .filter((r) => r.rating >= 4 && r.comment?.trim().length > 0)
    .slice(0, limit);
}
