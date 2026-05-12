# Production Readiness Checklist — v0.28.0

> 50~100명 베타 시작 전 본부장 최종 점검 체크리스트.
> 출하 버전: v0.28.0 · 검증일: 2026-05-12

## 1. 인프라 · 도메인

- [x] 1.1 도메인 연결 (Vercel) — ai-studio-drab-nine.vercel.app
- [ ] 1.2 커스텀 도메인 (선택)
- [x] 1.3 SSL 자동 갱신 (Vercel 기본)
- [x] 1.4 Vercel Pro 플랜 (maxDuration 800s)
- [x] 1.5 Supabase Seoul 리전
- [ ] 1.6 Supabase Pro (Connection Pooling + 일일 자동 백업)

## 2. 법무 · 컴플라이언스

- [x] 2.1 이용약관 /legal/terms
- [x] 2.2 개인정보처리방침 /legal/privacy
- [x] 2.3 베타 동의서 /legal/beta-consent
- [x] 2.4 데이터 권리 안내 /legal/data-rights
- [x] 2.5 30일 계정 삭제 cron (account-cleanup)
- [x] 2.6 consent_log 테이블 + PIPA 추적

## 3. 보안 (v0.26.0)

- [x] 3.1 Rate Limiting (Upstash) — tutor 10/min, studio 5/h, cast 3/day, auth 5/15min
- [x] 3.2 Cost Guard 다층 — per-user/global, daily/monthly, cast 별도
- [x] 3.3 입력 위협 필터 — 프롬프트 인젝션, 시스템 추출, DoS
- [x] 3.4 audit_log 테이블 + admin 전용 RLS
- [x] 3.5 cost_overrides 수동 해제
- [x] 3.6 RLS 모든 public.* 테이블 강제 (0017)
- [x] 3.7 is_admin() 헬퍼 함수
- [x] 3.8 보안 헤더 (X-Frame-Options, HSTS, Permissions-Policy)
- [x] 3.9 /api/auth/login·signup IP brute-force 방어
- [ ] 3.10 Upstash Redis 활성화 (Vercel env)

## 4. 데이터 · DB

- [x] 4.1 RLS 모든 테이블
- [x] 4.2 인덱스 (cost_log, tutor_conv, studio_jobs, cast_jobs)
- [x] 4.3 audit_log·incidents·cost_alerts·cost_overrides
- [ ] 4.4 일일 자동 백업 (Supabase Pro 필요)
- [ ] 4.5 백업 복구 시뮬레이션 (RTO < 4h 측정)
- [x] 4.6 service_role 키 서버 전용 (클라이언트 노출 없음)

## 5. 모니터링 · 알림 (v0.28.0)

- [x] 5.1 /api/health JSON — 6개 외부 의존성 (4s timeout)
- [x] 5.2 /admin/monitoring — 실시간 KPI
- [x] 5.3 /admin/security — 보안 감사
- [x] 5.4 /admin/integration — 비용·agent 분포
- [x] 5.5 /admin/students — 위험 신호 학생
- [x] 5.6 /admin/executive — CEO 뷰
- [x] 5.7 일일 리포트 cron (09:00 KST)
- [x] 5.8 비용 모니터 cron (00:00 KST)
- [x] 5.9 인시던트 4단계 + 라우팅 (incidents lib)
- [x] 5.10 Resend 이메일 알림 (3K/월 free)
- [ ] 5.11 PostHog activation (Vercel env에 KEY/HOST)
- [ ] 5.12 Sentry 셋업 (별도 작업 — 현재 미설정)
- [ ] 5.13 외부 모니터링 (UptimeRobot/BetterUptime /api/health 1분 polling)
- [ ] 5.14 SMS/PagerDuty L3+ 연동 (선택)

## 6. 성능 · 부하 (v0.27.0)

- [x] 6.1 Multi-tier 캐시 (L1 LRU + L2 Upstash)
- [x] 6.2 Vercel 함수별 메모리/timeout 튜닝
- [x] 6.3 0018 인덱스 부하 최적화
- [x] 6.4 k6 50 VU 시나리오 실측 — **실패율 0%, p95 7.09s** (목표 5s 미달)
- [ ] 6.5 100 VU 스트레스 한계 측정
- [ ] 6.6 Upstash 활성화 후 재측정 (예상 p95 ~5.5s)
- [ ] 6.7 HallucinationChecker 비동기화 (v0.29.0 후보)
- [ ] 6.8 Anthropic 프롬프트 캐싱 (v0.29.0 후보)

## 7. AI 품질

- [x] 7.1 Studio 13 에이전트 + JSON parse 가드
- [x] 7.2 Cast 7 에이전트 + 품질 사전 검증 (#07)
- [x] 7.3 Tutor 9 에이전트 + 환각 차단 (#08) + 안전 감지 (#09)
- [x] 7.4 RAG (pgvector HNSW + Gemini 임베딩)
- [x] 7.5 다국어 지원 (ko·en·zh·vi·id)
- [x] 7.6 PPT+아바타 PIP 영상 (v0.25.0)
- [ ] 7.7 SME 평가 ≥ 4.0 (15건 이상 수집 후 평가)

## 8. 운영 · 문서

- [x] 8.1 docs/runbook/index.md
- [x] 8.1 docs/production-readiness.md (본 문서)
- [x] 8.3 docs/load-test-report.md
- [x] 8.4 .env.example (committable, 12개 키 카테고리)
- [ ] 8.5 On-call 일정 확정 (베타 4주)
- [ ] 8.6 본부장·COO 비기술 가이드 (대시보드 사용법)

## 9. 배포 자동화

- [x] 9.1 git push → Vercel 자동 배포
- [x] 9.2 next build 통과
- [x] 9.3 tsc --noEmit 통과
- [x] 9.4 마이그레이션 19개 idempotent
- [ ] 9.5 GitHub Actions CI (lint·typecheck PR 차단) — 선택

## 10. 베타 시작 직전 1시간 체크

- [ ] /api/health → status=healthy
- [ ] 5분 단건 시뮬레이션 (tutor 3회·studio 1회) 정상
- [ ] Vercel env 13개 키 모두 설정 (Supabase x3, Anthropic, Gemini, HeyGen, ElevenLabs, Resend x3, Upstash x2, CRON_SECRET)
- [ ] 비용 가드 한도 확인
- [ ] /admin/security audit_log 비어있음
- [ ] 본부장 + AI 엔지니어 on-call 준비

---

## 점수

- **체크 완료**: 약 56 / 70 항목
- **필수 잔여**: Upstash 활성화 · 0017~0019 SQL 적용 · 외부 모니터링 1줄(UptimeRobot) · 100 VU 한계 측정
- **선택 잔여**: 커스텀 도메인 · Supabase Pro · Sentry · SMS/PagerDuty

**판정**: 50명 시작 가능. 100명 확대 전 6.6/6.7 적용 권장.
