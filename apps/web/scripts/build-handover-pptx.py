"""
개발자 기술 이전 문서 PPT 자동 생성.

실행:
  python scripts/build-handover-pptx.py

산출물:
  docs/ai-studio-handover.pptx
"""
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "docs" / "ai-studio-handover.pptx"

NAVY   = RGBColor(0x0F, 0x17, 0x2A)
GRAY   = RGBColor(0x64, 0x74, 0x8B)
GRAY2  = RGBColor(0x94, 0xA3, 0xB8)
LIGHT  = RGBColor(0xF1, 0xF5, 0xF9)
ACCENT = RGBColor(0x2D, 0x6A, 0xFF)
GREEN  = RGBColor(0x05, 0x96, 0x69)
AMBER  = RGBColor(0xB4, 0x53, 0x09)
RED    = RGBColor(0xB9, 0x1C, 0x1C)
CODEBG = RGBColor(0x1E, 0x29, 0x3B)
CODEFG = RGBColor(0xE2, 0xE8, 0xF0)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
SW, SH = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]

KFONT = "맑은 고딕"
MONO  = "Consolas"


def tb(slide, x, y, w, h, text, size=14, bold=False, color=NAVY, align=PP_ALIGN.LEFT, font=KFONT, italic=False):
    box = slide.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = color
    r.font.name = font
    return box


def band(slide, color, x, y, w, h):
    sh = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    sh.fill.solid()
    sh.fill.fore_color.rgb = color
    sh.line.fill.background()
    return sh


def header(slide, title, subtitle=None):
    band(slide, NAVY, 0, 0, SW, Inches(0.55))
    tb(slide, Inches(0.4), Inches(0.1), Inches(10), Inches(0.4),
       title, size=17, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
    if subtitle:
        tb(slide, SW - Inches(4.4), Inches(0.15), Inches(4), Inches(0.35),
           subtitle, size=10, color=RGBColor(0xCB, 0xD5, 0xE1), align=PP_ALIGN.RIGHT)


def footer(slide, num, total):
    tb(slide, Inches(0.4), SH - Inches(0.38), Inches(8), Inches(0.3),
       "ai-studio · 기술 이전 문서 v2.3.0", size=8, color=GRAY2)
    tb(slide, SW - Inches(1.4), SH - Inches(0.38), Inches(1), Inches(0.3),
       f"{num} / {total}", size=8, color=GRAY2, align=PP_ALIGN.RIGHT)


def chip(slide, x, y, text, color=ACCENT, fg=RGBColor(0xFF, 0xFF, 0xFF), w=None):
    text_w = w or Inches(1.4)
    band(slide, color, x, y, text_w, Inches(0.35))
    tb(slide, x, y + Emu(20000), text_w, Inches(0.3),
       text, size=10, bold=True, color=fg, align=PP_ALIGN.CENTER)


def bullets(slide, x, y, w, h, items, size=12, color=NAVY, accent=ACCENT, bullet_char="•"):
    box = slide.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(4)
        r1 = p.add_run()
        r1.text = f"{bullet_char}  "
        r1.font.size = Pt(size)
        r1.font.bold = True
        r1.font.color.rgb = accent
        r1.font.name = KFONT
        r2 = p.add_run()
        r2.text = item
        r2.font.size = Pt(size)
        r2.font.color.rgb = color
        r2.font.name = KFONT


def table(slide, x, y, w, h, header_row, rows, col_widths=None, header_color=NAVY, header_fg=RGBColor(0xFF, 0xFF, 0xFF), font_size=11):
    cols = len(header_row)
    rows_total = len(rows) + 1
    t = slide.shapes.add_table(rows_total, cols, x, y, w, h).table
    if col_widths:
        for i, cw in enumerate(col_widths):
            t.columns[i].width = cw
    # header
    for ci, val in enumerate(header_row):
        cell = t.cell(0, ci)
        cell.fill.solid()
        cell.fill.fore_color.rgb = header_color
        cell.text = ""
        p = cell.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.LEFT
        r = p.add_run()
        r.text = val
        r.font.size = Pt(font_size)
        r.font.bold = True
        r.font.color.rgb = header_fg
        r.font.name = KFONT
    # body
    for ri, row in enumerate(rows, start=1):
        for ci, val in enumerate(row):
            cell = t.cell(ri, ci)
            cell.fill.solid()
            cell.fill.fore_color.rgb = LIGHT if ri % 2 == 0 else RGBColor(0xFF, 0xFF, 0xFF)
            cell.text = ""
            p = cell.text_frame.paragraphs[0]
            p.alignment = PP_ALIGN.LEFT
            r = p.add_run()
            r.text = str(val)
            r.font.size = Pt(font_size)
            r.font.color.rgb = NAVY
            r.font.name = KFONT
    return t


def code_block(slide, x, y, w, h, code, font_size=10):
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    bg.fill.solid()
    bg.fill.fore_color.rgb = CODEBG
    bg.line.fill.background()
    box = slide.shapes.add_textbox(x + Inches(0.15), y + Inches(0.1), w - Inches(0.3), h - Inches(0.2))
    tf = box.text_frame
    tf.word_wrap = True
    lines = code.split("\n")
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        r = p.add_run()
        r.text = line if line else " "
        r.font.size = Pt(font_size)
        r.font.color.rgb = CODEFG
        r.font.name = MONO


# ─────────────────────────────────────────────
# 슬라이드 정의
# ─────────────────────────────────────────────

def slide_cover():
    s = prs.slides.add_slide(BLANK)
    band(s, NAVY, 0, 0, SW, SH)
    band(s, ACCENT, 0, Inches(3.4), SW, Inches(0.08))
    tb(s, Inches(0.8), Inches(2.0), Inches(11), Inches(0.6),
       "AI-STUDIO · DEVELOPER HANDOVER",
       size=14, bold=True, color=RGBColor(0x60, 0xA5, 0xFA))
    tb(s, Inches(0.8), Inches(2.6), Inches(11), Inches(1.2),
       "기술 이전 문서",
       size=54, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
    tb(s, Inches(0.8), Inches(4.0), Inches(11), Inches(0.6),
       "v2.3.0 · 신규 합류 개발자용 기술 이전 가이드",
       size=22, color=RGBColor(0xCB, 0xD5, 0xE1))
    tb(s, Inches(0.8), Inches(4.7), Inches(11), Inches(0.6),
       "목표: 이 문서 하나로 1주 안에 첫 PR",
       size=14, italic=True, color=RGBColor(0x94, 0xA3, 0xB8))
    tb(s, Inches(0.8), Inches(6.6), Inches(11), Inches(0.4),
       "KEG · Korean Education Group   |   2026-05-18",
       size=12, color=RGBColor(0x94, 0xA3, 0xB8))


def slide_agenda():
    s = prs.slides.add_slide(BLANK)
    header(s, "Agenda — 19 섹션")
    items_left = [
        "0. 1일차 체크리스트",
        "1. 아키텍처 개요",
        "2. 기술 스택",
        "3. 디렉토리 구조",
        "4. 권한 모델 (RLS)",
        "5. 데이터베이스",
        "6. 에이전트 아키텍처 (핵심 IP)",
        "7. API 라우트 패턴",
        "8. 환경 변수",
        "9. Cron 작업",
    ]
    items_right = [
        "10. 멀티 테넌트",
        "11. Stripe",
        "12. Resend (이메일)",
        "13. 비용·Rate Limit·관측",
        "14. 자주 막히는 함정",
        "15. 시연 / 데모",
        "16. 알려진 이슈 / 백로그",
        "17. 코드 리뷰 규칙",
        "18. 외부 의존성 / 연락처",
        "19. 참고 문서 + 한 줄 요약",
    ]
    bullets(s, Inches(0.7), Inches(1.0), Inches(6), Inches(6), items_left, size=14)
    bullets(s, Inches(6.7), Inches(1.0), Inches(6), Inches(6), items_right, size=14)


def slide_day1():
    s = prs.slides.add_slide(BLANK)
    header(s, "0. 1일차 체크리스트")
    tb(s, Inches(0.5), Inches(0.85), Inches(12), Inches(0.4),
       "신규 개발자가 1주 안에 첫 PR을 내려면 — 이 7단계만 따라가면 됩니다.",
       size=12, italic=True, color=GRAY)
    code = """# 1. clone & install
git clone <repo> && cd ai-studio-app/apps/web
npm install

# 2. env 설정 (1Password "ai-studio / dev .env.local")
cp .env.example .env.local
# 필수: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#       SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

# 3. 마이그레이션 검증
curl https://ai-studio-drab-nine.vercel.app/api/admin/db-check \\
  -H "Cookie: <super-admin 세션>"
# 응답에 missing_migrations: [] 면 OK

# 4. 로컬 실행
npm run dev    # http://localhost:3000

# 5. 데모 + 더미 데이터
npm run seed:demo
npm run seed:demo-data

# 6. 검증
npm run test
npx tsc --noEmit"""
    code_block(s, Inches(0.5), Inches(1.4), Inches(7.5), Inches(5.4), code, font_size=10)

    tb(s, Inches(8.3), Inches(1.4), Inches(4.5), Inches(0.4),
       "1일차 필독 파일", size=13, bold=True, color=ACCENT)
    bullets(s, Inches(8.3), Inches(1.85), Inches(4.5), Inches(5),
            [
                "apps/web/CLAUDE.md + AGENTS.md  (Next 16 변경점)",
                "src/lib/agents/orchestrator-full.ts  (13 에이전트)",
                "supabase/migrations/0001_profiles.sql  (권한 시작점)",
                "src/proxy.ts  (모든 요청이 거치는 미들웨어)",
            ], size=11)


def slide_architecture():
    s = prs.slides.add_slide(BLANK)
    header(s, "1. 아키텍처 개요")
    code = """[Browser]
   │
   ▼
[Next.js 16 App Router · Vercel]   ──▶  [Supabase Postgres + RLS]
   │   ├ proxy.ts  (Supabase 세션 + tenant slug)         │
   │   ├ /app      (Server Components 기본)              │
   │   ├ /api      (Route Handlers — Node runtime)       │
   │   └ /api/cron (Vercel Cron 트리거)                   │
   │                                                      ├─ Storage (10 buckets)
   ▼                                                      └─ Auth (Magic + Password)
[외부 서비스]
   ├ Anthropic Claude   (Studio·Cast·Tutor 추론)
   ├ OpenAI / Gemini    (모델 다양화 A/B)
   ├ ElevenLabs         (TTS)
   ├ HeyGen             (영상 합성)
   ├ Stripe             (결제)
   ├ Resend             (이메일)
   └ Upstash Redis      (rate limit · 캐시)"""
    code_block(s, Inches(0.5), Inches(1.0), Inches(7.2), Inches(5.8), code, font_size=10)

    tb(s, Inches(8.0), Inches(1.0), Inches(5), Inches(0.4),
       "핵심 설계 결정", size=13, bold=True, color=ACCENT)
    decisions = [
        ("Server Components 기본", "초기 페인트↑ + 보안 데이터 노출 방지"),
        ("RLS를 1차 방어선으로", "API 권한 분기 최소화. admin client는 명시적으로만"),
        ("force-dynamic 다수", "본인 데이터 페이지 캐시 오염 방지. v2.3에서 점진 해제"),
        ("멀티테넌트 = tenant_id + RLS", "스키마 분리보다 운영 단순"),
        ("에이전트 in-process", "큐 없음. 30초+ 작업은 background fetch"),
    ]
    y = Inches(1.5)
    for title, why in decisions:
        tb(s, Inches(8.0), y, Inches(5), Inches(0.3),
           f"▸ {title}", size=11, bold=True, color=NAVY)
        tb(s, Inches(8.2), y + Inches(0.32), Inches(4.8), Inches(0.5),
           why, size=10, color=GRAY)
        y += Inches(0.95)


def slide_tech_stack():
    s = prs.slides.add_slide(BLANK)
    header(s, "2. 기술 스택")
    rows = [
        ["프레임워크",   "Next.js 16.2.6",                  "App Router · middleware → proxy.ts"],
        ["언어",         "TypeScript 5",                    "strict mode"],
        ["UI",           "React 19 + Tailwind 4 + Base UI", "shadcn 패턴 (src/components/ui/*)"],
        ["DB",           "Supabase (Postgres 15 + pgvector)", "RLS 필수"],
        ["인증",         "Supabase Auth",                   "Magic + Password (@supabase/ssr)"],
        ["LLM",          "Anthropic SDK ^0.95",             "Claude Opus 4.7 / Sonnet 4.6"],
        ["결제",         "Stripe",                          "Test mode (라이브 미설정)"],
        ["이메일",       "Resend",                          "발신 전용"],
        ["영상",         "HeyGen",                          "Cast 핵심 외부 의존"],
        ["음성",         "ElevenLabs",                      "Cast TTS"],
        ["캐시·RateLimit","Upstash Redis",                  "@upstash/redis + ratelimit"],
        ["호스팅",       "Vercel (Seoul)",                  "Supabase도 Seoul (RTT 최소화)"],
        ["테스트",       "Vitest + Playwright",             "npm run test / capture"],
    ]
    table(s, Inches(0.5), Inches(1.0), Inches(12.3), Inches(5.6),
          ["영역", "기술", "비고"], rows,
          col_widths=[Inches(2.5), Inches(4.0), Inches(5.8)],
          font_size=11)
    tb(s, Inches(0.5), Inches(6.8), Inches(12.3), Inches(0.4),
       "⚠ Next.js 16은 N15와 다름 — middleware.ts 아니라 proxy.ts. node_modules/next/dist/docs/ 확인.",
       size=11, italic=True, color=AMBER)


def slide_structure():
    s = prs.slides.add_slide(BLANK)
    header(s, "3. 디렉토리 구조")
    code = """apps/web/
├── src/
│   ├── app/
│   │   ├── (public)            # / /login /signup /pricing /blog ...
│   │   ├── dashboard           # 수강생
│   │   ├── instructor          # 강사
│   │   ├── operations          # 운영팀
│   │   ├── admin               # admin role 전용 (~50 페이지)
│   │   ├── super-admin         # keg_super_admin
│   │   ├── api/                # Route Handlers
│   │   │   ├── cron            # Vercel Cron
│   │   │   ├── studio | cast | tutor
│   │   │   └── admin           # 관리자 RPC
│   │   ├── loading.tsx · error.tsx · not-found.tsx     # (v2.3)
│   ├── components/
│   │   ├── ui/                 # shadcn primitives
│   │   ├── Header.tsx          # role 메뉴 + cache()
│   │   ├── EmptyState · SearchFilter · BulkActionBar   # (v2.3)
│   │   └── CookieConsent.tsx
│   ├── lib/
│   │   ├── agents/             # ★ Studio·Cast·Tutor 에이전트
│   │   ├── supabase · auth · tenant · rate-limit · cost-guard
│   │   ├── email · rag · payments · csv · ...
│   └── proxy.ts                # ★ 미들웨어 (Next 16)
├── supabase/migrations/        # 0001 ~ 0050
├── scripts/                    # seed · capture · build-pptx
└── tests/"""
    code_block(s, Inches(0.5), Inches(1.0), Inches(12.3), Inches(6.0), code, font_size=10)


def slide_roles():
    s = prs.slides.add_slide(BLANK)
    header(s, "4. 권한 모델 (RLS 중심)")
    tb(s, Inches(0.5), Inches(0.85), Inches(12.3), Inches(0.4),
       "Role 6종 + SQL 헬퍼 4종. 모든 테이블 RLS 활성, API에서 권한 분기 최소화.",
       size=12, italic=True, color=GRAY)
    role_rows = [
        ["keg_super_admin", "/super-admin",             "KEG 본부장 1명, 전체 테넌트"],
        ["admin",           "/admin",                   "테넌트 어드민"],
        ["operations",      "/operations/dashboard",    "CS·KPI. /admin/* 일부 접근"],
        ["instructor",      "/instructor/dashboard",    "자기 코스만"],
        ["sme",             "/sme/dashboard",           "전문 검수자"],
        ["user",            "/dashboard",               "수강생 (기본값)"],
    ]
    table(s, Inches(0.5), Inches(1.4), Inches(7.5), Inches(3.5),
          ["Role", "진입 화면", "비고"], role_rows,
          col_widths=[Inches(2.2), Inches(2.4), Inches(2.9)],
          font_size=11)
    tb(s, Inches(8.3), Inches(1.4), Inches(4.5), Inches(0.4),
       "SQL 헬퍼 (0027·0034)", size=13, bold=True, color=ACCENT)
    code = """is_admin(uid)
  role IN ('admin','keg_super_admin')

is_admin_or_ops(uid)
  + 'operations'

is_keg_super_admin(uid)
  role = 'keg_super_admin'

is_instructor_role(uid)
  IN ('instructor','admin',
      'sme','creator')"""
    code_block(s, Inches(8.3), Inches(1.85), Inches(4.5), Inches(3.0), code, font_size=10)

    tb(s, Inches(0.5), Inches(5.1), Inches(12.3), Inches(0.4),
       "규칙", size=13, bold=True, color=ACCENT)
    bullets(s, Inches(0.5), Inches(5.5), Inches(12.3), Inches(1.7), [
        "select * 호출 후 권한은 RLS에 위임 — if/else 분기 줄임",
        "createAdminClient() 사용 시 함수 내 role 체크 직접 수행",
        "Header는 cache()로 페이지당 Supabase 호출 2→1 (v2.3)",
    ], size=12)


def slide_db():
    s = prs.slides.add_slide(BLANK)
    header(s, "5. 데이터베이스 — 마이그레이션 50개")
    rows = [
        ["0001-0005", "profiles, studio_jobs, cost_log 골격"],
        ["0006-0012", "samples, sme_evaluations 3축, cast_jobs"],
        ["0013-0016", "RAG pgvector, tutor 대화/이해도, consent"],
        ["0017-0021", "audit_log, incidents, KPI·CS 큐"],
        ["0022-0025", "강사 NPS, content_remediation, retrospective"],
        ["0026-0033", "course_category, role 6종, enrollments, governance, Studio Pro"],
        ["0034-0041", "멀티테넌트 (tenants + tenant_id), webhooks"],
        ["0042-0049", "course_catalog, marketing, sales, P&L, 글로벌, annual, G4 게이트"],
        ["0050",      "runtime v2.1 — email_log, subscriptions, payment_log, certificates"],
    ]
    table(s, Inches(0.5), Inches(1.0), Inches(8.0), Inches(5.0),
          ["번호 범위", "주요 내용"], rows,
          col_widths=[Inches(1.8), Inches(6.2)],
          font_size=11)

    tb(s, Inches(8.8), Inches(1.0), Inches(4.2), Inches(0.4),
       "검증", size=13, bold=True, color=ACCENT)
    code = """GET /api/admin/db-check

응답:
{
  summary: {
    total_checks: 70+,
    passed: ...,
    failed: ...,
    overall: "✅ all_good"
  },
  missing_migrations: [],
  buckets: [...]
}"""
    code_block(s, Inches(8.8), Inches(1.45), Inches(4.2), Inches(3.6), code, font_size=10)

    tb(s, Inches(8.8), Inches(5.2), Inches(4.2), Inches(0.4),
       "Storage 버킷 9종", size=13, bold=True, color=ACCENT)
    tb(s, Inches(8.8), Inches(5.6), Inches(4.2), Inches(1.6),
       "cast-audio · cast-video · cast-captions · studio-pptx · cast-slide-images · user-avatar-sources · studio-pro-uploads · instructor-photos · instructor-voices",
       size=10, color=NAVY)


def slide_agents():
    s = prs.slides.add_slide(BLANK)
    header(s, "6. 에이전트 아키텍처 (핵심 IP)")
    tb(s, Inches(0.5), Inches(0.85), Inches(12.3), Inches(0.4),
       "3대 솔루션 × 29 에이전트. 모두 in-process 동기 실행 — 큐 없음.",
       size=12, italic=True, color=GRAY)

    # Studio
    band(s, ACCENT, Inches(0.5), Inches(1.4), Inches(4.0), Inches(0.4))
    tb(s, Inches(0.6), Inches(1.45), Inches(4), Inches(0.3),
       "Studio — 13 에이전트", size=12, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
    bullets(s, Inches(0.5), Inches(1.9), Inches(4.0), Inches(3.5), [
        "TEAM 1 입력검증 (3)",
        "TEAM 2 콘텐츠 생성 (5)\n  Book·Slide·Quiz",
        "TEAM 3 오케스트레이션 (2)",
        "TEAM 4 SME 평가 (3)\n  정확성·완전성·일관성",
    ], size=11)

    # Cast
    band(s, GREEN, Inches(4.7), Inches(1.4), Inches(4.0), Inches(0.4))
    tb(s, Inches(4.8), Inches(1.45), Inches(4), Inches(0.3),
       "Cast — 7 에이전트", size=12, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
    bullets(s, Inches(4.7), Inches(1.9), Inches(4.0), Inches(3.5), [
        "PPT 파싱 → 스크립트 생성",
        "TTS (ElevenLabs)",
        "HeyGen 영상 합성",
        "Whisper 자막 + 품질 평가",
        "10장 기준 3-5분, $0.30/슬라이드",
    ], size=11, accent=GREEN)

    # Tutor
    band(s, AMBER, Inches(8.9), Inches(1.4), Inches(3.9), Inches(0.4))
    tb(s, Inches(9.0), Inches(1.45), Inches(4), Inches(0.3),
       "Tutor — 9 에이전트", size=12, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
    bullets(s, Inches(8.9), Inches(1.9), Inches(3.9), Inches(3.5), [
        "Intent 분류",
        "RAG Retrieve (pgvector)",
        "Answer 생성 + 인용",
        "이해도 자동 평가",
        "< 50% → admin_alerts",
    ], size=11, accent=AMBER)

    tb(s, Inches(0.5), Inches(5.7), Inches(12.3), Inches(0.4),
       "공통 호출 흐름", size=13, bold=True, color=ACCENT)
    bullets(s, Inches(0.5), Inches(6.05), Inches(12.3), Inches(1.2), [
        "cost-guard 일/월 한도 체크 → 초과 시 즉시 거절",
        "cost-tracker 모델·토큰·USD를 cost_log에 기록",
        "실패 시 studio_jobs.agent_logs / cast_jobs.agent_logs에 단계별 에러",
    ], size=11)


def slide_api():
    s = prs.slides.add_slide(BLANK)
    header(s, "7. API 라우트 패턴")
    code = """// src/app/api/<group>/<action>/route.ts

export const runtime = "nodejs";          // 에이전트·DB 호출에 필요
export const dynamic = "force-dynamic";   // 인증 요청별

export async function POST(req: NextRequest) {
  // 1) 인증
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 2) 입력 검증 — zod 필수
  const body = SchemaZ.parse(await req.json());

  // 3) rate limit
  const rl = await checkRateLimit("group:action", user.id);
  if (!rl.allowed) return rateLimited(rl);

  // 4) 비용 가드 (LLM 호출 전)
  await assertCostBudget(user.id, estimatedUsd);

  // 5) 처리 + 비용 기록
  const result = await doWork(body);
  await recordCost(user.id, model, tokens, actualUsd);

  return NextResponse.json({ ok: true, ... });
}"""
    code_block(s, Inches(0.5), Inches(1.0), Inches(8.0), Inches(5.8), code, font_size=10)

    tb(s, Inches(8.8), Inches(1.0), Inches(4.2), Inches(0.4),
       "5가지 필수 체크리스트", size=13, bold=True, color=ACCENT)
    bullets(s, Inches(8.8), Inches(1.4), Inches(4.2), Inches(5), [
        "인증 (auth.getUser)",
        "zod 입력 검증",
        "rate limit",
        "비용 한도",
        "에러 형식 통일\n{ error, message?, retry_after_sec? }",
    ], size=11)


def slide_envs():
    s = prs.slides.add_slide(BLANK)
    header(s, "8. 환경 변수")
    must = [
        ["NEXT_PUBLIC_SUPABASE_URL",      "Supabase 엔드포인트"],
        ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "브라우저용 anon"],
        ["SUPABASE_SERVICE_ROLE_KEY",     "서버 admin client (절대 노출 금지)"],
        ["ANTHROPIC_API_KEY",             "Claude 추론"],
        ["CRON_SECRET",                   "Vercel Cron 인증"],
    ]
    opt = [
        ["HEYGEN_API_KEY",                "Cast 영상"],
        ["ELEVENLABS_API_KEY",            "Cast TTS"],
        ["GEMINI_API_KEY",                "모델 다양화"],
        ["STRIPE_SECRET_KEY / WEBHOOK",   "결제"],
        ["RESEND_API_KEY / FROM_EMAIL",   "이메일"],
        ["UPSTASH_REDIS_REST_URL / TOKEN","rate limit · 캐시"],
        ["ADMIN_ALERT_EMAILS",            "알림 수신 콤마 구분"],
        ["COST_* (USER/GLOBAL DAILY/MONTHLY)", "기본 5/50/100/1000"],
    ]
    tb(s, Inches(0.5), Inches(0.95), Inches(6), Inches(0.4),
       "필수", size=13, bold=True, color=RED)
    table(s, Inches(0.5), Inches(1.35), Inches(6.3), Inches(2.5),
          ["키", "용도"], must,
          col_widths=[Inches(3.3), Inches(3.0)],
          font_size=10)

    tb(s, Inches(7.0), Inches(0.95), Inches(6), Inches(0.4),
       "솔루션별 / 선택", size=13, bold=True, color=ACCENT)
    table(s, Inches(7.0), Inches(1.35), Inches(5.8), Inches(4.0),
          ["키", "용도"], opt,
          col_widths=[Inches(3.3), Inches(2.5)],
          font_size=10)

    tb(s, Inches(0.5), Inches(4.1), Inches(6.3), Inches(0.4),
       "비용 한도 (기본값)", size=13, bold=True, color=AMBER)
    bullets(s, Inches(0.5), Inches(4.5), Inches(6.3), Inches(2.5), [
        "COST_USER_DAILY_USD = 5",
        "COST_USER_MONTHLY_USD = 50",
        "COST_GLOBAL_DAILY_USD = 100",
        "COST_GLOBAL_MONTHLY_USD = 1000",
        "CAST_DAILY_LIMIT_USD / TUTOR_DAILY_LIMIT_USD",
    ], size=11)


def slide_cron():
    s = prs.slides.add_slide(BLANK)
    header(s, "9. Cron 작업 (Vercel Cron)")
    tb(s, Inches(0.5), Inches(0.85), Inches(12.3), Inches(0.4),
       "vercel.json 정의 · 모든 /api/cron/* 핸들러는 Authorization: Bearer ${CRON_SECRET} 검증.",
       size=12, italic=True, color=GRAY)
    rows = [
        ["/api/cron/measure-kpi",         "매일 00:00", "kpi_metrics 일간 스냅샷"],
        ["/api/cron/customer-success",    "매일 06:00", "위험 학습자 케어 메시지 발송"],
        ["/api/cron/learning-reminder",   "매일 09:00", "미학습 학습자 리마인더"],
        ["/api/cron/nps-push",            "분기 첫 월", "NPS 설문 발송"],
        ["/api/cron/cost-monitor",        "매시",       "비용 한도 초과 알림"],
        ["/api/cron/daily-tasks",         "매일 03:00", "통합 일일 작업"],
        ["/api/cron/governance-report",   "매주",       "거버넌스 리포트"],
        ["/api/cron/account-cleanup",     "매일 04:00", "삭제 예약 계정 처리"],
        ["/api/cron/sme-request",         "매시",       "SME 검수 요청 알림"],
        ["/api/cron/daily-report",        "매일 07:00", "일일 운영 리포트"],
    ]
    table(s, Inches(0.5), Inches(1.4), Inches(12.3), Inches(5.4),
          ["경로", "주기", "용도"], rows,
          col_widths=[Inches(4.5), Inches(2.5), Inches(5.3)],
          font_size=11)


def slide_tenant_stripe_resend():
    s = prs.slides.add_slide(BLANK)
    header(s, "10·11·12. 멀티 테넌트 · Stripe · Resend")
    # 3 columns
    cols = [
        ("멀티 테넌트", ACCENT, [
            "tenant_id uuid (default 0000..0001)",
            "<slug>.ai-studio.kr → proxy.ts가 x-tenant-slug 헤더 주입",
            "getCurrentTenant() (lib/tenant/server.ts)가 헤더+profiles 종합",
            "RLS: tenant_id = current_tenant_id()",
        ]),
        ("Stripe", GREEN, [
            "/api/payments/checkout → Checkout Session",
            "redirect: /dashboard?stripe=success",
            "/api/payments/webhook STRIPE_WEBHOOK_SECRET 검증",
            "subscriptions · payment_log 업데이트",
            "데모는 Test mode — 라이브 전환 시 키 교체",
            "webhook 핸들러는 멱등 필수",
        ]),
        ("Resend (이메일)", AMBER, [
            "lib/email/send.ts → sendEmail() 단일 진입점",
            "사전 email_log queued → sent / failed 상태 전환",
            "템플릿: lib/email/templates/*.ts",
            "RESEND_API_KEY 미설정도 graceful — email_log에만 failed 기록",
        ]),
    ]
    x = Inches(0.4)
    for title, color, items in cols:
        band(s, color, x, Inches(1.0), Inches(4.2), Inches(0.4))
        tb(s, x + Inches(0.1), Inches(1.05), Inches(4), Inches(0.3),
           title, size=12, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
        bullets(s, x + Inches(0.05), Inches(1.55), Inches(4.2), Inches(5.5), items, size=11, accent=color)
        x += Inches(4.3)


def slide_cost_observability():
    s = prs.slides.add_slide(BLANK)
    header(s, "13. 비용 · Rate Limit · 관측")

    tb(s, Inches(0.5), Inches(1.0), Inches(6), Inches(0.4),
       "비용 가드 패턴", size=13, bold=True, color=ACCENT)
    code = """// src/lib/cost-guard/

await assertCostBudget(userId, estimatedUsd);
//   → 한도 초과면 throw
//      (사용자별 / 글로벌 / 일별 / 월별)

// ... 외부 LLM 호출

await recordCost(userId, model, tokens, actualUsd);
//   → cost_log 에 기록
//      → /admin/monitoring 에서 집계"""
    code_block(s, Inches(0.5), Inches(1.4), Inches(6.3), Inches(3.5), code, font_size=10)

    tb(s, Inches(7.0), Inches(1.0), Inches(6), Inches(0.4),
       "Rate Limit", size=13, bold=True, color=ACCENT)
    bullets(s, Inches(7.0), Inches(1.4), Inches(5.8), Inches(2.5), [
        "Upstash sliding window",
        "키 prefix: auth:login · studio:create · cast:create · tutor:chat ...",
        "비로그인 라우트는 IP fallback",
        "/api/auth/login|signup만 proxy에서 처리, 나머지는 핸들러에서",
    ], size=11)

    tb(s, Inches(7.0), Inches(4.0), Inches(6), Inches(0.4),
       "관측 테이블", size=13, bold=True, color=ACCENT)
    bullets(s, Inches(7.0), Inches(4.4), Inches(5.8), Inches(2.5), [
        "cost_log — 모든 LLM·외부 호출 비용",
        "audit_log — 권한 변경·삭제 등 보안 이벤트",
        "email_log — 모든 이메일",
        "incidents — 시스템 장애",
        "(선택) PostHog — 페이지뷰·이벤트",
    ], size=11)


def slide_pitfalls():
    s = prs.slides.add_slide(BLANK)
    header(s, "14. 자주 막히는 함정")
    rows = [
        ["middleware.ts를 만들었는데 안 먹는다", "Next 16은 proxy.ts (apps/web/src/proxy.ts)"],
        ["RLS 때문에 row가 안 보인다",          "createAdminClient() 의도적으로 결정 + 함수 내 role 체크"],
        ["에이전트 작업 30초 타임아웃",         "Vercel = 30s/300s. 장시간은 결과 polling 패턴"],
        ["force-dynamic 너무 많다",            "본인 데이터 페이지가 다수. v2.3에서 정적화 중"],
        ["Supabase 응답 타입 에러",            "npx supabase gen types typescript → src/lib/supabase/types.ts 갱신"],
        ["Stripe webhook 재시도",              "핸들러는 멱등 필수. 같은 이벤트 두 번 받아도 안전"],
        ["빈 페이지 / 접근 불가",              "역할별 권한 확인. is_admin_or_ops 헬퍼 검토"],
    ]
    table(s, Inches(0.5), Inches(1.0), Inches(12.3), Inches(5.5),
          ["증상", "대처"], rows,
          col_widths=[Inches(4.8), Inches(7.5)],
          font_size=11)


def slide_demo():
    s = prs.slides.add_slide(BLANK)
    header(s, "15. 시연 / 데모")
    tb(s, Inches(0.5), Inches(0.85), Inches(12.3), Inches(0.4),
       "전체: docs/manual/USER-MANUAL.md  |  PPT: docs/manual/ai-studio-user-manual.pptx",
       size=12, italic=True, color=GRAY)
    code = """cd apps/web

# 1) 데모 계정 (강사·수강생·운영자, 비번 rlarudtn2!)
npm run seed:demo

# 2) 더미 데이터 (코스·티켓·신고·Studio 샘플)
npm run seed:demo-data

# 3) 27개 페이지 스크린샷
BASE_URL=https://ai-studio-drab-nine.vercel.app npm run capture

# 4) 사용설명서 PPT 31장 자동 빌드
npm run manual:pptx

# 종료 후 정리
npx tsx scripts/seed-demo-data.ts --cleanup
npx tsx scripts/seed-demo-users.ts --cleanup"""
    code_block(s, Inches(0.5), Inches(1.4), Inches(9.0), Inches(5.4), code, font_size=11)

    tb(s, Inches(9.8), Inches(1.4), Inches(3.2), Inches(0.4),
       "주의", size=13, bold=True, color=AMBER)
    bullets(s, Inches(9.8), Inches(1.85), Inches(3.2), Inches(5), [
        "비번 rlarudtn2! 약함 — 종료 즉시 cleanup",
        "ai-studio.kr DNS Netlify에 잔존 — Vercel로 전환 필요",
        "Studio/Cast 실시간 호출은 분 단위 — 미리 완료된 결과로 시연",
    ], size=11, accent=AMBER)


def slide_backlog():
    s = prs.slides.add_slide(BLANK)
    header(s, "16. 알려진 이슈 / 백로그")
    rows = [
        ["High", "ai-studio.kr DNS Netlify 잔존",                "시연 전 Vercel로 전환"],
        ["High", "admin_alerts.message 컬럼명 미스매치",          "마이그 0015 정의는 alert_message"],
        ["Med",  "force-dynamic 페이지 다수",                     "revalidate: 60 또는 정적화 검토"],
        ["Med",  "30+ 관리자 페이지 SearchFilter/CSV 미적용",      "v2.3 인프라 깔렸음, retrofit 미완"],
        ["Med",  "모바일 테이블 가독성",                          "md: 이하 카드 레이아웃 변환"],
        ["Low",  "Stripe 라이브 키 미적용",                        "결제 시작 시점에 교체"],
        ["Low",  "다국어(en/ja) 일부만 적용",                      "i18n 키 추가 + 번역"],
        ["Low",  "Sentry/PostHog 옵셔널",                          "운영 안정화 단계 결정"],
    ]
    table(s, Inches(0.5), Inches(1.0), Inches(12.3), Inches(5.8),
          ["우선순위", "이슈", "메모"], rows,
          col_widths=[Inches(1.5), Inches(5.5), Inches(5.3)],
          font_size=11)


def slide_review():
    s = prs.slides.add_slide(BLANK)
    header(s, "17·18. 코드 리뷰 규칙 / 외부 연락처")

    tb(s, Inches(0.5), Inches(1.0), Inches(6), Inches(0.4),
       "코드 리뷰 / 기여", size=13, bold=True, color=ACCENT)
    bullets(s, Inches(0.5), Inches(1.4), Inches(6.3), Inches(5), [
        "모든 PR은 main 대상 · feature 브랜치 (feature/<topic>)",
        "머지 전: tsc --noEmit + npm run test + UI 변경 시 스크린샷 PR 첨부",
        "마이그레이션은 다음 번호 (0050 → 0051). 기존 절대 수정 금지",
        "커밋 메시지는 한국어/영어 OK, 의미 단위로 분리",
    ], size=11)

    tb(s, Inches(7.0), Inches(1.0), Inches(6), Inches(0.4),
       "외부 의존성 / 연락처", size=13, bold=True, color=ACCENT)
    rows = [
        ["Aurein AX (컨설팅·아키텍처)", "aureinstudio@gmail.com"],
        ["KEG 본부장 (의사결정)",       "(내부)"],
        ["Supabase / Vercel owner",      "aureinstudio@gmail.com"],
        ["Stripe 계정",                  "TBD — 라이브 전환 시"],
        ["Resend 발신 도메인",            "ai-studio.kr (DNS 후)"],
    ]
    table(s, Inches(7.0), Inches(1.4), Inches(5.8), Inches(3.5),
          ["영역", "연락"], rows,
          col_widths=[Inches(3.5), Inches(2.3)],
          font_size=10)


def slide_closing():
    s = prs.slides.add_slide(BLANK)
    band(s, NAVY, 0, 0, SW, SH)
    tb(s, Inches(0.8), Inches(1.6), Inches(11), Inches(0.6),
       "한 줄 요약", size=14, bold=True, color=RGBColor(0x60, 0xA5, 0xFA))
    tb(s, Inches(0.8), Inches(2.2), Inches(11.5), Inches(2.0),
       "Studio · Cast · Tutor 3솔루션을 떠받치는 Next 16 + Supabase 모노레포.",
       size=22, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
    tb(s, Inches(0.8), Inches(3.2), Inches(11.5), Inches(2.0),
       "RLS와 비용 가드를 두 기둥으로, 모든 페이지가 role 기반 자동 라우팅된다.",
       size=18, color=RGBColor(0xCB, 0xD5, 0xE1))
    band(s, ACCENT, Inches(0.8), Inches(4.4), Inches(3), Inches(0.06))
    tb(s, Inches(0.8), Inches(4.6), Inches(11.5), Inches(0.5),
       "새 기능 추가 시 항상 확인할 5가지",
       size=15, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
    bullets(s, Inches(0.8), Inches(5.2), Inches(11.5), Inches(1.5), [
        "(1) 마이그레이션  (2) RLS  (3) zod 검증  (4) rate limit  (5) 비용 기록",
    ], size=14, color=RGBColor(0xCB, 0xD5, 0xE1), accent=ACCENT)
    tb(s, Inches(0.8), SH - Inches(0.7), Inches(11.5), Inches(0.4),
       "참고: docs/HANDOVER.md · docs/manual/ · apps/web/CLAUDE.md+AGENTS.md  |  aureinstudio@gmail.com",
       size=11, color=RGBColor(0x94, 0xA3, 0xB8))


# 빌드 순서
slides_fn = [
    slide_cover,
    slide_agenda,
    slide_day1,
    slide_architecture,
    slide_tech_stack,
    slide_structure,
    slide_roles,
    slide_db,
    slide_agents,
    slide_api,
    slide_envs,
    slide_cron,
    slide_tenant_stripe_resend,
    slide_cost_observability,
    slide_pitfalls,
    slide_demo,
    slide_backlog,
    slide_review,
    slide_closing,
]
for fn in slides_fn:
    fn()

# 페이지 번호 (cover, closing 제외)
slides_list = list(prs.slides)
total = len(slides_list)
for idx, slide in enumerate(slides_list, start=1):
    if idx == 1 or idx == total:
        continue
    footer(slide, idx, total)

OUT.parent.mkdir(parents=True, exist_ok=True)
prs.save(OUT)
print(f"OK {OUT} ({total} slides)")
