# 시연 중 장애 대응 매뉴얼

> **사용 시점:** 라이브 시연 중 *예외 상황 발생 시*. 본부장 노트북 옆에 인쇄·표시 권장.
> **원칙:** 청중에게 *"네트워크 이슈가 있어 미리 만든 결과를 보여드리겠습니다"* 자연스럽게 전환.

---

## 장애 매트릭스 (확률 × 영향)

| ID | 장애 | 확률 | 영향 | 대응 시간 목표 |
|---|---|---|---|---|
| F-1 | API 호출 timeout (60s+ 초과) | High | Critical | 5초 내 백업 전환 |
| F-2 | Vercel 콜드 스타트 지연 | Medium | High | 사전 워밍업으로 회피 |
| F-3 | 일일 비용 한도 도달 | Low | Critical | 30초 SQL 증액 |
| F-4 | 결과 콘텐츠 너무 짧음/이상 | Medium | High | 검증된 주제만 사용 |
| F-5 | Anthropic API 5xx | Low | Critical | 백업 URL 즉시 전환 |
| F-6 | 인증 세션 만료 | Low | Medium | 로그인 후 백업 URL |
| F-7 | 인터넷 끊김 | Low | Critical | 모바일 핫스팟 |
| F-8 | Vercel 다운 | Very Low | Critical | 영상 캡처 백업 |

---

## F-1. API 호출 timeout

### 증상
- "에이전트 작업 중..." 90초 이상 멈춤
- Pipeline에 ⏳ 그대로
- 또는 ❌ 실패 + "Request timed out" 메시지

### 즉시 대응 (5초)
1. *말없이* 새 탭 열기 (`Ctrl+T`)
2. `docs/demo-script.md`의 **백업 URL #1** 붙여넣기
3. 청중 안내: *"방금 다른 작업도 미리 준비해뒀는데, 이쪽이 더 잘 보여서 같이 보겠습니다."* (자연스러운 이어가기)
4. 본문·슬라이드·로그 탭 동일하게 시연 진행

### 사후 (시연 후)
- Vercel function logs 확인 (chain 어디서 죽었는지)
- 프롬프트 추가 압축 검토 (v0.6.1 후속)

---

## F-2. Vercel 콜드 스타트 지연

### 증상
- 첫 요청이 5-10초 멈춤 (다음 요청은 정상)

### 사전 회피 — *시연 5분 전 워밍업*

본부장이 시연 *5분 전* 다음 작업 1회 수행:

```bash
# 1. 라이브 URL 5개 GET (서버리스 인스턴스 워밍)
curl -s https://ai-studio-drab-nine.vercel.app/ > /dev/null
curl -s https://ai-studio-drab-nine.vercel.app/studio > /dev/null
curl -s https://ai-studio-drab-nine.vercel.app/dashboard > /dev/null
curl -s https://ai-studio-drab-nine.vercel.app/dashboard/history > /dev/null
curl -s https://ai-studio-drab-nine.vercel.app/health > /dev/null

# 2. /health에서 Supabase ms 측정 (1자리 ms 정상)
curl -s https://ai-studio-drab-nine.vercel.app/health | grep -oE 'tabular-nums[^>]*>[0-9]+'
```

또는 사전 점검 스크립트 1회 실행:
```bash
bash scripts/demo-check.sh
```

---

## F-3. 일일 비용 한도 도달

### 증상
- "생성하기" 클릭 시 에러: *"오늘 사용 비용 $X.XX이 일일 한도 $50에 도달했습니다."*
- 대시보드 progress bar 100% 빨강

### 즉시 대응 (30초)
Supabase SQL Editor에서 즉시 임시 증액:

```sql
-- 일시적 한도 우회 — 본부장 행만 today cost reset
update public.cost_log
set cost_usd = cost_usd * 0.0  -- 사실상 0으로 만듦 (취소 X, 0 처리)
where user_id = '<본부장 user_id>'
  and created_at >= current_date;
```

> ⚠️ **주의:** 위 쿼리는 *실제* cost_log를 변조함. 시연 후 reset 또는 별도 *임시 증액* 컬럼 도입 권장.

또는 환경변수 즉시 조정 (Vercel Dashboard → Environment Variables → `NEXT_PUBLIC_DAILY_USD_LIMIT` = 200) → Redeploy 트리거 → 2분 대기. 시연 *전*에 미리 조정해두는 게 안전.

### 권장 사전 조치
시연 *당일* Vercel env에서 `NEXT_PUBLIC_DAILY_USD_LIMIT=200` 설정 (시연 후 50으로 원복).

---

## F-4. 결과 콘텐츠가 너무 짧거나 부적합

### 증상
- 본문이 1-2문단으로 끝
- 학습 목표가 모호
- 슬라이드 수가 3개 이하

### 즉시 대응 (10초)
- "예제로 만든 거라 짧은 케이스가 나왔네요. 이쪽이 더 풍부합니다." → 백업 URL 전환
- 백업 URL은 모두 *본부장 사전 검증 완료* 작업

### 사전 회피
- `docs/demo-script.md`의 *대안 시드* 4개는 모두 검증된 주제 사용
- 시연 24시간 전에 백업 5개 *모두* 사전 생성 완료

---

## F-5. Anthropic API 5xx

### 증상
- "에이전트 작업 중..." 후 빨간 에러
- 에이전트 로그에 `[studio-06] API error 503` 등

### 즉시 대응
- 백업 URL #1로 즉시 전환 (콘텐츠는 이미 DB에 저장된 상태)
- 청중 안내: *"외부 AI 서비스에 일시 이슈가 있는 것 같네요. 미리 만든 결과로 보겠습니다."*

### 사후
- https://status.anthropic.com 확인
- 재시도 시연

---

## F-6. 인증 세션 만료

### 증상
- /studio·/dashboard 접속 시 /login으로 리다이렉트
- 헤더에 이메일 미표시

### 즉시 대응 (15초)
1. 청중 안내: *"보안상 자동 로그아웃됐네요. 다시 들어갑니다."*
2. 비밀번호 입력 (사전 메모 보고) → 로그인
3. 백업 URL #1 직접 진입 (이미 결과 완성된 페이지)

### 사전 회피
- 시연 *직전* (1분 전) 로그인 상태 확인
- "Remember me" 옵션 활용 (현재 Supabase 기본 30일 세션)

---

## F-7. 인터넷 끊김

### 증상
- 모든 요청 timeout
- Chrome "이 사이트에 연결할 수 없음"

### 즉시 대응 (30초)
1. 청중 안내: *"잠시 회선 이슈가 있네요"*
2. 모바일 핫스팟 즉시 활성화
3. 노트북을 핫스팟에 연결
4. 다시 시연 진행

### 사전 준비
- 시연 *전* 모바일 핫스팟 *테스트* (1회 연결 → 페이지 로드 확인 후 끊기)

---

## F-8. Vercel 다운 (사이트 자체 안 열림)

### 증상
- https://ai-studio-drab-nine.vercel.app 접속 자체 실패
- DNS·502·503 에러

### 즉시 대응 (즉시)
- 청중 안내: *"플랫폼 외부 이슈로 라이브 시연이 어려워, 어제 녹화한 영상 보여드리겠습니다."*
- **로컬에 저장된 시연 영상 재생** (사전 녹화 권장)

### 사전 준비
- 시연 *24시간 전* 본부장이 시연 시나리오 풀 흐름 *화면 녹화* (QuickTime / OBS)
- 영상 파일을 노트북 데스크톱에 백업

---

## 황금 룰 (최종 안전망)

> **시연이 *어떤 상황*에서도 멈추면 안 된다.**

다음 자료를 *항상* 노트북에 복수 백업:

1. **백업 URL 5개** (페이지 미리 띄워둔 탭들)
2. **사전 녹화 영상** (3분 데모 흐름)
3. **스크린샷 PDF** (각 화면 캡처 모음)
4. **사업기획안 1페이지 인쇄본** (질문 시 즉시 참조)

청중은 *기술 시연 자체보다 그것이 만들어내는 비즈니스 임팩트*에 더 관심 있음.

---

## [Stack Meta]
- Document: Demo Troubleshooting Runbook
- Linked: `demo-script.md` · `demo-pre-check.md`
- Owner: 본부장
