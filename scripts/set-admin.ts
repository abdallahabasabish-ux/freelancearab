/**
 * الاستخدام:
 *   npx tsx scripts/set-admin.ts admin@example.com          # منح
 *   npx tsx scripts/set-admin.ts admin@example.com --revoke # إلغاء
 *
 * المخرج:
 *   - Custom Claim: { admin: true }
 *   - Firestore: users/{uid}.role = "admin" | "student"
 */
import { adminAuth, adminDb } from "../src/lib/firebase/admin";

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");
  if (!email) {
    console.error("Usage: tsx scripts/set-admin.ts <email> [--revoke]");
    process.exit(1);
  }

  const user = await adminAuth.getUserByEmail(email);
  await adminAuth.setCustomUserClaims(user.uid, { admin: !revoke });
  await adminDb.doc(`users/${user.uid}`).set(
    { role: revoke ? "student" : "admin", updatedAt: Date.now() },
    { merge: true }
  );

  console.log(`${revoke ? "❌ Revoked" : "✅ Granted"} admin → ${email} (${user.uid})`);
  console.log("⚠️ على المستخدم تسجيل الخروج ثم الدخول لتحديث الـToken.");
}

main().catch((e) => { console.error(e); process.exit(1); });
