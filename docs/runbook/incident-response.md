# 인시던트 대응

> 4단계 (L1 INFO / L2 WARNING / L3 CRITICAL / L4 EMERGENCY)

## 등급별 응답 시간 + 채널

| Level | 응답 시간 | 채널 | 예시 |
|---|---|---|---|
| **L1** INFO | 24h | DB 기록만 | 비용 80% 도달, 신규 에러 1건 |
| **L2** WARNING | 4h | email | 응답 > 10s, 실패율 5%+, SME 합격선 미달 |
| **L3** CRITICAL | 1h | email (+SMS 후속) | 다운 5분+, 비용 100% |
| **L4** EMERGENCY | 즉시 | 모든 채널 + 전화 | 데이터 유출, 학생 안전 |

## 표준 대응 절차

### 1. 인시던트 발생 (시스템 자동)
- [/admin/incidents](/admin/incidents) 또는 [/admin/monitoring](/admin/monitoring) "진행 중 인시던트"에 자동 표시
- L2+ 이메일 자동 발송 → 본부장·운영팀

### 2. 1차 분류 (운영팀)
- 카테고리 확인 (cost / latency / security / data / safety / student_care)
- 영향 범위 측정 (한 학생 / 전체)

### 3. 시나리오별 대응

#### 다운타임 (L3)
1. [/api/health](https://ai-studio-drab-nine.vercel.app/api/health) JSON 확인
2. degraded면 어느 의존성? (anthropic / supabase / heygen / upstash)
3. Vercel Dashboard → Logs에서 5xx 패턴
4. 15분 미해결 → 학생 공지 (수동 이메일)

#### 비용 폭주 (L3)
1. [/admin/security](/admin/security) cost_alerts 확인
2. 특정 user 폭주면 → 계정 일시 잠금 또는 cost_override 거부
3. 전체 폭주면 → cost-guard `COST_GLOBAL_DAILY_USD` 즉시 조정

#### 데이터 유출 의심 (L4)
1. Supabase service_role 키 즉시 rotation
2. audit_log 24h 추출 → 노출 범위 평가  
3. 본부장 → 법무팀 즉시 보고
4. 학생 통지 (PIPA 72시간 룰)

#### 학생 안전 위험 (L4 if mental_health, L3 otherwise)
1. [/admin/at-risk-students](/admin/at-risk-students) 해당 학생
2. mental_health 신호이면 본부장이 직접 전화
3. 외부 전문기관 안내 (보건복지부 콜센터 129)

### 4. 사후 (모든 인시던트)
- decision_log 또는 incidents.resolution_note에 기록
- L3+ 인시던트는 주간 회고 안건

## 본부장 직접 처리 의무

| 항목 | 위임 가능 여부 |
|---|---|
| L4 EMERGENCY 모든 케이스 | ❌ 본부장 직접 |
| 학생 mental_health | ❌ 본부장 직접 |
| L3 CRITICAL 1차 대응 | ✅ 운영팀 (위임), 본부장 보고 |
| L2 WARNING | ✅ 운영팀 |
| L1 INFO | ✅ 자동 (메일만) |
