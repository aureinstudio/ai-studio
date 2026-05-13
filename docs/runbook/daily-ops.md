# 일상 운영 — 매일 15분 체크

> 대상: 운영팀 (role=`operations`) / 관리자 (role=`admin`)
> 빈도: 매일 오전 9시 (일일 리포트 이메일 도착 직후)

## 매일 확인 순서

### 1. 시스템 헬스 (1분)
- 접속: [/admin/monitoring](/admin/monitoring)
- **확인**: 시스템 상태가 `healthy`
- **degraded면**: 의존성 상태 표 확인 → 어느 외부 API가 fail인지 식별
- **unhealthy면**: 본부장 즉시 보고

### 2. 일일 자동화 결과 메일 (3분)
- 매일 03:00 KST 발송 (제목: `🌙 야간 자동화 완료 …`)
- **체크 포인트**:
  - 안전 검사 N건 (활성 대화 대상)
  - 위험 알림 신규 X건 → X > 0이면 5단계로
  - 격려 메일 발송 N건
  - 어제 비용 $X

### 3. 09:00 일일 리포트 메일 (2분)
- 매일 09:00 KST 발송 (제목: `📊 일일 리포트 YYYY-MM-DD`)
- **체크 포인트**:
  - 환각 차단율 — 평소 5~10% 정상, 30%+ 비정상
  - 진행 중 인시던트 (있으면 어떤 카테고리)
  - 비용 누적 — 예산 진행률

### 4. 위험 학생 (3분)
- 접속: [/admin/at-risk-students](/admin/at-risk-students)
- **high severity 학생**: 직접 격려 메시지 또는 강사 연락 요청
- **medium severity**: 1주일 후 재평가 메모
- 무조건 24시간 내 1번 이상 액션

### 5. 신규 베타 신청 (3분)
- 접속: [/admin/beta-applications](/admin/beta-applications)
- **pending 탭**: 24시간 이내 모두 검토
- 자격 충족 → 승인 (자동 매직링크 발송)
- 부적격 → 정중 거부 (자동 안내 메일 발송)

### 6. 보안 감사 (2분)
- 접속: [/admin/security](/admin/security)
- 차단된 요청 수 (어제 대비)
- top 위반 IP·user — 패턴이면 본부장 보고

### 7. CS 문의 (1분)
- 접속: [/admin/support-tickets](/admin/support-tickets) (별도 페이지 v0.38.0 예정)
- 또는 Resend 메일함의 `🆘 신규 문의` 검색
- **SLA 24시간** — 늦지 않게 응대

---

## 발생 가능 문제

| 증상 | 원인 후보 | 1차 대응 |
|---|---|---|
| /admin/monitoring → unhealthy | 외부 API 장애 | 헬스 체크 표에서 fail API 확인 → 해당 콘솔 점검 |
| 비용 한도 80% 알림 도착 | 학습 활성도 ↑ 또는 비정상 사용 | /admin/security에서 폭주 패턴 확인 |
| 일일 리포트 미도착 | cron 실패 또는 SMTP | Vercel function logs (`/api/cron/daily-report`) |

## 본부장 에스컬레이션 기준

다음 경우 즉시 본부장에게:
- 시스템 unhealthy 5분+ 지속
- 비용 한도 100% 도달
- 위험 학생 mental_health 신호
- 데이터 유출 의심
