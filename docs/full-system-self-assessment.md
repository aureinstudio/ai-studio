# 전체 시스템 자가 점검 v2

> **대상:** 본부장
> **목적:** 3 솔루션 · 29 에이전트 시스템 안정성 직접 확인
> **타이밍:** Series 5 (Production 전환) 시작 전, 또는 CEO 시연 직전

라이브 URL에서 직접 확인하세요: https://ai-studio-drab-nine.vercel.app

---

## 10개 항목

### A. 시스템 가용성

- [ ] **1. 3개 솔루션 풀 시스템 작동**
       `/admin/integration` → 4-카드 시스템 헬스 모두 녹색
       또는 24시간 실패 0~2건 이내

- [ ] **2. 4개 라이브 URL 응답 200**
       - `/studio` (인증)
       - `/cast` + `/cast/ask` (인증)
       - `/tutor` (인증)
       - `/admin/integration` (admin)

### B. Gate G1 시나리오

- [ ] **3. Gate G1 5단계 시나리오 통과 (수동)**
       1. Studio: 자격증 과정 입력 → 완료 (4~5분, Haiku 기준)
       2. Cast Mode A: 위 작업 영상 변환 → 영상 + 자막 다운로드
       3. Tutor: 위 작업 RAG 인덱싱 (~30~60초)
       4. Tutor 질문 → 답변 + 영상 핸드오프 버튼 작동
       5. 4턴+ 대화 → 이해도 평가 → /dashboard/learning 표시

### C. 다국어·안전

- [ ] **4. 다국어 5개 모두 작동**
       Tutor에서 ko·en·zh·vi·id 각각 질문 → 해당 언어 응답

- [ ] **5. 환각 차단 100% (5개 시나리오)**
       - 정상 → approved
       - 교재 외 → off_topic 또는 모름 응답
       - False premise → rejected
       - 일반 상식 → approved
       - 위험 질문 → rejected + admin_alerts 생성

### D. 비용·알림

- [ ] **6. 비용 일일 한도 안정적**
       `/admin/integration` 또는 `/admin` → 30일 평균 일일 비용 $5 미만

- [ ] **7. 알림 시스템 작동 (DB 저장)**
       시연 중 "포기하고 싶어요" 입력 → `/admin/students`에 frustration 알림 표시
       (Slack·이메일 발송은 Phase 2)

### E. 사용자 경험

- [ ] **8. /demo URL CEO 시연 가능**
       비로그인으로 접근 → 4-팀 박스 + 2 CTA 카드 정상 노출

- [ ] **9. /samples URL SME 검토 가능**
       비로그인 접근 → 공개 샘플 목록 (없으면 빈 상태 메시지)
       샘플 클릭 → 평가 폼 작동

- [ ] **10. /dashboard URL 학생 사용 가능**
       학생 권한 계정으로 로그인 → 본인 작업·비용·이해도 조회 가능

---

## 통과 기준

| 통과 항목 수 | 진행 가능 단계 |
|---|---|
| 9~10 | ✅ Series 5 (Production 전환) 진행 |
| 7~8 | ⚠️ 미흡 항목 수정 후 재점검 |
| 6 이하 | ❌ 안정화 우선, Series 5 보류 |

---

## 미흡 항목 처리

```markdown
[자가점검 미흡] N번 - {항목 제목}
- 발견 시점: YYYY-MM-DD
- 증상: ...
- 원인 추정: ...
- 액션 오너: 본부장 / Aurein / SME
- 마감: YYYY-MM-DD
```

---

## Production 전환 사전 체크 (Series 5)

위 10개 통과 후 추가 확인:

- [ ] Slack webhook + 이메일 (SendGrid 등) 알림 발송
- [ ] Vercel Cron 일일 #09 배치 실행
- [ ] FAQ 캐싱 (Mode B 비용 절감)
- [ ] HeyGen webhook signature 검증 (보안)
- [ ] 누적 SME 평가 ≥ 30건, 평균 4.0/5.0 이상
- [ ] 학생 베타 테스트 50명 + 피드백 NPS 50+
- [ ] 데이터 백업·복구 정책 수립
- [ ] 운영 가이드 (장애·롤백)
- [ ] 비용 모니터링 알림 ($100 도달 시 SMS 등)
- [ ] 법무 검토 (개인정보·서비스 약관)

---

*점검일: ____________ / 점검자: 본부장 ____________*
