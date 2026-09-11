import "server-only";
import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import type { GlobalStats } from "@/types";

export const getGlobalStats = unstable_cache(
  async (): Promise<GlobalStats> => {
    const snap = await adminDb.doc("stats/global").get();
    if (!snap.exists) return { students: 0, courses: 0, lessons: 0, certificates: 0 };
    return snap.data() as GlobalStats;
  },
  ["stats-global"],
  { revalidate: 300, tags: ["stats"] }
);
