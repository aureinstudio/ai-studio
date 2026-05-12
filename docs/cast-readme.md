# Cast (Series 3) — 7 에이전트 풀 시스템

> Studio가 생성한 슬라이드를 음성·영상·자막이 포함된 강의 영상으로 변환합니다.
> 2 모드 (Mode A 배치 · Mode B 실시간 Q&A) + 7 에이전트.

**라이브:** https://ai-studio-drab-nine.vercel.app/cast

---

## 7 에이전트 아키텍처

```
TEAM 1 · 분석 + 스크립트 (2)
├─ #cast-01 슬라이드 분석    — 영상 변환용 메타데이터 추출
└─ #cast-02 스크립트 생성    — TTS 친화 한국어 스크립트

TEAM 2 · 미디어 생성 (3)
├─ #cast-03 TTS 음성 (선택)  — ElevenLabs mp3 (HeyGen TTS 사용 시 스킵)
├─ #cast-04 아바타 영상       — HeyGen multi-scene · webhook 비동기
└─ #cast-05 자막·챕터        — SRT + chapters JSON

TEAM 3 · 오케스트레이션 (1)
└─ #cast-06 Cast 오케스트레이터 — Mode B 진입점 (질문 검증 + 답변)

TEAM 4 · 품질 (1)
└─ #cast-07 영상 품질 검증    — 자연성·페이싱·명료성 + 자동 재생성
```

---

## 2가지 작동 모드

### Mode A — 배치 (PPT → 강의 영상)
**경로:** `/cast`
**입력:** Studio가 생성한 슬라이드
**흐름:** `#01 → #02 → #07 (검증·재시도) → #03 (선택) → #04 → #05`
**시간:** 2~3분 (TEAM 1+2 LLM) + 5~15분 (HeyGen 백그라운드)
**비용:** $2.50~5.00 (8슬라이드 기준)
**결과:** 완성된 강의 영상 + SRT 자막 + 챕터 JSON

### Mode B — 실시간 (학생 질문 → 답변)
**경로:** `/cast/ask`
**입력:** 짧은 질문 (5~500자)
**흐름:**
- 텍스트 답변만: `#06` → 완료 (10초, ~$0.01)
- 영상 추가 선택: `#06` → HeyGen 단일 scene → 렌더링 (3~5분, +$0.50~1.00)
**일일 한도:** 영상 5회/사용자 · 텍스트 무제한
**캐싱:** Phase 2 (FAQ 임베딩 유사도)

---

## 외부 API 통합

| 서비스 | 용도 | 비용 |
|---|---|---|
| Anthropic Claude | 모든 LLM 에이전트 | $3/$15 per M tokens (Sonnet 4.5) |
| HeyGen | Avatar 영상 + 자체 TTS | ~$0.50/분 |
| ElevenLabs | TTS (선택) | ~$0.30/1K자 |
| Google Gemini | Avatar 이미지 생성 (Nano Banana) | ~$0.07/이미지 |
| Supabase | DB + Storage | Free tier |

**Webhook 비동기 아키텍처:** HeyGen 영상 렌더링 5~15분 — Vercel 함수 timeout 무관.
완료 시 `/api/cast/webhooks/heygen`이 자동으로 DB 갱신.

---

## 비용 시뮬레이션 (시나리오별)

| 사용량 | Mode A | Mode B 텍스트 | Mode B 영상 | 월 합계 |
|---|---|---|---|---|
| 강사 1인 · 주 2 콘텐츠 | $20 (8회) | — | — | $20 |
| 강사 1인 · 주 2 콘텐츠 + 학생 Q&A 100건/일 (텍스트) | $20 | $30 (3K건) | — | $50 |
| 위 + Q&A 10건/일 영상 | $20 | $30 | $150 (300건) | $200 |

---

## 시연 시나리오 (수동 검증)

### Mode A 시나리오
| # | 주제 | 예상 시간 | 예상 비용 |
|---|---|---|---|
| 1 | 조리기능사 - 한식 양념 | 12분 | $3 |
| 2 | 정보처리기사 - DB 정규화 | 15분 | $4 |
| 3 | 토익 RC - 시제 일치 | 10분 | $2.50 |

### Mode B 시나리오 (텍스트만)
| # | 질문 | 예상 비용 |
|---|---|---|
| 1 | "한식 양념 5가지가 뭐예요?" | $0.01 |
| 2 | "VLOOKUP과 INDEX/MATCH의 차이는?" | $0.01 |

### Mode B 시나리오 (영상)
| # | 질문 | 예상 비용 |
|---|---|---|
| 1 | "한식 양념의 정의를 설명해주세요" | $0.50~1 |

---

## 품질 가드레일

### 자동 재생성 (#07)
스크립트 품질 점수 (자연성·페이싱·명료성) 중 하나라도 50 미만 시:
- ScriptWriter 1회 자동 재시도
- 재시도 후에도 실패 시 본부장 알림 (admin 대시보드)

### 비용 가드레일
- Studio: 일일 $50
- Cast Mode A: 일일 $30
- Cast Mode B 영상: 호출당 $1, 일일 5회
- 한도 도달 시 429 응답

### Fail-Soft
- ElevenLabs 실패 → HeyGen TTS로 자동 fallback
- HeyGen 실패 → 스크립트·자막은 정상 산출 (영상만 누락)
- QualityChecker 실패 → 검증 없이 진행 (LLM 자체 오류 fail-soft)

---

## 다음 단계 (Phase 2)

- [ ] Mode B FAQ 캐싱 (질문 임베딩 유사도)
- [ ] Tutor (Series 4) 통합 — Mode B 답변을 Tutor에서 생성
- [ ] 슬라이드 이미지 시각화 (현재 avatar speaking만, 슬라이드 시각 콘텐츠 미포함)
- [ ] HeyGen Webhook signature 검증
- [ ] 사전 생성 SME 검토 영상 5개

---

*Aurein Studio · KEG · 2026*
