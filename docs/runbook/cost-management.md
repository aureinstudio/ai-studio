# 비용 관리

> 대상: 운영팀 · 관리자

## 비용 구조 (월 단위 추정)

| 항목 | 단가 | 50명 베타 월 추정 |
|---|---|---|
| Anthropic Claude (Studio·Tutor) | Sonnet $3/$15 per 1M tokens | $50~100 |
| Gemini 임베딩 (RAG) | $0.000025/1K chars | $5 |
| HeyGen (Cast 영상) | $2/분 (Creator 초과분) | **$400~1500** ← 가장 큼 |
| ElevenLabs TTS (선택) | $0.30/1K chars | $0~50 |
| Supabase | Pro $25/월 | $25 |
| Vercel | Pro $20/월 | $20 |
| Upstash Redis | Pay-as-you-go | $5~20 |
| Resend | Free 3K/월 | $0 |
| **합계** | | **$500~1700** |

## 임계값 알림

| 한도 | 환경 변수 | 80% 알림 | 100% 차단 |
|---|---|---|---|
| per_user_daily | `COST_USER_DAILY_USD` (기본 $5) | email | 신규 요청 차단 |
| per_user_monthly | `COST_USER_MONTHLY_USD` (기본 $50) | email | 차단 |
| global_daily | `COST_GLOBAL_DAILY_USD` (기본 $100) | email | 전체 차단 |
| global_monthly | `COST_GLOBAL_MONTHLY_USD` (기본 $1000) | email | 전체 차단 |
| cast_user_daily | `COST_CAST_USER_DAILY_USD` (기본 $2) | email | Cast만 차단 |
| cast_global_daily | `COST_CAST_GLOBAL_DAILY_USD` (기본 $30) | email | Cast만 차단 |

## 시나리오

### M1. 80% 알림 도착
- **자동**: cost-monitor cron (00:00 KST) 또는 학생 요청 시 즉시 평가
- 운영팀 액션:
  - [/admin/security](/admin/security) cost_alerts 표 확인
  - 정상 학습 패턴이면 → 대기 (자정에 초기화)
  - 비정상 폭주면 → 해당 user 일시 잠금

### M2. 100% 차단 발동
- 학생이 차단된 경우 → 401/402 에러 응답
- 정당한 사용자면:
  - SQL Editor: `cost_overrides` row 추가
```sql
insert into cost_overrides (user_id, scope_key, reason, granted_by, expires_at)
values ('<user_uuid>', 'per_user_daily', '시연 요청', auth.uid(), now() + interval '24 hours');
```
  - 또는 환경 변수 `COST_*_USD` 상향 (Vercel Dashboard)

### M3. HeyGen 폭주
- Cast 영상 1건 = $4~12 (영상 길이 의존)
- 학생 본인이 자기 콘텐츠만 변환 가능 — 대량 사용 시 의도적 abuse 가능성
- 대응: cast_user_daily 한도 강화 또는 학생당 영상 횟수 제한

### M4. Anthropic 크레딧 부족 (Console balance < $5)
- 증상: 400 `Insufficient credit. This operation requires 'api' credits.`
- 대응: https://console.anthropic.com/settings/billing → Add funds OR Auto-refill ON

## 일일 비용 추적

- [/admin/monitoring](/admin/monitoring) 비용 누적 카드 (오늘/7일/30일)
- [/admin/integration](/admin/integration) 서비스별 30일 분포
- [/admin/courses-overview](/admin/courses-overview) 카테고리별 비용

## 본부장 에스컬레이션 기준

- 월 비용 예산 대비 +30% 초과
- 단일 학생 1회 작업 $20+ 청구
- HeyGen 또는 Anthropic 결제 카드 거절
