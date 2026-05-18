/**
 * 시연용 페이지 스크린샷 자동 캡쳐.
 *
 * 실행:
 *   npm run capture
 *   BASE_URL=https://ai-studio-drab-nine.vercel.app npm run capture
 *
 * 산출물:
 *   docs/manual/screens/<role>/<slug>.png
 *
 * - 쿠키 동의 배너는 localStorage 사전 주입으로 차단
 * - 데모 계정이 먼저 생성돼 있어야 함 (npm run seed:demo)
 */
import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL?.replace(/\/$/, "") ?? "https://ai-studio-drab-nine.vercel.app";
const OUT_ROOT = resolve(process.cwd(), "../../docs/manual/screens");
const PASSWORD = "rlarudtn2!";

type Shot = { slug: string; path: string; description: string };

const COMMON_SHOTS: Shot[] = [
  { slug: "01-home", path: "/", description: "메인 랜딩" },
  { slug: "02-login", path: "/login", description: "로그인" },
  { slug: "03-signup", path: "/signup", description: "회원가입" },
  { slug: "04-pricing", path: "/pricing", description: "요금제" },
  { slug: "05-blog", path: "/blog", description: "블로그" },
];

const ROLES: { name: string; email: string; shots: Shot[] }[] = [
  {
    name: "student",
    email: "demo-student@ai-studio.kr",
    shots: [
      { slug: "10-dashboard", path: "/dashboard", description: "수강생 대시보드" },
      { slug: "11-tutor", path: "/tutor", description: "AI 튜터" },
      { slug: "12-courses", path: "/courses", description: "수강 가능 코스" },
      { slug: "13-samples", path: "/samples", description: "학습 샘플" },
      { slug: "14-support", path: "/support", description: "문의·지원" },
      { slug: "15-onboarding", path: "/onboarding", description: "신규 사용자 온보딩" },
    ],
  },
  {
    name: "instructor",
    email: "demo-instructor@ai-studio.kr",
    shots: [
      { slug: "20-dashboard", path: "/instructor/dashboard", description: "강사 대시보드" },
      { slug: "21-studio", path: "/studio", description: "Studio 콘텐츠 생성" },
      { slug: "22-cast", path: "/cast", description: "Cast PPT→영상" },
      { slug: "23-studio-pro", path: "/studio-pro", description: "Studio Pro 강사 자료 기반" },
      { slug: "24-assets", path: "/instructor/assets", description: "강사 자산 관리" },
      { slug: "25-proposals", path: "/instructor/proposals", description: "콘텐츠 제안" },
      { slug: "26-nps", path: "/instructor/nps", description: "강사 NPS" },
      { slug: "27-training", path: "/instructor/training", description: "강사 교육 진행" },
      { slug: "28-weekly-report", path: "/instructor/weekly-report", description: "주간 리포트" },
    ],
  },
  {
    name: "operations",
    email: "demo-ops@ai-studio.kr",
    shots: [
      { slug: "30-dashboard", path: "/operations/dashboard", description: "운영팀 대시보드" },
      { slug: "31-at-risk", path: "/admin/at-risk-students", description: "위험 학습자 알림" },
      { slug: "32-email-log", path: "/admin/email-log", description: "이메일 발송 로그" },
      { slug: "33-monitoring", path: "/admin/monitoring", description: "시스템 모니터링" },
      { slug: "34-remediation", path: "/admin/remediation", description: "콘텐츠 조치 큐" },
      { slug: "35-runbook", path: "/admin/runbook", description: "운영 런북" },
      { slug: "36-students", path: "/admin/students", description: "수강생 관리" },
    ],
  },
];

/** 쿠키 배너 차단 — localStorage 사전 주입 */
const DISMISS_COOKIE_SCRIPT = `
  window.localStorage.setItem(
    "keg-cookie-consent-v1",
    JSON.stringify({ level: "essential", accepted_at: new Date().toISOString(), version: "v1" })
  );
`;

async function newCtx(browser: Browser): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(DISMISS_COOKIE_SCRIPT);
  return ctx;
}

async function login(page: Page, email: string): Promise<boolean> {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  const toggle = page.locator('button:has-text("비밀번호로 로그인")');
  if (await toggle.count()) {
    await toggle.first().click();
    await page.waitForSelector('input[type="password"]', { timeout: 5000 }).catch(() => {});
  }
  await page.fill('input#email', email);
  await page.fill('input#password', PASSWORD);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 25000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

async function capture(page: Page, shot: Shot, dir: string): Promise<"ok" | "404" | "error"> {
  const file = `${dir}/${shot.slug}.png`;
  try {
    const resp = await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(800);
    // 404 감지 — Next.js not-found.tsx는 200 응답이라 status로는 못 잡음. 본문 텍스트로 판단.
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const is404 = /404\s*\n?\s*페이지를 찾을 수 없습니다/.test(bodyText) || resp?.status() === 404;
    if (is404) {
      console.log(`  ⊘ ${shot.slug.padEnd(24)} ${shot.path}  (404 — skip)`);
      return "404";
    }
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  ✓ ${shot.slug.padEnd(24)} ${shot.path}`);
    return "ok";
  } catch (e) {
    console.log(`  ⚠ ${shot.slug.padEnd(24)} ${shot.path} — ${(e as Error).message.slice(0, 60)}`);
    return "error";
  }
}

async function run() {
  if (!existsSync(OUT_ROOT)) mkdirSync(OUT_ROOT, { recursive: true });
  console.log(`[capture] BASE=${BASE} OUT=${OUT_ROOT}\n`);

  const browser = await chromium.launch();
  const skipped: { role: string; shot: Shot }[] = [];

  // 공통
  {
    const dir = `${OUT_ROOT}/common`;
    mkdirSync(dir, { recursive: true });
    const ctx = await newCtx(browser);
    const page = await ctx.newPage();
    console.log("== 공통 (비로그인) ==");
    for (const s of COMMON_SHOTS) {
      const r = await capture(page, s, dir);
      if (r === "404") skipped.push({ role: "common", shot: s });
    }
    await ctx.close();
  }

  // 역할별
  for (const role of ROLES) {
    const dir = `${OUT_ROOT}/${role.name}`;
    mkdirSync(dir, { recursive: true });
    console.log(`\n== ${role.name} (${role.email}) ==`);
    const ctx = await newCtx(browser);
    const page = await ctx.newPage();
    const ok = await login(page, role.email);
    if (!ok) {
      console.log(`  ✕ 로그인 실패`);
      await ctx.close();
      continue;
    }
    for (const s of role.shots) {
      const r = await capture(page, s, dir);
      if (r === "404") skipped.push({ role: role.name, shot: s });
    }
    await ctx.close();
  }

  await browser.close();
  if (skipped.length) {
    console.log(`\n생략된 404 페이지 (${skipped.length}):`);
    for (const x of skipped) console.log(`  - ${x.role}/${x.shot.slug}  ${x.shot.path}`);
  }
  console.log(`\n완료. ${OUT_ROOT}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
