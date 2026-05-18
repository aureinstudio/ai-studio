/**
 * 시연용 더미 데이터 시드.
 *
 * 실행:
 *   npx tsx scripts/seed-demo-data.ts
 *
 * 추가:
 *   - course_catalog 4건 (다양한 카테고리)
 *   - support_tickets 5건 (상태 분산)
 *   - content_reports 3건
 *   - admin_alerts 4건
 *
 * 정리:
 *   npx tsx scripts/seed-demo-data.ts --cleanup
 *
 * 모든 row는 metadata 또는 notes에 'DEMO_SEED' 마커를 박아 cleanup이 가능.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

for (const p of [".env.local"]) {
  if (existsSync(p)) {
    for (const l of readFileSync(p, "utf-8").split("\n")) {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const MARKER = "DEMO_SEED";

async function getDemoIds() {
  const { data } = await admin
    .from("profiles")
    .select("id, email, role")
    .in("email", ["demo-student@ai-studio.kr", "demo-instructor@ai-studio.kr", "demo-ops@ai-studio.kr"]);
  const byEmail = Object.fromEntries((data ?? []).map((r) => [r.email, r.id])) as Record<string, string>;
  return byEmail;
}

async function seed() {
  const ids = await getDemoIds();
  const student = ids["demo-student@ai-studio.kr"];
  const instructor = ids["demo-instructor@ai-studio.kr"];

  // 1) course_catalog
  const courses = [
    { slug: "demo-toeic-master",   name: "TOEIC 마스터 과정",      course_category: "certification", status: "live", target_students: 200, migration_progress_pct: 100, primary_instructor_id: instructor },
    { slug: "demo-python-basics",  name: "파이썬 기초 부트캠프",   course_category: "professional",  status: "live", target_students: 150, migration_progress_pct: 100, primary_instructor_id: instructor },
    { slug: "demo-business-eng",   name: "비즈니스 영어 회화",    course_category: "language",      status: "beta", target_students: 80,  migration_progress_pct: 75,  primary_instructor_id: instructor },
    { slug: "demo-data-analysis",  name: "데이터 분석 입문",       course_category: "academic",      status: "sme_review", target_students: 100, migration_progress_pct: 40, primary_instructor_id: instructor },
  ];
  for (const c of courses) {
    await admin.from("course_catalog").upsert({ ...c, notes: MARKER }, { onConflict: "tenant_id,slug" });
  }
  console.log(`  ✓ course_catalog ${courses.length}건`);

  // 2) support_tickets
  const tickets = [
    { email: "demo-student@ai-studio.kr", user_id: student, name: "데모 수강생", category: "technical",     subject: "동영상 재생이 안 됩니다", body: "Cast에서 만든 영상이 중간에 끊깁니다.\n[" + MARKER + "]", status: "open" },
    { email: "kim.user@example.com",       user_id: null,    name: "김학습",     category: "content_error",  subject: "TOEIC 강의 오타", body: "Week 3 Listening 자료 12페이지 오타 제보.\n[" + MARKER + "]", status: "in_progress" },
    { email: "lee.user@example.com",       user_id: null,    name: "이학생",     category: "billing",         subject: "환불 요청", body: "결제했는데 수강이 안 됩니다.\n[" + MARKER + "]", status: "open" },
    { email: "park.user@example.com",      user_id: null,    name: "박학습",     category: "other",           subject: "수료증 재발급", body: "기존 수료증 다시 받고 싶습니다.\n[" + MARKER + "]", status: "resolved", resolved_at: new Date().toISOString(), resolution_note: "재발급 완료" },
    { email: "choi.user@example.com",      user_id: null,    name: "최학생",     category: "technical",       subject: "로그인 오류", body: "매직링크가 안 옵니다.\n[" + MARKER + "]", status: "closed", resolved_at: new Date(Date.now()-86400000).toISOString(), resolution_note: "스팸함 확인 안내" },
  ];
  for (const t of tickets) await admin.from("support_tickets").insert(t);
  console.log(`  ✓ support_tickets ${tickets.length}건`);

  // 3) content_reports
  const reports = [
    { user_id: student, issue_type: "factual_error", detail: "정답 해설 부분 오류 — 답 B가 맞는데 C로 표기됨. [" + MARKER + "]" },
    { user_id: student, issue_type: "incomplete",     detail: "Week 5 강의 자료가 중간에 끊겨 있습니다. [" + MARKER + "]" },
    { user_id: student, issue_type: "inappropriate", detail: "예시 문장 일부가 부적절. 검토 부탁드립니다. [" + MARKER + "]" },
  ];
  for (const r of reports) await admin.from("content_reports").insert(r);
  console.log(`  ✓ content_reports ${reports.length}건`);

  // 4) admin_alerts
  const alerts = [
    { alert_type: "low_understanding", severity: "high",   message: "수강생 5명 이해도 < 50% (TOEIC 마스터) [" + MARKER + "]" },
    { alert_type: "rate_limit",        severity: "medium", message: "Studio API rate limit 80% 도달 [" + MARKER + "]" },
    { alert_type: "cost_threshold",    severity: "medium", message: "월 비용 예산 80% 사용 [" + MARKER + "]" },
    { alert_type: "ticket_sla",        severity: "low",    message: "미답변 티켓 4건 (SLA 24h 임박) [" + MARKER + "]" },
  ];
  for (const a of alerts) await admin.from("admin_alerts").insert(a).then((r) => { if (r.error) console.warn("    admin_alerts:", r.error.message.slice(0,80)); });
  console.log(`  ✓ admin_alerts (시도) ${alerts.length}건`);

  // 5) studio_jobs 샘플 — /courses 페이지 카탈로그용
  const sampleJobs = [
    { user_id: instructor, topic: "[DEMO] TOEIC Listening Section 완전 정복", course_category: "certification", level: "intermediate", length: "medium",  is_sample: true, status: "completed", model: "gpt-4o", agent_logs: { note: MARKER } },
    { user_id: instructor, topic: "[DEMO] 파이썬 자료구조와 알고리즘",        course_category: "professional",  level: "beginner",    length: "long",  is_sample: true, status: "completed", model: "gpt-4o", agent_logs: { note: MARKER } },
    { user_id: instructor, topic: "[DEMO] 비즈니스 영어 이메일 작성법",       course_category: "language",      level: "intermediate", length: "short", is_sample: true, status: "completed", model: "gpt-4o", agent_logs: { note: MARKER } },
    { user_id: instructor, topic: "[DEMO] 사진으로 배우는 색채 이론",          course_category: "hobby",         level: "beginner",    length: "short",   is_sample: true, status: "completed", model: "gpt-4o", agent_logs: { note: MARKER } },
    { user_id: instructor, topic: "[DEMO] 통계학 입문 — 확률부터 회귀까지",   course_category: "academic",      level: "intermediate", length: "long", is_sample: true, status: "completed", model: "gpt-4o", agent_logs: { note: MARKER } },
  ];
  for (const j of sampleJobs) {
    const { error } = await admin.from("studio_jobs").insert(j);
    if (error) console.warn(`    studio_jobs: ${error.message.slice(0, 80)}`);
  }
  console.log(`  ✓ studio_jobs samples ${sampleJobs.length}건`);

  console.log("\n시드 완료.");
}

async function cleanup() {
  await admin.from("course_catalog").delete().eq("notes", MARKER);
  await admin.from("support_tickets").delete().like("body", `%${MARKER}%`);
  await admin.from("content_reports").delete().like("detail", `%${MARKER}%`);
  await admin.from("admin_alerts").delete().like("message", `%${MARKER}%`);
  await admin.from("studio_jobs").delete().like("topic", `[DEMO]%`);
  console.log("✓ 더미 데이터 삭제 완료");
}

const cmd = process.argv[2];
(cmd === "--cleanup" ? cleanup() : seed()).catch((e) => {
  console.error(e);
  process.exit(1);
});
