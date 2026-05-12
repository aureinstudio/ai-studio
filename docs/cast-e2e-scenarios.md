# Cast E2E 시연 시나리오 (수동 검증)

> **목적:** Cast 7-에이전트 시스템이 양 모드에서 정상 작동하는지 본부장이 직접 확인
> **자동화:** Playwright/Vitest는 Phase 2 (현재 수동만)

---

## 통과 기준

| 항목 | 기준 |
|---|---|
| Mode A 완료까지 시간 | 18분 이내 |
| Mode B 텍스트 응답 시간 | 30초 이내 |
| Mode B 영상 응답 시간 | 8분 이내 |
| Cast 비용 (Mode A 1회) | $5 이내 |
| QualityChecker 통과율 | 80%+ |
| Fail-soft 작동 | 비핵심 실패해도 부분 결과 |

---

## 시나리오 1: Mode A — 자격증 콘텐츠 풀 영상

**준비:**
- Studio에서 "조리기능사 자격증 - 한식 기초 양념" 작업 완료 상태
- AI 생성 avatar 1개 (요리 강사) 보유

**절차:**
1. `/cast` 접속
2. Studio 작업 선택
3. **아바타: 내 avatar → 요리 강사**
4. **음성: HeyGen TTS** (기본)
5. 비용 추정 확인 (예상 $3 내외)
6. ☑ 위 비용 사용 승인
7. "변환 시작" 클릭

**검증:**
- [ ] #cast-01 슬라이드 분석 완료 (~20초)
- [ ] #cast-02 스크립트 생성 완료 (~40초)
- [ ] #cast-07 품질 검증 완료 (~15초, 점수 표시)
- [ ] #cast-04 HeyGen 제출됨 (status="rendering")
- [ ] #cast-05 자막·챕터 완료
- [ ] **Vercel 함수 종료 (2~3분 내)** ← 핵심
- [ ] HeyGen 렌더링 (5~15분 백그라운드)
- [ ] Webhook 자동 도달 → status="completed"
- [ ] 영상 플레이어·다운로드·SRT 표시
- [ ] 휴대폰으로 다운로드 영상 재생 가능

---

## 시나리오 2: Mode B — 텍스트 Q&A

**절차:**
1. `/cast/ask` 접속
2. 질문: "한식 양념 5가지가 뭐예요?"
3. 과정 컨텍스트: "조리기능사 자격증 - 한식 기초"
4. ☐ 영상으로 받기 (체크 안 함)
5. "텍스트 답변 받기" 클릭

**검증:**
- [ ] ~10초 내 답변 표시
- [ ] 답변 200~500자 자연스러운 한국어
- [ ] 비용 ~$0.01 표시
- [ ] cost_log에 service='cast' 기록

---

## 시나리오 3: Mode B — 영상 Q&A

**절차:**
1. `/cast/ask` 접속
2. 질문: "비빔밥의 핵심 양념은 무엇인가요?"
3. ☑ 영상으로 받기 (체크)
4. 아바타 선택: 요리 강사
5. "텍스트 + 영상 받기" 클릭

**검증:**
- [ ] ~10초 내 텍스트 답변 즉시 표시
- [ ] status="rendering" 노란 배지
- [ ] ~3~5분 후 영상 자동 표시
- [ ] 영상 길이 60~150초
- [ ] 비용 $0.50~1.00 범위

---

## 시나리오 4: 비용 가드 검증

**Mode B 영상 한도 (5회/일):**
1. 같은 날 영상 모드로 5회 호출
2. 6번째 호출 시 429 응답 확인:
   ```json
   { "error": "mode_b_video_daily_limit_reached", "used": 5, "limit": 5 }
   ```
3. 텍스트는 계속 사용 가능 (한도 무관)

**Studio 일일 $50 한도:**
1. Studio에서 비싼 작업 반복 호출
2. 누적 $50 도달 시 429:
   ```json
   { "error": "daily_limit_reached" }
   ```

---

## 시나리오 5: 부적절 질문 차단

**절차:**
1. `/cast/ask` 접속
2. 질문: "내일 시험 답안 알려줘"
3. 텍스트 답변 받기

**검증:**
- [ ] #cast-06 오케스트레이터가 `is_appropriate: false` 반환
- [ ] status="failed", error_message에 사유 표시
- [ ] HeyGen 호출 안 됨 (비용 0)

---

## 시나리오 6: 품질 자동 재생성

**준비:** 일부러 짧고 모호한 Studio 콘텐츠 생성

**검증:**
- [ ] #cast-07 점수 50 미만
- [ ] retry_count=1로 ScriptWriter 자동 재실행
- [ ] 재검증 후 통과 (또는 둘 다 실패 시 retry_count=1로 진행)
- [ ] admin 대시보드에 "자동 재생성" 카운터 증가

---

## 실패 시 진단

| 증상 | 가능 원인 | 확인 |
|---|---|---|
| Vercel 함수 timeout | 폴링 잔존 코드 | orchestrator-full.ts에 submitHeyGenVideo 사용 확인 |
| HeyGen webhook 미도달 | 환경변수·URL 문제 | `/api/cast/webhooks/heygen` 직접 GET 200 응답 확인 |
| ElevenLabs quota | 무료 한도 도달 | HeyGen TTS로 전환 |
| HeyGen credit 부족 | API credits 0 | https://app.heygen.com/settings?nav=API |
| Gemini 이미지 생성 실패 | Nano Banana paid tier 필요 | Gemini API 키 paid plan 확인 |

---

## 시연 결과 기록

```markdown
### 시나리오 N — YYYY-MM-DD
- 모드: Mode A / Mode B (텍스트/영상)
- 실행 시간: ___분 ___초
- 비용: $___
- 품질 점수 (자연성·페이싱·명료성): __·__·__
- 재시도 횟수: ___
- 통과: ✓ / ✗
- 비고: ...
```
