# ai-studio 기술 이전 문서 (Developer Handover)

> **Version:** v2.3.0 · **Date:** 2026-05-18 · **Audience:** 신규 합류 개발자
> **Repo:** `04-projects/ai-studio-app` · **Live:** https://ai-studio-drab-nine.vercel.app

목표는 신규 개발자가 **이 문서 하나만 읽고도 1주 안에 첫 PR을 낼 수 있게** 하는 것입니다. 정답이 코드에 있는 항목은 "어디를 봐야 하는지"만 짚고, 코드만으로는 알 수 없는 결정·맥락에 분량을 씁니다.

---

## 0. 1일차 체크리스트

```bash
# 1. clone & install
git clone <repo> && cd ai-studio-app
cd apps/web
npm install

# 2. env 설정 (1Password "ai-studio / dev .env.local")
cp .env.example .env.local   # 또는 1Password에서 직접 복사
# 필수 키: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#         SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

# 3. DB 마이그레이션 적용 확인
#    Supabase 콘솔 → SQL Editor → /api/admin/db-check 호출
curl https://ai-studio-drab-nine.vercel.app/api/admin/db-check \
  -H "Cookie: <super-admin 세션>"
# 응답에 missing_migrations: [] 면 OK

# 4. 로컬 실행
npm run dev   # http://localhost:3000

# 5. 데모 계정 + 더미 데이터 (선택)
npm run seed:demo
npm run seed:demo-data

# 6. 테스트 / 타입 체크
npm run test
npx tsc --noEmit
```

**1일차에 꼭 읽어야 할 파일:**
1. `apps/web/CLAUDE.md` + `AGENTS.md` — Next.js 16 변경점 경고
2. `apps/web/src/lib/agents/orchestrator-full.ts` — 13개 에이전트 진입점
3. `apps/web/supabase/migrations/0001_profiles.sql` — 권한 모델의 시작점
4. `apps/web/src/proxy.ts` — 모든 요청이 거치는 미들웨어

---

## 1. 아키텍처 개요

```
[Browser]
   │
   ▼
[Next.js 16 App Router · Vercel]   ──▶  [Supabase Postgres + RLS]
   │   ├ proxy.ts  (Supabase 세션 + tenant slug)         │
   │   ├ /app      (Server Components 기본)              │
   │   ├ /api      (Route Handlers — Node runtime)       │
   │   └ /api/cron (Vercel Cron 트리거)                   │
   │                                                      ├─ Storage (10 buckets)
   ▼                                                      └─ Auth (Magic link + Password)
[외부 서비스]
   ├ Anthropic Claude (Studio·Cast·Tutor 추론)
   ├ OpenAI / Gemini (모델 다양화 — A/B)
   ├ ElevenLabs (TTS)
   ├ HeyGen (영상 합성)
   ├ Stripe (결제)
   ├ Resend (이메일)
   └ Upstash Redis (rate limit · 캐시)
```

**핵심 설계 결정:**

| 결정 | 이유 |
|---|---|
| Server Components 기본, Client는 최소화 | 초기 페인트 빨라지고 보안 데이터 노출 위험 감소 |
| RLS를 1차 방어선으로 신뢰 | API에서 권한 분기 줄이고 직접 Supabase 호출. `admin client`는 명시적으로만 |
| `force-dynamic` 페이지가 다수 | 본인 데이터/티켓 노출 페이지가 많아 캐시 오염 위험 회피. v2.3에서 점진 해제 중 |
| 멀티 테넌트는 `tenant_id` 컬럼 + RLS | 별도 스키마 분리보다 운영 단순. 서브도메인은 proxy에서 헤더 주입 |
| 에이전트는 in-process (큐 없음) | Vercel 함수 안에서 모두 처리. 30초 초과 작업은 background fetch로 우회 |

---

## 2. 기술 스택

| 영역 | 기술 | 버전 / 비고 |
|---|---|---|
| 프레임워크 | Next.js | **16.2.6** (App Router, `middleware.ts` → **`proxy.ts`**) |
| 언어 | TypeScript | ^5, strict |
| UI | React 19 + Tailwind 4 + Base UI + shadcn 패턴 | `src/components/ui/*` |
| 데이터베이스 | Supabase (Postgres 15 + pgvector) | RLS 필수 |
| 인증 | Supabase Auth | Magic link + Password (`@supabase/ssr`) |
| LLM | Anthropic SDK (^0.95) | Claude Opus 4.7 / Sonnet 4.6 |
| 결제 | Stripe | Test mode (라이브 키 미설정) |
| 이메일 | Resend | 발신 전용 |
| 영상 | HeyGen | Cast 작업의 핵심 외부 의존 |
| 음성 | ElevenLabs | Cast TTS |
| 캐시·Rate Limit | Upstash Redis | `@upstash/redis` + `@upstash/ratelimit` |
| 호스팅 | Vercel | Seoul region (Supabase도 Seoul) |
| 분석 | PostHog (선택) | env 키 있으면 활성화 |
| 테스트 | Vitest + Playwright | `npm run test` / `npm run capture` |

> **AGENTS.md 경고 반복:** Next.js 16은 우리가 학습한 N15와 다릅니다. **`middleware.ts`가 아니라 `proxy.ts`** 입니다. API 변경점은 `node_modules/next/dist/docs/`에서 확인하세요.

---

## 3. 디렉토리 구조

```
04-projects/ai-studio-app/
├── apps/web/                       # Next.js 앱 (모노레포지만 web 1개)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (public)            # / /login /signup /pricing /blog ...
│   │   │   ├── dashboard           # 수강생
│   │   │   ├── instructor          # 강사
│   │   │   ├── operations          # 운영팀
│   │   │   ├── admin               # admin role 전용 (~50 페이지)
│   │   │   ├── super-admin         # keg_super_admin 전용
│   │   │   ├── api                 # Route Handlers
│   │   │   │   ├── cron            # Vercel Cron 트리거
│   │   │   │   ├── studio | cast | tutor
│   │   │   │   └── admin           # 관리자 전용 RPC
│   │   │   ├── loading.tsx         # (v2.3) 전역 스켈레톤
│   │   │   ├── error.tsx           # (v2.3) 전역 에러 바운더리
│   │   │   └── not-found.tsx       # (v2.3) 404
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn 패턴 primitives
│   │   │   ├── Header.tsx          # role 기반 메뉴 (cache() 적용)
│   │   │   ├── EmptyState.tsx      # (v2.3) 빈 상태 공통
│   │   │   ├── SearchFilter.tsx    # (v2.3) 테이블 검색
│   │   │   ├── BulkActionBar.tsx   # (v2.3) 일괄 작업
│   │   │   └── CookieConsent.tsx   # GDPR 동의 배너
│   │   ├── lib/
│   │   │   ├── agents/             # ★ 핵심: Studio·Cast·Tutor 에이전트
│   │   │   │   ├── orchestrator-full.ts      # 13에이전트 전체
│   │   │   │   ├── orchestrator-dynamic.ts   # 동적 라우팅
│   │   │   │   ├── team1-planning / team2-production / cast / instructor
│   │   │   │   └── base.ts                    # 에이전트 추상 클래스
│   │   │   ├── supabase/           # server + admin client 헬퍼
│   │   │   ├── auth/               # 세션·role 헬퍼
│   │   │   ├── tenant/             # 멀티 테넌트 헬퍼
│   │   │   ├── rate-limit/         # Upstash 기반
│   │   │   ├── cost-guard/         # 일/월 비용 한도
│   │   │   ├── email/              # Resend wrapper + 템플릿
│   │   │   ├── rag/                # pgvector 인덱싱·검색
│   │   │   ├── payments/           # Stripe + webhook
│   │   │   ├── csv.ts              # (v2.3) CSV export
│   │   │   └── ...
│   │   └── proxy.ts                # ★ 미들웨어 (Next 16)
│   ├── supabase/migrations/        # 0001 ~ 0050 (현재 50개)
│   ├── scripts/
│   │   ├── seed-demo-users.ts      # 시연 계정
│   │   ├── seed-demo-data.ts       # 더미 데이터
│   │   ├── capture-pages.ts        # Playwright 스크린샷
│   │   └── build-manual-pptx.py    # PPT 생성
│   ├── tests/                      # vitest
│   ├── package.json
│   ├── CLAUDE.md                   # → AGENTS.md 로드
│   └── AGENTS.md                   # Next 16 변경점 경고
└── docs/
    ├── manual/                     # 사용설명서 (시연용)
    └── HANDOVER.md                 # 이 문서
```

---

## 4. 권한 모델 (RLS 중심)

**Role 6종** (`profiles.role`):
| Role | 진입 화면 | 비고 |
|---|---|---|
| `keg_super_admin` | `/super-admin` | KEG 본부장 1명. 전체 테넌트 접근 |
| `admin` | `/admin` | 테넌트 어드민 |
| `tenant_admin` | `/admin` | (예약) 테넌트 분리 어드민 |
| `operations` | `/operations/dashboard` | CS·KPI 위주. `/admin/*` 일부만 접근 |
| `instructor` | `/instructor/dashboard` | 자기 코스만 |
| `sme` | `/sme/dashboard` | 전문 검수자 |
| `creator` | (강사 alias) | Studio 사용 가능 |
| `user` | `/dashboard` | 수강생 (기본값) |

**핵심 SQL 헬퍼 (마이그레이션 0027·0034):**
```sql
is_admin(uid)                  -- role IN ('admin', 'keg_super_admin')
is_admin_or_ops(uid)           -- + 'operations'
is_keg_super_admin(uid)        -- = 'keg_super_admin'
is_instructor_role(uid)        -- IN ('instructor','admin','sme','creator')
```

**규칙:**
- 모든 테이블에 RLS 활성. policy는 마이그레이션에 함께 정의.
- `select * from <table>`만 호출하고 권한은 RLS에 위임 → API에서 if/else 분기 최소화.
- `createAdminClient()`(service role) 사용은 신중히. 사용 시 그 함수 안에서 role 체크를 직접 수행.

**Header 컴포넌트의 role 캐시 (v2.3):**
```ts
const getCurrentUserAndRole = cache(async () => { ... });
```
페이지당 Supabase 호출 2→1로 줄임. `cache()`는 React의 request-level 메모.

---

## 5. 데이터베이스

**마이그레이션 50개** (`apps/web/supabase/migrations/0001 ~ 0050`).

번호별 주요 단위:
| 범위 | 내용 |
|---|---|
| 0001-0005 | profiles, studio_jobs, cost_log 기본 골격 |
| 0006-0012 | samples, sme_evaluations 3축, cast_jobs |
| 0013-0016 | RAG pgvector, tutor 대화/이해도, consent |
| 0017-0021 | audit_log, incidents, KPI·CS 큐들 |
| 0022-0025 | 강사 NPS, content_remediation, retrospective |
| 0026-0033 | course_category, role 6종, student_enrollments, governance, Studio Pro |
| 0034-0041 | 멀티테넌트(`tenants` + `tenant_id`), webhooks |
| 0042-0049 | course_catalog, marketing, sales pipeline, P&L, 글로벌, annual plan, G4 게이트 |
| 0050 | **runtime v2.1** — email_log, subscriptions, payment_log, certificates |

**마이그레이션 적용 검증:**
- `GET /api/admin/db-check` — admin 권한 필요. 50개 테이블·핵심 컬럼·헬퍼 함수·Storage 버킷 9개 일괄 확인.
- 응답 `summary.overall === "✅ all_good"` 이어야 정상.

**Storage 버킷 9종:**
`cast-audio`, `cast-video`, `cast-captions`, `studio-pptx`, `cast-slide-images`, `user-avatar-sources`, `studio-pro-uploads`, `instructor-photos`, `instructor-voices`. 모두 비공개 (signed URL 제공).

---

## 6. 에이전트 아키텍처 (핵심 IP)

3대 솔루션 × 29 에이전트.

```
Studio  ──  TEAM 1 입력검증 (3) ─┐
            TEAM 2 콘텐츠 생성 (5) ─┤── orchestrator-full.ts
            TEAM 3 오케스트레이션 (2)─┤
            TEAM 4 SME 평가 (3) ─────┘    총 13

Cast    ──  TEAM 1~4 = 7 에이전트   src/lib/agents/cast/

Tutor   ──  Intent → RAG → Answer → Eval  src/lib/agents/tutor/  총 9
```

**진입점:**
- `src/lib/agents/orchestrator-full.ts` — Studio 13개 동기 실행
- `src/lib/agents/orchestrator-dynamic.ts` — 분량·카테고리 따라 에이전트 동적 선택
- 각 에이전트는 `base.ts`의 `Agent` 클래스를 상속, `run(input)` 구현.

**모든 호출은:**
1. `cost-guard`로 일/월 한도 체크 → 초과 시 즉시 거절
2. `cost-tracker.ts`가 모델·토큰·USD를 `cost_log`에 기록
3. 실패 시 `studio_jobs.agent_logs` 또는 `cast_jobs.agent_logs`에 단계별 에러

**Phase 4 차별화:** Studio Pro는 강사 자료 RAG (`src/lib/rag/`)와 강사 보이스(`instructor-voices` 버킷)를 결합해 강사 고유 스타일을 유지합니다.

---

## 7. API 라우트 패턴

```ts
// src/app/api/<group>/<action>/route.ts
export const runtime = "nodejs";        // 에이전트·DB는 Node 필요
export const dynamic = "force-dynamic"; // 인증/요청별

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = SchemaZ.parse(await req.json());     // zod 검증 필수
  const rl = await checkRateLimit("group:action", user.id);
  if (!rl.allowed) return rateLimited(rl);

  // ... 처리
}
```

**규칙:**
- 모든 입력은 zod로 검증 (`src/lib/api/` 공통 스키마)
- rate limit은 라우트 핸들러에서 직접 호출 (proxy는 `/api/auth/login|signup`만 처리)
- 에러 응답은 `{ error, message?, retry_after_sec? }` 형식 통일
- 외부 서비스 호출은 항상 try/catch + 비용 기록

---

## 8. 환경 변수

**필수:**
| 키 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 엔드포인트 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저용 anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 admin client (절대 노출 금지) |
| `ANTHROPIC_API_KEY` | Claude (Studio/Cast/Tutor 추론) |
| `CRON_SECRET` | Vercel Cron 인증 |

**솔루션별:**
| 키 | 누가 씀 |
|---|---|
| `HEYGEN_API_KEY` / `HEYGEN_USD_PER_MINUTE` | Cast |
| `ELEVENLABS_API_KEY` | Cast TTS |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | 모델 다양화 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | 결제 |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | 이메일 |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | rate limit + 캐시 |

**비용 한도 (선택, 기본값 코드 내):**
| 키 | 기본 |
|---|---|
| `COST_USER_DAILY_USD` | 5 |
| `COST_USER_MONTHLY_USD` | 50 |
| `COST_GLOBAL_DAILY_USD` | 100 |
| `COST_GLOBAL_MONTHLY_USD` | 1000 |
| `CAST_DAILY_LIMIT_USD` | (별도) |
| `TUTOR_DAILY_LIMIT_USD` | (별도) |

**알림:**
| 키 | 용도 |
|---|---|
| `ADMIN_ALERT_EMAILS` | 콤마 구분 — 인시던트/한도 초과 발생 시 발송 |

---

## 9. Cron 작업 (Vercel Cron)

`vercel.json`에 정의. `/api/cron/*` 핸들러가 `Authorization: Bearer ${CRON_SECRET}` 검증.

| 경로 | 주기 | 용도 |
|---|---|---|
| `/api/cron/measure-kpi` | 매일 00:00 | kpi_metrics 일간 스냅샷 |
| `/api/cron/customer-success` | 매일 06:00 | 위험 학습자 케어 메시지 발송 |
| `/api/cron/learning-reminder` | 매일 09:00 | 미학습 학습자 리마인더 |
| `/api/cron/nps-push` | 분기 첫 월 | NPS 설문 발송 |
| `/api/cron/cost-monitor` | 매시 | 비용 한도 초과 알림 |
| `/api/cron/daily-tasks` | 매일 03:00 | 통합 일일 작업 |
| `/api/cron/governance-report` | 매주 | 거버넌스 리포트 |
| `/api/cron/account-cleanup` | 매일 04:00 | 삭제 예약 계정 처리 |
| `/api/cron/sme-request` | 매시 | SME 검수 요청 알림 |
| `/api/cron/daily-report` | 매일 07:00 | 일일 운영 리포트 |

---

## 10. 멀티 테넌트

- 모든 컨텐츠 테이블에 `tenant_id uuid` (default `00000000-0000-0000-0000-000000000001`).
- 서브도메인 `<slug>.ai-studio.kr` → `proxy.ts`에서 추출해 `x-tenant-slug` 헤더 주입.
- Server에서 `getCurrentTenant()` (`src/lib/tenant/server.ts`)가 헤더 + profiles.tenant_id를 종합해 결정.
- RLS에서 `tenant_id = current_tenant_id()` 조건으로 격리.

---

## 11. 결제 (Stripe)

- `/api/payments/checkout` — Checkout Session 생성. 성공 redirect는 `/dashboard?stripe=success`.
- `/api/payments/webhook` — `STRIPE_WEBHOOK_SECRET` 검증 → `subscriptions`, `payment_log` 업데이트.
- 데모 환경은 Stripe **Test mode**. 라이브 전환 시 키 교체 + webhook endpoint 재등록 필요.

---

## 12. 이메일 (Resend)

- `src/lib/email/send.ts` — `sendEmail()`가 모든 발송 진입점.
- 발송 전 `email_log`에 `queued` 상태로 사전 기록 → 성공 시 `sent` + `resend_id`, 실패 시 `failed` + 에러.
- 템플릿은 `src/lib/email/templates/*.ts` (인증·케어·청구·수료증·강사 주간).
- `RESEND_API_KEY` 미설정이어도 앱은 죽지 않고 `email_log`에 `failed`만 남김 (graceful degradation).

---

## 13. 비용·Rate Limit·관측

**비용 가드 (`src/lib/cost-guard/`):**
```ts
await assertCostBudget(userId, estimatedUsd);   // 한도 초과면 throw
// ... 외부 호출
await recordCost(userId, model, tokens, actualUsd);
```

**Rate limit (`src/lib/rate-limit/`):**
- Upstash sliding window. 키 prefix별 정책: `auth:login`, `studio:create`, `cast:create`, `tutor:chat`...
- 일부 라우트는 IP fallback (비로그인 케이스).

**관측:**
- `cost_log` — 모든 LLM·외부 호출 비용
- `audit_log` — 권한 변경·삭제 등 보안 이벤트
- `email_log` — 모든 이메일
- `incidents` — 시스템 장애
- (선택) PostHog — 페이지뷰·이벤트

---

## 14. 자주 막히는 함정

| 함정 | 대처 |
|---|---|
| **`middleware.ts`를 만들었는데 안 먹는다** | Next 16은 `proxy.ts` (apps/web/src/proxy.ts) |
| **RLS 때문에 row가 안 보인다** | `createClient()` 대신 `createAdminClient()`를 쓸지 의도적으로 결정. admin 사용 시 함수 내 role 체크 필수 |
| **에이전트 작업이 30초 넘어 타임아웃** | Vercel 함수 timeout = 30s/300s(Pro). Cast 같은 장시간 작업은 결과 polling 패턴 사용 |
| **`force-dynamic`가 너무 많다** | 본인 데이터 노출 페이지가 다수라 그렇다. v2.3에서 정적화 진행 중. 새 페이지 만들 때 신중히 결정 |
| **타입 에러가 Supabase 응답에서 발생** | DB schema가 바뀌면 `npx supabase gen types typescript --linked > src/lib/supabase/types.ts` 갱신 |
| **Stripe webhook이 200을 돌려주지 않으면 재시도** | webhook 핸들러는 멱등하게. 같은 이벤트 두 번 받아도 안전해야 함 |

---

## 15. 시연 / 데모

전체는 [docs/manual/USER-MANUAL.md](./manual/USER-MANUAL.md). 핵심만:

```bash
cd apps/web
npm run seed:demo         # 강사·수강생·운영자 계정 (비번 rlarudtn2!)
npm run seed:demo-data    # 코스·티켓·신고·Studio 샘플
BASE_URL=https://ai-studio-drab-nine.vercel.app npm run capture
npm run manual:pptx       # PPT 31장 자동 생성
```

시연 종료 후 cleanup:
```bash
npx tsx scripts/seed-demo-data.ts --cleanup
npx tsx scripts/seed-demo-users.ts --cleanup
```

---

## 16. 알려진 이슈 / 백로그

| 우선순위 | 이슈 | 메모 |
|---|---|---|
| **High** | `ai-studio.kr` DNS Netlify에 잔존 | 시연 전 Vercel로 전환 필요 |
| High | `admin_alerts.message` 컬럼명 미스매치 | 시드 스크립트에서 무해 경고. 마이그 0015 정의는 `alert_message` |
| Med | `force-dynamic` 페이지 다수 → 캐시 비효율 | 페이지별 `revalidate: 60` 또는 정적화 검토 |
| Med | 30개+ 관리자 페이지에 SearchFilter/CSV/EmptyState 미적용 | v2.3 인프라는 깔렸으나 페이지 retrofit 미완 |
| Med | 모바일에서 테이블 가독성 부족 | `md:` breakpoint 이하 카드 레이아웃 변환 필요 |
| Low | Stripe 라이브 키 미적용 | 결제 시작 시점에 교체 |
| Low | 다국어(en/ja) 일부 페이지만 적용 | i18n 키 추가 + 번역 필요 |
| Low | Sentry/PostHog 통합 옵셔널 상태 | 운영 안정화 단계에서 결정 |

---

## 17. 코드 리뷰 / 기여 규칙

- 모든 PR은 `main` 대상. feature 브랜치 사용 (`feature/<topic>`).
- 머지 전 필수:
  - `npx tsc --noEmit` 통과
  - `npm run test` 통과
  - UI 변경 시 `npm run capture` 후 스크린샷 1장 PR에 첨부
- 마이그레이션 추가 시 다음 번호 사용 (현재 0050 → 다음 0051). **기존 마이그레이션 절대 수정 금지**.
- 커밋 메시지는 한국어 또는 영어. 의미 단위로 분리 (refactor 따로, feature 따로).

---

## 18. 외부 의존성 / 연락처

| 영역 | 담당 | 연락 |
|---|---|---|
| Aurein AX (컨설팅·아키텍처) | Aurein 시니어 AX 컨설턴트 | aureinstudio@gmail.com |
| KEG 본부장 (의사결정) | — | (내부) |
| Supabase 프로젝트 owner | aureinstudio@gmail.com | 콘솔 invite |
| Vercel 프로젝트 owner | aureinstudio@gmail.com | 동일 |
| Stripe 계정 | (TBD — 라이브 전환 시) | — |
| Resend 발신 도메인 | `ai-studio.kr` (예정) | DNS 전환 후 SPF/DKIM 등록 |

---

## 19. 참고 문서

- 시연 사용설명서: [docs/manual/USER-MANUAL.md](./manual/USER-MANUAL.md)
- 시연 PPT: [docs/manual/ai-studio-user-manual.pptx](./manual/ai-studio-user-manual.pptx)
- 본부장 마스터 가이드 (S.G.G Framework): `../../../CLAUDE.md` (저장소 루트)
- ai-studio workspace 가이드: `../../CLAUDE.md`
- Next.js 16 변경점: `apps/web/AGENTS.md` → `node_modules/next/dist/docs/`

---

**한 줄 요약:** *"Studio·Cast·Tutor 3솔루션을 떠받치는 Next 16 + Supabase 모노레포. RLS와 비용 가드를 두 기둥으로, 모든 페이지가 role 기반 자동 라우팅된다. 새 기능을 추가할 때는 (1) 마이그레이션 (2) RLS (3) zod 검증 (4) rate limit (5) 비용 기록 다섯 가지를 항상 확인하라."*
