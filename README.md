# ai-studio

> KEG 자체 AI 교육 플랫폼 — Aurein AX × KEG 통합 베타 앱
> **Beta v1 (v0.8.0) — Studio 2-에이전트 협업 라이브**

## 목적

KEG 교육 그룹의 AI 교육 솔루션 3종 (Studio · Cast · Tutor) 베타 운영을 위한 웹 애플리케이션. 1차 PoC(P3 Max Tutor)에서 검증된 29 에이전트 + 통합 인터페이스(CAE)를 단일 플랫폼으로 노출한다.

| 항목 | 값 |
|---|---|
| **버전** | v0.8.0 (Beta v1, 2026-05-10) |
| **라이브** | 🌐 https://ai-studio-drab-nine.vercel.app |
| **저장소** | https://github.com/aureinstudio/ai-studio |
| **스택** | Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Supabase · Anthropic Claude |
| **모노레포** | `apps/web/` (Next.js) |

## 빠른 시작

```bash
cd apps/web
cp .env.example .env.local
# .env.local에 Supabase 키·Anthropic API 키 입력 (관리자 발급)
npm install
npm run dev
# → http://localhost:3000
```

## 디렉토리

```
ai-studio/
├── apps/web/                       # Next.js 16 frontend + API routes
│   ├── src/
│   │   ├── app/                    # App Router 페이지·API
│   │   │   ├── (public)            # /, /login, /signup, /health
│   │   │   ├── (protected)         # /studio, /dashboard, /dashboard/history
│   │   │   ├── api/studio/         # generate · jobs · jobs/[id]
│   │   │   └── auth/callback/      # PKCE OAuth callback
│   │   ├── components/             # Header · Footer · LogoutButton · StudioJobResult · ui/
│   │   ├── contexts/AuthContext.tsx
│   │   ├── hooks/useUser.ts
│   │   ├── lib/
│   │   │   ├── supabase/           # client (browser) · server (cookies) · admin (service role) · middleware (proxy helper)
│   │   │   ├── anthropic/client.ts # Claude SDK wrapper
│   │   │   ├── agents/             # base + team2/* (06 큐레이터 · 07 시각 디자인) + orchestrator
│   │   │   ├── cost-tracker.ts     # 비용 계산 + DB 기록
│   │   │   └── limits.ts           # 일일 한도 상수
│   │   └── proxy.ts                # Next.js 16 미들웨어 (Supabase 세션 + 보호 라우팅)
│   └── supabase/migrations/        # 0001~0004 SQL
├── docs/                           # 시연 시나리오·트러블슈팅·체크리스트
└── scripts/demo-check.sh           # 시연 사전 자동 점검
```

## 빌드 단계

| 버전 | 날짜 | 핵심 |
|---|---|---|
| v0.1.0 | 2026-05-09 | Next.js 16 init + Vercel 배포 + 랜딩 페이지 |
| v0.2.0 | 2026-05-09 | shadcn/ui + 디자인 시스템 (Midnight Executive) |
| v0.2.1 | 2026-05-09 | 모노톤 팔레트 전환 (Linear/Vercel 톤) |
| v0.3.0 | 2026-05-09 | Supabase 연결 + /health endpoint |
| v0.3.1 | 2026-05-09 | Supabase Seoul region 마이그레이션 + 실 RTT 측정 |
| v0.4.0 | 2026-05-09 | 인증 (매직 링크 + 비밀번호) + profiles RLS + admin role |
| v0.5.0 | 2026-05-10 | Studio API + Claude Sonnet 4.5 통합 + 비용 추적 |
| v0.6.0 | 2026-05-10 | 멀티에이전트 체인 (큐레이터 → 시각 디자인) + agent_logs |
| v0.7.0 | 2026-05-10 | 작업 히스토리 + 통계 대시보드 + 일일 한도 가드레일 |
| **v0.8.0** | **2026-05-10** | **CEO 시연 패키지 (시나리오·트러블슈팅·자동 점검)** |

## 주요 기능 (Beta v1)

### Studio (TEAM 2 — 2/13 에이전트 라이브)
- `studio-06` 핵심 자료 큐레이터 — 챕터 본문·학습 목표·예제 작성
- `studio-07` 시각 디자인 기획 — 슬라이드 + 강사 노트 재구조화
- 비동기 polling 패턴 (`POST` → `jobId` 즉시 → 1s polling)
- 결과 3탭: 본문 / 슬라이드 / 에이전트 로그 타임라인

### Auth & RBAC
- Supabase Auth (PKCE, 매직 링크 + 비밀번호)
- `profiles` 테이블 + 자동 생성 트리거
- `role`: `user` | `admin` (서버 측 SQL로만 승격, 클라이언트 self-escalation 차단)

### 운영 가시성
- 통계 3카드 (총 작업 / 이번 달 비용 / 성공률)
- 일일 한도 progress bar ($50 USD, 80% warn / 100% block)
- 작업 히스토리 (검색·페이지네이션·soft delete·공유 링크)
- `cost_log` 테이블에 모든 LLM 호출 비용 누적 (admin은 전체 조회)

### Production 배포
- Vercel (us-east 기본, function maxDuration 60s)
- Supabase Seoul (ap-northeast-2)
- Marketplace integration으로 16개 env vars 자동 동기화
- Sensitive env (API 키 노출 차단)

## 다음 단계 (Roadmap)

| Phase | 범위 | 일정 |
|---|---|---|
| **v0.9~v1.2** | Studio TEAM 1·3·4 (11개 에이전트 추가) — Prompt 9~12 시리즈 | 6~8주차 |
| **v1.3~v1.6** | Cast 7개 에이전트 — Prompt 13~16 시리즈 | 9~10주차 |
| **v1.7~v2.0** | Tutor 9개 에이전트 — Prompt 17~20 시리즈 | 11~12주차 |
| **v2.0** | 29 에이전트 풀 시스템 + Meta Orchestrator UI | W4 종료 |

## 시연 자료

| 문서 | 용도 |
|---|---|
| [docs/demo-script.md](docs/demo-script.md) | CEO 시연 3분 시나리오 |
| [docs/demo-troubleshooting.md](docs/demo-troubleshooting.md) | 시연 중 장애 대응 매뉴얼 |
| [docs/demo-pre-check.md](docs/demo-pre-check.md) | 사전 점검 체크리스트 |
| [scripts/demo-check.sh](scripts/demo-check.sh) | 라이브 자동 점검 (15 checks) |

## 연관 문서 (상위 PoC 계획)

- [부모 프로젝트 가이드](../../CLAUDE.md)
- [통합 인터페이스 명세](../../05-agents/specs/INTEGRATION.md)
- [PoC 실행 계획](../../02-execution/milestones.md)
- [에이전트 29 명세 INDEX](../../05-agents/specs/INDEX.md)

## License

KEG · Aurein AX 내부 자산. 외부 배포 금지.

---

*Powered by Aurein AX × KEG*
