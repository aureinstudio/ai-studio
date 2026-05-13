# 콘텐츠 관리

> 대상: 강사 · SME · 관리자

## 콘텐츠 생애주기

```
[작성/생성] → [SME 검토] → [학생 공개] → [학생 사용·신고] → [보완/재생성]
```

## 시나리오

### C1. 새 과정 콘텐츠 생성
- 강사가 [/studio](/studio) 접속
- **course_category** 선택 (자격증/직무/언어/취미/학술)
- 주제·수준·길이 입력 → 변환 시작
- 5~10분 후 13 에이전트 자동 생성 완료
- 결과: `/dashboard/history/{job_id}`

### C2. SME 검토 의뢰 (주 1~2회 자동)
- **자동 발생**: 매주 월·목 10:00 KST sme-request cron이 SME 메일 발송
- SME 액션:
  - [/sme/dashboard](/sme/dashboard) → 검토 대기 목록
  - 각 콘텐츠 → 3축 평가 (정확성·적합성·시험부합도)
  - **평균 4.0/5 미달 시 자동 보완 큐 등록**

### C3. SME 평균 4.0/5 미달 (자동 보완 큐)
- **자동 발생**: SME 평가 제출 시 `content_remediation_queue`에 row INSERT
- 본부장 또는 운영팀: [/admin/remediation](/admin/remediation) 접속
- **"🔄 Studio에서 재생성"** 클릭 → Studio 페이지로 이동 (개선 의견 prefill)
- 재생성 후 SME 재검토 → 통과되면 학생 공개

### C4. 학생 콘텐츠 오류 신고
- 학생이 Tutor 답변에서 신고 → `content_reports` INSERT + SME 메일 알림
- SME 액션: [/admin/content-reports](/admin/content-reports) (별도 페이지 v0.38.0)
  - 또는 직접 SQL 조회:
```sql
select * from content_reports where reviewed_at is null order by created_at desc;
```
- 사실 오류 → 강사 미팅 안건 → 콘텐츠 재생성
- 표현 부적절 → 자동 차단 강화 (`input-filter` 패턴 추가 요청)

### C5. 단원 RAG 인덱싱
- Studio 콘텐츠 생성 직후 → 자동 인덱싱 (`POST /api/tutor/index`)
- 학생이 Tutor 사용 가능
- **인덱싱 안 됨**: [/tutor](/tutor) 페이지에서 "인덱싱" 버튼 또는:
```bash
curl -X POST /api/tutor/index -d '{"studio_job_id":"..."}'
```

---

## 콘텐츠 품질 메트릭

| 지표 | 목표 | 어디서 확인 |
|---|---|---|
| SME 평균 평점 | ≥ 4.0/5 | [/admin/hypothesis-tracking](/admin/hypothesis-tracking) H2 |
| SME 합격선 통과율 | ≥ 85% | [/admin/g2-readiness](/admin/g2-readiness) |
| Tutor 환각 차단율 | 5~15% (적정) | [/admin/monitoring](/admin/monitoring) |
| 콘텐츠 신고 비율 | < 1% (시도 대비) | content_reports 카운트 |

## 본부장 에스컬레이션 기준

- SME 합격선 80% 미달 (전체 카테고리)
- 콘텐츠 사실 오류로 학생 항의 발생
- 저작권 침해 신고
