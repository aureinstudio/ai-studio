# Runbook — KEG AI Studio Production

> v0.28.0 · 50~100명 베타 운영 대응 매뉴얼
> 본부장 + AI 엔지니어 공용. 인시던트 발생 시 본 문서 먼저 확인.

## 빠른 링크

| 도구 | URL | 용도 |
|---|---|---|
| /admin/monitoring | 실시간 KPI · 헬스 · 비용 | 1차 확인 |
| /admin/security | 차단·rate limit·audit_log | 보안 사고 |
| /admin/integration | 통합 cost·agent 현황 | 비용 분석 |
| /admin/students | 위험 신호 학생 | 학생 안전 |
| /api/health | JSON 헬스 체크 | UptimeRobot |
| Supabase Dashboard | DB·log·storage | 데이터 |
| Vercel Dashboard | 배포·log·function | 인프라 |
| Anthropic Console | API 사용량·한도 | LLM |

## 인시던트 레벨

| Level | 응답 시간 | 채널 | 예시 |
|---|---|---|---|
| **L1 INFO** | 24h | DB 기록만 | 비용 80%, 신규 오류 1건 |
| **L2 WARNING** | 4h | email | 응답 > 10s, 실패율 5%+ |
| **L3 CRITICAL** | 1h | email (+SMS 후속) | 다운 5분+, 비용 100% |
| **L4 EMERGENCY** | 즉시 | email (+phone 후속) | 데이터 유출, 학생 안전 |

## 시나리오별 대응

### S1. Tutor 응답 시간 급증 (p95 > 10s)

**증상**: /admin/monitoring 환각 차단율 정상이나 학생 항의

**대응 순서**:
1. `/api/health` JSON 확인 → anthropic / supabase latency
2. Anthropic Console — rate limit·incident 확인
3. Supabase Dashboard — DB connections·query duration
4. Upstash console — 캐시 hit rate (있다면 5분 캐시 효과)
5. **임시**: Anthropic 장애면 학생에게 "AI 일시 지연" 공지

**근본 원인 후보**: cold start, RAG 미캐시, Anthropic latency, DB connection saturation
**해결**: 모두 외부 의존성 — 자체 fix 한정적. 5분 대기 후 재측정.

### S2. 비용 한도 100% 초과

**증상**: cost-monitor cron 이메일 "한도 임박/초과", /admin/security cost_alerts

**대응**:
1. /admin/security → 어느 사용자가 초과했는지 확인
2. 정상 학습자면 cost_overrides에 수동 해제 row 추가 (24h)
3. 악의적·이상 패턴이면 audit_log 확인 → 계정 잠금
4. 전역 한도 초과면 cost-guard `COST_GLOBAL_DAILY_USD` 일시 상향

**SQL — override 추가 (24h)**:
```sql
insert into cost_overrides (user_id, scope_key, reason, granted_by, expires_at)
values ('<user_uuid>', 'per_user_daily', '시연 요청', auth.uid(), now() + interval '24 hours');
```

### S3. 학생 안전 위험 (#09 SafetyDetector 알림)

**증상**: 본부장 이메일 "🚨 high severity"

**대응**:
1. /admin/students → 알림 row 확인
2. evidence·intervention·dropout_risk_score 검토
3. 학생에게 직접 연락 (전화 우선) — high severity는 24h 이내
4. 후속: profiles.notes에 대응 기록

### S4. 다운타임 (5분+)

**증상**: UptimeRobot 알림, /api/health 503

**대응**:
1. Vercel 배포 상태 — 최근 deploy 실패?
   ```
   gh run list --workflow=deploy --limit 5
   ```
2. 실패면 직전 commit으로 rollback
   ```
   git revert HEAD && git push
   ```
3. 인프라 장애(Vercel/Supabase status page) — 외부 의존
4. **15분 미해결**: 학생 공지 — 슬랙·이메일 (수동)

### S5. 데이터 유출 의심 (L4)

**증상**: 비정상 SELECT 패턴, 외부 IP 대량 접근, RLS 우회 시도

**대응 (즉시)**:
1. service_role 키 즉시 rotation (Supabase Dashboard → Settings → API)
2. 모든 학생 세션 강제 로그아웃: `update auth.users set updated_at = now();` (refresh 강제)
3. audit_log 24h 추출 → 노출 범위 평가
4. 본부장 → 법무팀 즉시 보고
5. 학생 통지 (PIPA 72시간 룰)

### S6. Anthropic·외부 API 인증 실패

**증상**: 일제히 401·403, /api/health critical fail

**대응**:
1. 해당 콘솔 → 키 활성 상태
2. 키 rotation 후 Vercel env 갱신 + redeploy
3. 갱신 중 학생에게 "복구 중" 공지

## 일일 운영 체크리스트 (오전 9시)

- [ ] /admin/monitoring → status=healthy
- [ ] 일일 리포트 이메일 도착
- [ ] 비용 진행률 < 80%
- [ ] 진행 중 인시던트 0건
- [ ] /admin/security → 차단 0~소수

## On-call 연락처

| 역할 | 이름 | 연락처 | 시간대 |
|---|---|---|---|
| 본부장 | _TBD_ | _TBD_ | 평일+주말 |
| AI 엔지니어 | _TBD_ | _TBD_ | 평일 9~18 |

> Notion 또는 PagerDuty 일정표 추후 통합.
