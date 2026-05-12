/**
 * 부하 테스트용 계정 50개 생성 + access_token 발급.
 *
 * 실행:
 *   tsx scripts/create-test-users.ts 50 ./tests/load/tokens.json
 *
 * 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * 산출물:
 *   tokens.json — [{ user_id, email, access_token, refresh_token }]
 *
 * 정리(부하 테스트 종료 후):
 *   tsx scripts/create-test-users.ts --cleanup ./tests/load/tokens.json
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const TEST_PASSWORD = "LoadTest!2026";

async function createUsers(n: number, outPath: string) {
  const tokens: { user_id: string; email: string; access_token: string; refresh_token: string }[] = [];
  for (let i = 1; i <= n; i++) {
    const email = `load-test-${String(i).padStart(3, "0")}@test.keg.local`;
    // 1) admin createUser — email_confirm:true 로 즉시 활성화
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { name: `LoadTest ${i}`, load_test: true },
    });
    if (cErr && !cErr.message.includes("already")) {
      console.warn(`create ${email} failed: ${cErr.message}`);
      continue;
    }
    const userId = created?.user?.id;

    // 2) 토큰 발급 — 일반 클라이언트로 signIn
    const userClient = createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? serviceKey!, {
      auth: { persistSession: false },
    });
    const { data: signIn, error: sErr } = await userClient.auth.signInWithPassword({
      email,
      password: TEST_PASSWORD,
    });
    if (sErr || !signIn.session) {
      console.warn(`signin ${email} failed: ${sErr?.message}`);
      continue;
    }
    tokens.push({
      user_id: userId ?? signIn.user?.id ?? "",
      email,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    });
    if (i % 10 === 0) console.log(`  ${i}/${n}…`);
  }
  writeFileSync(outPath, JSON.stringify(tokens, null, 2));
  console.log(`✓ ${tokens.length}개 토큰 → ${outPath}`);
}

async function cleanup(inPath: string) {
  const tokens = JSON.parse(readFileSync(inPath, "utf-8")) as { user_id: string; email: string }[];
  let n = 0;
  for (const t of tokens) {
    if (!t.user_id) continue;
    const { error } = await admin.auth.admin.deleteUser(t.user_id);
    if (error) console.warn(`delete ${t.email}: ${error.message}`);
    else n++;
  }
  console.log(`✓ ${n}/${tokens.length} 삭제 완료`);
}

const args = process.argv.slice(2);
if (args[0] === "--cleanup") {
  cleanup(args[1] ?? "./tests/load/tokens.json").catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  const n = Number(args[0] ?? "50");
  const out = args[1] ?? "./tests/load/tokens.json";
  createUsers(n, out).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
