# 데이터 분석

> 대상: 본부장 · 운영팀 · 데이터 담당

## 어디서 무엇을 보나

| 지표 | 페이지 | 갱신 주기 |
|---|---|---|
| 실시간 상태 | [/admin/monitoring](/admin/monitoring) | 즉시 (재로딩 시) |
| 베타 운영 funnel | [/admin/beta-recruitment](/admin/beta-recruitment) | 즉시 |
| 5 가설 KPI | [/admin/hypothesis-tracking](/admin/hypothesis-tracking) | 매일 01:00 KST |
| Gate G2 종합 | [/admin/g2-readiness](/admin/g2-readiness) | 매일 01:00 |
| 위험 학생 | [/admin/at-risk-students](/admin/at-risk-students) | 매일 03:00 |
| 카테고리별 성과 | [/admin/courses-overview](/admin/courses-overview) | 즉시 |
| CEO 요약 | [/admin/executive](/admin/executive) | 즉시 |
| 보안 감사 | [/admin/security](/admin/security) | 즉시 |

## 자동 발송 메일

| 메일 | 시간 | 수신자 |
|---|---|---|
| 야간 자동화 결과 | 매일 03:00 | admin |
| 일일 리포트 | 매일 09:00 | admin |
| 비용 80% 도달 | 즉시 | admin |
| 위험 학생 high severity | 즉시 | admin |
| NPS Detractor | 즉시 | admin |
| SME 검토 요청 | 매주 월·목 10:00 | SME 전원 |
| NPS 응답 안내 | 매주 금 09:00 | 미응답 학생 |
| 학습 알림 | 매시간 (슬롯 매칭) | 해당 학생 |

## 데이터 내보내기

- [/admin/data-export](/admin/data-export) → CSV·JSON 다운로드
- PII (user_id 등) SHA-256 해싱됨 → 외부 분석 안전
- 가능 데이터셋: kpi_metrics, hypothesis_metrics, cost_log, sme_evaluations, nps_responses, student_feedback, incidents

## 직접 SQL 분석 (Supabase Dashboard)

### 활성 학생 (7일)
```sql
select count(*) from profiles 
where role = 'user' and last_seen_at >= now() - interval '7 days';
```

### 카테고리별 콘텐츠 생성 추이
```sql
select course_category, date_trunc('day', created_at)::date as day, count(*)
from studio_jobs
where created_at >= now() - interval '30 days'
group by 1, 2 order by 2 desc, 1;
```

### Tutor 환각 차단 패턴
```sql
select date_trunc('day', last_active_at)::date as day,
       sum(total_messages) as msgs,
       sum(rejected_count) as rejected,
       round(sum(rejected_count)::numeric / nullif(sum(total_messages), 0) * 100, 1) as reject_pct
from tutor_conversations
where last_active_at >= now() - interval '14 days'
group by 1 order by 1 desc;
```

### 비용 효율 (학생당 콘텐츠)
```sql
select course_category,
       count(distinct user_id) as students,
       count(*) as jobs,
       round(sum(cost_usd)::numeric, 2) as total_cost,
       round(sum(cost_usd) / count(distinct user_id), 4) as cost_per_student
from studio_jobs
where created_at >= now() - interval '30 days'
group by 1 order by 4 desc;
```

## 주간·월간 회고 안건

- [/admin/retrospective](/admin/retrospective) — TF 8명 자유 입력
- 카테고리: 잘 된 것 / 어려웠던 것 / 다음에 다르게 할 것
- 매주 금 14:00 30분 미팅 정기 안건
