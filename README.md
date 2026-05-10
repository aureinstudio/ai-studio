# KEG AI Studio

> Aurein Studio가 KEG 교육 그룹을 위해 설계·구축한 AI 콘텐츠 생성 플랫폼.
> 13개 AI 에이전트가 4개 팀으로 협업하여 자격증·강의 콘텐츠를 생성합니다.

**라이브:** https://ai-studio-drab-nine.vercel.app
**현재 버전:** v0.13.0 (Studio 13-에이전트 시스템 완료)

---

## 개요

KEG Studio는 본부장 또는 강사가 *주제 한 줄*만 입력하면 다음을 자동 생성합니다:

- 학습 목표 트리 + 챕터·섹션 구조
- 챕터 본문 (한국어, 학습자 수준 맞춤)
- 슬라이드 6~10장 + 강사 노트
- 슬라이드별 인포그래픽 명세
- 자체 품질 검증 (정확성·일관성·형식·학습 목표 부합도)

---

## Studio 13-에이전트 아키텍처

```
TEAM 3 · 오케스트레이션 (1)
└─ #09 오케스트레이터 — 입력 분석 → 실행 계획 (스킵 가능 에이전트 결정)

TEAM 1 · 기획 (4)
├─ #01 종합 분석          — 학습 목표 트리·학습자 프로파일
├─ #02 환경 조사 [병렬]    — 시장·트렌드·산업 컨텍스트
├─ #03 주제 조사 [병렬]    — 학습 목표별 도메인 지식 풀
└─ #04 개요 작성          — 챕터·섹션 구조

TEAM 2 · 제작 (4)
├─ #05 학습프로세스       — 학습 흐름·난이도 시퀀스 (병렬·스킵 가능)
├─ #06 핵심 자료 큐레이터  — 챕터 본문 작성
├─ #07 시각 디자인 기획    — 슬라이드 재구조화
└─ #08 인포그래픽 디자이너 — 도표·인포그래픽 명세 (스킵 가능)

TEAM 4 · 품질 (4)
├─ #10 검토 [병렬]         — 정확성·일관성 검증
├─ #11 형식 확인 [병렬]    — 구조·표준 준수
├─ #12 종합 검토          — 학습 목표 부합도 + approve/revise/reject
└─ #13 최종 품질 최적화    — 가독성·완성도 마감 (점수≥90 시 스킵)
```

**조건부 분기:**
- `#12 = approve` → `#13` 실행 (또는 점수≥90 시 스킵)
- `#12 = revise` → `#06~#08` 자동 재실행 (max 1회)
- `#12 = reject` → 작업 완료, 사유 표시

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | Next.js 16 · Tailwind v4 · shadcn/ui (base-nova) |
| Backend | Next.js API Routes · `after()` 백그라운드 처리 |
| AI | Anthropic Claude Sonnet 4.5 (기본) / Opus 4.7 / Haiku 4.5 |
| DB · Auth | Supabase (Seoul ap-northeast-2) · PKCE flow |
| 배포 | Vercel · GitHub Actions (계획) |
| 모니터링 | cost_log 테이블 + 일일 한도 가드 ($50) |

**최적화:**
- 시스템 프롬프트 caching (`cache_control: ephemeral`)
- 에이전트별 `max_tokens` 차등 (1K~8K)
- 동적 라우팅으로 에이전트 스킵
- 스트리밍 응답 + 토큰 진행 표시

---

## 빌드 단계 (v0.1.0 → v0.13.0)

| 버전 | 내용 |
|---|---|
| v0.1.0 | Next.js 16 + Vercel 배포 |
| v0.2.x | shadcn/ui 디자인 시스템 (모노톤) |
| v0.3.x | Supabase 연결 + 인증 (magic link + email/password) |
| v0.4.x | 프로필 + RLS + 일일 비용 한도 |
| v0.5.0 | Studio 백엔드 기초 (Anthropic SDK + cost_log) |
| v0.6.0 | 멀티 에이전트 첫 형태 (#06 + #07) |
| v0.7.0 | 비동기 jobs + 실시간 폴링 |
| v0.8.0 | CEO 데모 패키지 (script + runbook) |
| v0.9.0 | TEAM 1 추가 (#01~#04, 6 에이전트) |
| v0.10.0 | TEAM 2+4 (#05·#08·#10~#13, 12 에이전트) |
| v0.11.0 | #09 오케스트레이터 + 비용 최적화 (caching, max_tokens) |
| v0.12.0 | #05 병렬화 + #13 조건부 스킵 + 스트리밍 |
| v0.13.0 | /samples (SME 검토) + /demo + /admin 대시보드 |

---

## 주요 경로

| 경로 | 인증 | 용도 |
|---|---|---|
| `/` | 공개 | 랜딩 |
| `/demo` | 공개 | CEO·이사회 시연 진입 |
| `/samples` | 공개 | SME 검토용 샘플 콘텐츠 목록 |
| `/samples/[id]` | 공개 | 샘플 상세 + 평가 폼 |
| `/login`, `/signup` | 공개 | 인증 |
| `/dashboard` | 인증 | 사용자 대시보드 (작업·비용) |
| `/dashboard/history` | 인증 | 작업 이력 |
| `/studio` | 인증 | 콘텐츠 생성 (메인 기능) |
| `/admin` | admin | 시스템 통계·SME 평가 집계 |

---

## 빠른 시작

### 로컬 개발

```bash
cd apps/web
cp .env.example .env.local  # SUPABASE·ANTHROPIC 키 입력
npm install
npm run dev
# → http://localhost:3000
```

### 데이터베이스 마이그레이션

Supabase SQL Editor에서 `apps/web/supabase/migrations/` 의 SQL을 *순서대로* 실행:

```
0001_profiles.sql
0002_studio_jobs_and_cost_log.sql
0003_studio_agent_logs.sql
0004_studio_jobs_soft_delete.sql
0005_studio_jobs_model.sql
0006_samples_and_sme_evals.sql
```

### Anthropic 모델 선택

`/studio` 페이지에서 토글 (사용자가 직접 선택):

| 모델 | 시간 | 비용 | 용도 |
|---|---|---|---|
| Haiku 4.5 | ~80~120초 | $0.06~0.12 | 시연·반복 테스트 |
| Sonnet 4.5 (기본) | ~200~280초 | $0.30~0.50 | 균형 |
| Opus 4.7 | ~300~400초 | $1.50~2.00 | 최고 품질 |

---

## 시연 시나리오

KEG가 검증하는 5개 시나리오:

1. 조리기능사 자격증 - 한식 기초 양념
2. 컴퓨터활용능력 1급 - 함수 활용
3. 토익 RC 파트 5 - 시제 일치 문법
4. 정보처리기사 - 데이터베이스 정규화
5. 사회복지사 1급 - 사례관리 실무

각 시나리오의 검증 기준은 `docs/studio-e2e-scenarios.md` 참조.

---

## 다음 단계

- **W4**: SME (시니어 강사) 평가 결과 수집 → 본부장 의사결정
- **Series 3**: Cast 7-에이전트 (PPT → 영상 변환)
- **Series 4**: Tutor 9-에이전트 (1:1 AI 튜터)
- **Production**: Vercel Pro 또는 Inngest 큐 도입 (60초 timeout 회피)

---

*Aurein Studio · 2026 · "We do not implement technology. We design business structures."*
