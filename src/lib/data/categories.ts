import "server-only";
import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import type { Category } from "@/types";

export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const snap = await adminDb
      .collection("categories")
      .where("isActive", "==", true)
      .orderBy("order", "asc")
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Category, "id">) }));
  },
  ["categories-all"],
  { revalidate: 3600, tags: ["categories"] }
);

export async function getCategoryById(id: string): Promise<Category | null> {
  const snap = await adminDb.doc(`categories/${id}`).get();
  return snap.exists ? ({ id: snap.id, ...(snap.data() as Omit<Category, "id">) }) : null;
}
