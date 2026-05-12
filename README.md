# KEG AI Studio — 3 솔루션 · 29 에이전트

> Aurein Studio가 KEG 교육 그룹을 위해 설계·구축한 AI 교육 통합 플랫폼.
> Studio (콘텐츠 생성) · Cast (영상 변환) · Tutor (학습 동반자) 3개 솔루션 통합 작동.

**라이브:** https://ai-studio-drab-nine.vercel.app
**현재 버전:** v0.21.0 — 통합 완료

---

## 시스템 개요

```
┌────────────────────────────────────────────────────────┐
│              KEG AI Studio (29 agents)                 │
│                                                        │
│  Studio (13) ──────► Cast (7) ◄────── Tutor (9)       │
│   교재 생성          영상 변환         학습 도우미       │
│                                                        │
│   └──────────────► RAG 인덱싱 ◄──────────────┘        │
│                                                        │
│             Meta Orchestrator (Budget · Routing)       │
└────────────────────────────────────────────────────────┘
```

| 솔루션 | 에이전트 수 | 핵심 역할 |
|---|---|---|
| **Studio** | 13 | 자격증·강의 교재 자동 생성 (학습 목표·챕터·본문·슬라이드·인포그래픽) |
| **Cast** | 7 | 슬라이드 → 강의 영상 (Mode A) + 학생 질문 → 영상 답변 (Mode B) |
| **Tutor** | 9 | RAG 기반 1:1 학습 도우미 (다국어·환각 차단·이해도 평가·위험 감지) |

---

## 29 에이전트 전체 목록

### Studio (13)
```
TEAM 3 · 오케스트레이션
└─ #studio-09 오케스트레이터 (동적 라우팅·스킵 결정)

TEAM 1 · 기획
├─ #studio-01 종합 분석
├─ #studio-02 환경 조사 [병렬]
├─ #studio-03 주제 조사 [병렬]
└─ #studio-04 개요 작성

TEAM 2 · 제작
├─ #studio-05 학습프로세스 큐레이터 [병렬·스킵 가능]
├─ #studio-06 핵심 자료 큐레이터
├─ #studio-07 시각 디자인 기획
└─ #studio-08 인포그래픽 디자이너 [스킵 가능]

TEAM 4 · 품질
├─ #studio-10 검토 [병렬]
├─ #studio-11 형식 확인 [병렬]
├─ #studio-12 종합 검토 (approve·revise·reject)
└─ #studio-13 최종 품질 최적화 [점수≥90 시 스킵]
```

### Cast (7)
```
TEAM 1 · 분석 + 스크립트
├─ #cast-01 슬라이드 분석
└─ #cast-02 스크립트 생성

TEAM 2 · 미디어 생성
├─ #cast-03 TTS 음성 (ElevenLabs, 선택)
├─ #cast-04 아바타 영상 (HeyGen multi-scene + webhook)
└─ #cast-05 자막·챕터

TEAM 3 · 오케스트레이션
└─ #cast-06 Cast 오케스트레이터 (Mode B 질문→답변)

TEAM 4 · 품질
└─ #cast-07 영상 품질 검증 (자연성·페이싱·명료성 + 자동 재시도)
```

### Tutor (9)
```
TEAM 1 · 분석
├─ #tutor-01 의도 분류 (Haiku, 병렬)
├─ #tutor-02 컨텍스트 검색 (RAG, 함수)
└─ #tutor-03 언어 감지 (Haiku, 병렬, 5개 언어)

TEAM 2 · 응답
├─ #tutor-04 응답 생성 (Sonnet, 다국어·intent별 톤)
├─ #tutor-05 이해도 평가 (대화 분석 → 점수·약점)
└─ #tutor-06 학습 권장 (개인화 경로 + 동기 메시지)

TEAM 3 · 오케스트레이션
└─ #tutor-07 Tutor 오케스트레이터 (Haiku, 메타 라우팅)

TEAM 4 · 안전
├─ #tutor-08 환각 검증 ⭐ (안전 게이트 — 모든 응답 통과)
└─ #tutor-09 안전·이탈 감지 (자동 트리거 + admin_alerts)
```

---

## 기술 스택

| 영역 | 기술 | 비고 |
|---|---|---|
| Frontend | Next.js 16 · Tailwind v4 · shadcn/ui (base-nova) | App Router |
| Backend | Next.js API Routes + `after()` + webhooks | Vercel Pro 800s |
| LLM | Anthropic Claude (Sonnet 4.5 / Opus 4.7 / Haiku 4.5) | 사용자 토글 |
| Embedding | Gemini gemini-embedding-001 (1536-dim) | 다국어 우수 |
| TTS | HeyGen 자체 (기본) · ElevenLabs (옵션) | |
| Avatar | HeyGen Talking Photo (동양인 검증) | |
| 이미지 생성 | Google Imagen / Nano Banana (gemini-3.1/3-image-preview) | KEG 강사 avatar 생성 |
| Vector DB | Supabase pgvector + HNSW | 코사인 유사도 |
| DB · Auth | Supabase (Seoul ap-northeast-2) · PKCE | |
| 배포 | Vercel Pro · GitHub Actions (계획) | |
| 모니터링 | cost_log + admin_alerts | |

---

## 빌드 단계 (v0.1.0 → v0.21.0)

| 버전 | 내용 |
|---|---|
| v0.1.0 | Next.js 16 + Vercel 배포 |
| v0.2.x | shadcn/ui 디자인 시스템 (모노톤) |
| v0.3.x | Supabase 연결 + 인증 |
| v0.4.x | 프로필 + RLS + 일일 비용 한도 |
| v0.5.0 | Studio 백엔드 기초 (Anthropic SDK + cost_log) |
| v0.6.0 | 멀티 에이전트 첫 형태 (#06 + #07) |
| v0.7.0 | 비동기 jobs + 실시간 폴링 |
| v0.8.0 | CEO 데모 패키지 |
| v0.9.0 | Studio TEAM 1 추가 (6 에이전트) |
| v0.10.0 | Studio TEAM 2+4 (12 에이전트) |
| v0.11.0 | #09 오케스트레이터 + 비용 최적화 |
| v0.12.0 | 병렬화 + 스트리밍 |
| v0.13.0 | Studio 13-에이전트 완성 + /samples + /demo + /admin |
| v0.14.0 | Cast Series 3 시작 (TEAM 1) |
| v0.15.0 | Cast TEAM 2 (TTS + 영상 + 자막) |
| v0.16.0 | Cast Mode B + 모델 선택 UI |
| v0.17.0 | Cast 7-에이전트 완성 (#07 QualityChecker) |
| v0.18.0 | Tutor RAG + #08 환각 검증 (안전 우선) |
| v0.19.0 | Tutor TEAM 1 + 다국어 (5개 언어) |
| v0.20.0 | Tutor 9-에이전트 완성 (#05·06·07·09 + 안전 감지) |
| **v0.21.0** | **3 솔루션 통합 + Meta Orchestrator + 통합 대시보드** |

---

## 주요 경로

| 경로 | 인증 | 용도 |
|---|---|---|
| `/` | 공개 | 랜딩 |
| `/demo` | 공개 | CEO·이사회 시연 진입 |
| `/samples`, `/samples/[id]` | 공개 | SME 검토용 샘플 + 평가 폼 |
| `/login`, `/signup` | 공개 | 인증 |
| `/dashboard` | 인증 | 사용자 대시보드 |
| `/dashboard/learning` | 인증 | 학생 이해도·약점·학습 권장 |
| `/dashboard/history` | 인증 | 작업 이력 |
| `/studio` | 인증 | 콘텐츠 생성 (Studio 13 에이전트) |
| `/cast` | 인증 | Mode A — 슬라이드 → 영상 |
| `/cast/ask` | 인증 | Mode B — 질문 → 답변 (텍스트·영상) |
| `/tutor` | 인증 | 1:1 AI 튜터 (RAG 채팅) |
| `/admin` | admin | 시스템 통계 + SME 평가 집계 |
| `/admin/students` | admin | 학생 위험 알림 대시보드 (#09) |
| `/admin/integration` | admin | 3-솔루션 통합 대시보드 |

---

## 비용 가드레일

| 솔루션 | 일일 한도 | 추가 가드 |
|---|---|---|
| Studio (LLM) | $50 | per-job 비용 추정 + 사용자 승인 |
| Cast (TTS+Video) | $30 | Mode B 호출당 $1, 일일 5회 (영상만) |
| Tutor (LLM+Embed) | $20 | 임베딩 ~$0.000025/1K자 (저렴) |
| **전역** | **$100** | 한도 도달 시 429 응답 |

평균 비용 (1회 실행):
- Studio 풀 체인: $0.30~0.50 (Sonnet)
- Cast 영상 (5장): $2.50~3.00
- Tutor 질문: $0.02 (텍스트만), $0.50 (+영상)
- 이미지 생성 (Nano Banana): $0.07

---

## 빠른 시작

### 로컬 개발

```bash
cd apps/web
cp .env.example .env.local
# 환경변수 채우기: SUPABASE·ANTHROPIC·ELEVENLABS·HEYGEN·GEMINI
npm install
npm run dev
# → http://localhost:3000
```

### 데이터베이스 마이그레이션 (순서대로)

```
0001_profiles.sql
0002_studio_jobs_and_cost_log.sql
0003_studio_agent_logs.sql
0004_studio_jobs_soft_delete.sql
0005_studio_jobs_model.sql
0006_samples_and_sme_evals.sql
0007_cast_jobs.sql
0008_cast_storage.sql
0009_studio_pptx_storage.sql
0010_user_avatars.sql
0011_cast_async_heygen.sql
0012_cast_quality_score.sql
0013_rag_pgvector.sql
0014_tutor_conversations.sql
0015_tutor_understanding_alerts.sql
```

---

## 다음 단계 — Series 5 (Production 전환)

- [ ] Slack webhook · 이메일 알림 발송
- [ ] Vercel Cron 일일 #09 배치
- [ ] FAQ 캐싱 (Mode B 비용 절감)
- [ ] HeyGen webhook signature 검증
- [ ] 학생 베타 50명 + NPS 조사
- [ ] SME 평가 30건+ 누적 + 평균 4.0+
- [ ] 데이터 백업·복구 정책
- [ ] 운영 가이드 (장애·롤백)
- [ ] 법무 검토 (개인정보·서비스 약관)

---

## 시연 자료

- `docs/demo-script-v2.md` — 5분 CEO 시연 스크립트
- `docs/full-system-self-assessment.md` — 10-항목 자가점검
- `docs/cast-readme.md` — Cast 솔루션 상세
- `docs/cast-e2e-scenarios.md` — Cast 수동 검증 시나리오
- `docs/studio-self-assessment.md` — Studio 자가점검
- `docs/performance-benchmark.md` — 성능 측정 템플릿

---

*Aurein Studio · KEG · 2026*
*"We do not implement technology. We design business structures."*
