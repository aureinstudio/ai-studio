/**
 * 시연용 데모 계정 3종 생성 (강사·수강생·운영자).
 *
 * 실행:
 *   tsx scripts/seed-demo-users.ts
 *
 * 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * 이미 존재하면 비밀번호·role만 재설정 (idempotent).
 *
 * 삭제:
 *   tsx scripts/seed-demo-users.ts --cleanup
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

for (const p of [".env.local", "apps/web/.env.local"]) {
  if (existsSync(p)) {
    for (const l of readFileSync(p, "utf-8").split("\n")) {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
    break;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const PASSWORD = "rlarudtn2!";
const DEMO_USERS = [
  { email: "demo-instructor@ai-studio.kr", role: "instructor", name: "데모 강사", dashboard: "/instructor/dashboard" },
  { email: "demo-student@ai-studio.kr",    role: "user",       name: "데모 수강생", dashboard: "/dashboard" },
  { email: "demo-ops@ai-studio.kr",        role: "admin",      name: "데모 운영자", dashboard: "/operations/dashboard" },
] as const;

async function findUserByEmail(email: string) {
  // listUsers는 페이지네이션 — 데모 계정 정도면 첫 페이지에서 찾음
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

async function upsert() {
  console.log(`[seed-demo-users] 비밀번호: ${PASSWORD}\n`);
  for (const u of DEMO_USERS) {
    const existing = await findUserByEmail(u.email);
    let userId: string;
    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: u.name, demo: true },
      });
      if (error) {
        console.warn(`  ⚠ ${u.email} 업데이트 실패: ${error.message}`);
        continue;
      }
      userId = existing.id;
      console.log(`  ↻ ${u.email} (재설정)`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: u.name, demo: true },
      });
      if (error || !data.user) {
        console.warn(`  ⚠ ${u.email} 생성 실패: ${error?.message}`);
        continue;
      }
      userId = data.user.id;
      console.log(`  ✓ ${u.email} (신규)`);
    }

    // profiles row upsert + role 설정
    const { error: pErr } = await admin.from("profiles").upsert(
      {
        id: userId,
        email: u.email,
        name: u.name,
        role: u.role,
        onboarding_state: "completed",
      },
      { onConflict: "id" },
    );
    if (pErr) {
      console.warn(`    profiles 업데이트 실패: ${pErr.message}`);
    } else {
      console.log(`    role=${u.role} · 진입 → ${u.dashboard}`);
    }
  }
  console.log("\n시연 안내:");
  console.log("  1. https://ai-studio.kr/login 접속");
  for (const u of DEMO_USERS) {
    console.log(`  · ${u.role.padEnd(10)} ${u.email} / ${PASSWORD}`);
  }
}

async function cleanup() {
  for (const u of DEMO_USERS) {
    const existing = await findUserByEmail(u.email);
    if (!existing) {
      console.log(`  - ${u.email} (없음)`);
      continue;
    }
    const { error } = await admin.auth.admin.deleteUser(existing.id);
    if (error) console.warn(`  ⚠ ${u.email}: ${error.message}`);
    else console.log(`  ✕ ${u.email} 삭제`);
  }
}

const cmd = process.argv[2];
(cmd === "--cleanup" ? cleanup() : upsert()).catch((e) => {
  console.error(e);
  process.exit(1);
});
