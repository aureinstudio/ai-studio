# 부하 테스트 보고서 — v0.27.0

> 작성: 2026-05-12 · 대상: KEG AI Studio production (Vercel + Supabase Seoul)
> 목적: 50~100명 동시 수강 시 SLA 검증 + 병목 식별

## 1. 검증 목표

| 지표 | 목표 |
|---|---|
| 동시 사용자 | 50명 sustain (1차) · 100명 ramp (스트레스) |
| Tutor p95 응답 | < 5s |
| 실패율 | < 1% (1차) · < 5% (스트레스) |
| 비용 | < $20/시 |

## 2. 사전 준비 — 본부장 실행 체크리스트

```powershell
# 1) k6 설치
choco install k6     # 또는 https://k6.io/docs/get-started/installation/

# 2) Upstash Redis 활성화 (Production rate limit + L2 cache)
#    Vercel env: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN

# 3) 0018_perf_indexes.sql 실행 (Supabase SQL Editor)

# 4) 테스트 계정 50개 + tokens.json 생성
$env:NEXT_PUBLIC_SUPABASE_URL  = "<from Vercel>"
$env:SUPABASE_SERVICE_ROLE_KEY = "<from Vercel>"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "<from Vercel>"
npx tsx scripts/create-test-users.ts 50 ./tests/load/tokens.json

# 5) 공개 sample studio_job id 확보 (Supabase SQL Editor)
#    select id from studio_jobs where is_sample=true and status='completed' limit 1;
$env:STUDIO_JOB_ID = "<uuid>"

# 6) 1차 — 50명 부하
k6 run -e BASE_URL=https://ai-studio-drab-nine.vercel.app `
       -e STUDIO_JOB_ID=$env:STUDIO_JOB_ID `
       -e TOKENS_FILE=./tests/load/tokens.json `
       tests/load/scenario-tutor.js | Tee-Object docs/load-test-50vu.txt

# 7) 2차 — 100명 스트레스
k6 run -e BASE_URL=... -e STUDIO_JOB_ID=$env:STUDIO_JOB_ID `
       -e TOKENS_FILE=./tests/load/tokens.json `
       tests/load/scenario-stress.js | Tee-Object docs/load-test-100vu.txt

# 8) 정리
npx tsx scripts/create-test-users.ts --cleanup ./tests/load/tokens.json
```

## 3. 적용된 최적화 (v0.27.0)

### 3-1. Multi-tier 캐시 ([lib/cache](../apps/web/src/lib/cache/index.ts))
- **L1**: 인스턴스-로컬 LRU 512 entries, 60s TTL
- **L2**: Upstash Redis, configurable TTL (기본 5분)
- 적용:
  - Gemini query 임베딩 — 24h L2 (같은 질문 재방문 시 0비용·~300ms 절약)
  - RAG `search_rag` RPC — 10분 L2 (인덱스 정적)

### 3-2. DB 인덱스 ([0018_perf_indexes.sql](../apps/web/supabase/migrations/0018_perf_indexes.sql))
- `cost_log(user_id, service, created_at desc)` — cost-guard 다층 합산 sub-1ms
- `cost_log(created_at desc)` — 전역 cron 합산
- `tutor_conversations(student_id, last_active_at desc)` — 학생 대시보드
- `studio_jobs(user_id, status, created_at desc)` — 히스토리
- `cast_jobs(status, user_id, created_at desc)` — rendering 폴링
- `audit_log(endpoint, created_at desc)` — 보안 대시보드

### 3-3. Vercel 함수 튜닝 ([vercel.json](../apps/web/vercel.json))
| 함수 | 메모리 | 최대 시간 |
|---|---|---|
| tutor/ask, safety-check, evaluate | 1024 MB | 60s |
| studio/generate, cast/generate | 1769 MB | 800s |
| cast/webhooks/heygen | 512 MB | 30s |

### 3-4. Rate limit + cost guard (v0.26.0 기반)
- tutor:ask 10/min/user, cast:generate 3/day/user
- per-user $5/일 · 전역 $100/일 자동 차단

## 4. 실측 결과 — 1차 (50 VU sustain)

| 지표 | 측정값 | 목표 | 판정 |
|---|---|---|---|
| p50 | _TBD_ | < 2s | _TBD_ |
| p95 | _TBD_ | < 5s | _TBD_ |
| p99 | _TBD_ | < 10s | _TBD_ |
| 실패율 | _TBD_ | < 1% | _TBD_ |
| 429 비율 | _TBD_ | < 2% | _TBD_ |
| 처리량 | _TBD_ req/s | — | — |
| 총 비용 | _TBD_ USD | < $20/시 | _TBD_ |

> k6 출력 붙여넣기 → `docs/load-test-50vu.txt`

## 5. 실측 결과 — 2차 (100 VU 스트레스)

| 지표 | 측정값 | 비고 |
|---|---|---|
| 한계 임계 (5xx 시작) | _TBD_ VU | — |
| Vercel 콜드 스타트 발생 | _TBD_ 회 | — |
| Supabase 동시 연결 max | _TBD_ | — |
| Anthropic 429/529 발생 | _TBD_ 회 | — |

## 6. 식별된 병목 (실측 후 채움)

- [ ] 항목 1
- [ ] 항목 2

## 7. 추가 최적화 (실측 후 적용)

후속 PR 후보:
- Anthropic 프롬프트 캐싱 (system prompt cache_control breakpoint)
- Tutor #04 Generator를 streaming 응답으로 — 체감 latency 개선
- Supabase pgBouncer pooled URL 전환 (Pro 플랜 시)
- 자주 묻는 질문 응답 캐시 (질문 유사도 ≥ 0.95 → 캐시 hit)

## 8. 한계 임계 + 운영 가이드

(2차 결과로부터 채움)

- 안전 운영 임계: _TBD_ VU
- 비상 시: Vercel concurrency cap / Supabase compute 일시 상향

## 9. 검증 체크리스트

- [ ] Upstash Redis 설정 + L2 cache 동작 (헤더 X-Cache 또는 로그)
- [ ] 0018 인덱스 적용 + `EXPLAIN ANALYZE` 확인
- [ ] 1차 50 VU 통과 (p95 < 5s, 실패율 < 1%)
- [ ] 2차 100 VU 한계 식별 + 문서화
- [ ] rate limit 정상 동작 (의도된 429만)
- [ ] cost guard 80% 알림 도달
- [ ] 테스트 계정 정리 완료
