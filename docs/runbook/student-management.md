# 학생 관리

> 대상: 운영팀 · 강사 (role=`operations` 또는 `instructor`)

## 시나리오별 대응

### S1. 신규 가입 학생 환영
- **자동 발생**: 베타 신청 승인 → 매직링크 메일 → 학생 첫 로그인 → 온보딩 5단계
- **운영팀 액션** (24h 내):
  - [/admin/beta-applications](/admin/beta-applications)에서 onboarded 상태 확인
  - 첫 로그인 5일+ 미실시 학생 → 환영 리마인더 직접 발송

### S2. 위험 신호 학생 (자동 감지)
- **자동 발생**: 매일 03:00 KST `daily-tasks` cron이 활성 대화에 #09 SafetyDetector 실행
- **트리거**:
  - 7일+ 미접속
  - 같은 단원 3회+ rejected 답변
  - frustration·mental_health 키워드
- **운영팀 액션**:
  - [/admin/at-risk-students](/admin/at-risk-students) 접속
  - 우선순위 순 (high → medium):
    - 📨 격려 메시지 클릭 (자동 이메일 발송)
    - 👨‍🏫 강사 연락 요청 (강사에게 알림)
    - 📅 1:1 세션 제안 (학생에게 이메일)
    - ✓ 확인 처리 (조치 완료 후)

### S3. NPS Detractor (점수 0~6)
- **자동 발생**: NPS 응답 시 즉시 본부장 + 운영팀 알림
- **운영팀 액션**:
  - 응답 사유 확인
  - 학생에게 직접 후속 인터뷰 제안 (15분)
  - 결과 본부장 보고

### S4. 콘텐츠 오류 신고
- **자동 발생**: 학생이 Tutor 답변 우측 "🚩 신고" 클릭
- **SME 자동 알림**: SME 메일함 도착
- **운영팀 액션**: 신고 5건+ 누적된 단원은 강사·SME 정기 미팅 안건으로

### S5. 학생 데이터 삭제 요청
- **수신 경로**: /support 카테고리 'billing' 또는 'other'
- **운영팀 액션**:
  - 본인 확인 (이메일 일치)
  - [/beta-end-options](/beta-end-options) 안내 → 학생이 직접 선택
  - 또는 본부장 승인 후 profile.deletion_scheduled_at 설정

---

## 학생 검색·조회

특정 학생 상태 조회: Supabase Dashboard → SQL Editor
```sql
select id, email, name, role, last_seen_at, onboarding_state, learning_prefs
from profiles where email = 'student@example.com';
```

대화 이력:
```sql
select id, studio_job_id, total_messages, rejected_count, last_active_at
from tutor_conversations where student_id = '<uuid>'
order by last_active_at desc limit 10;
```

## 본부장 에스컬레이션 기준

- mental_health 신호 (severity=high)
- 학생 사망·중상 등 안전 위협
- 법적 분쟁 가능성 있는 항의
- 환불 요청 $100+
