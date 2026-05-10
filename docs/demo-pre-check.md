# 시연 사전 점검 체크리스트

> **사용:** 시연 *시작 30분 전* 1회 풀 점검 + *5분 전* 워밍업 1회.
> **원칙:** 모든 항목 ✅ 후에만 시연 진행. 1개라도 ❌면 즉시 대응 또는 시연 연기.

---

## 30분 전 — 풀 점검 (10분 소요)

### 1. 라이브 URL 정상

- [ ] https://ai-studio-drab-nine.vercel.app HTTPS 정상 (자물쇠 아이콘)
- [ ] 메인 페이지 로딩 < 3초
- [ ] 헤더·로고·메뉴 정상 표시

### 2. Anthropic API 잔액

- [ ] https://console.anthropic.com/settings/billing 접속
- [ ] **잔액 ≥ $20 USD** (시연 1회 + 백업 + 안전 마진)
- [ ] 일일 한도 (있다면) ≥ $5

### 3. Supabase 정상

- [ ] https://supabase.com/dashboard/project/mmbgylpnsajtaeymutgj 접속
- [ ] 프로젝트 status: **Active**
- [ ] Storage 사용량 < 80%
- [ ] 최근 24시간 무중단 (Logs → Postgres에서 에러 다발 없음)

### 4. Vercel 배포

- [ ] https://vercel.com/aureinstudios-projects/ai-studio/deployments
- [ ] 최신 배포 status: **Ready**
- [ ] 최근 24시간 빌드 실패 0건

### 5. 본부장 계정 로그인

- [ ] /login에서 본부장 계정 (`polo2108@koreaedugroup.com`) 로그인
- [ ] /dashboard 진입 시 통계·최근 작업 정상
- [ ] 헤더 우상단 이메일 표시
- [ ] **세션 만료 시간 ≥ 24시간** (Supabase Auth → Sessions)

### 6. 백업 URL 5개 노출 점검

- [ ] [docs/demo-script.md](demo-script.md) 백업 URL 5개 *모두 클릭 가능*
- [ ] 각 URL에서 본문·슬라이드·로그 탭 정상 표시
- [ ] *주제·결과가 의도한대로* (사전 검증된 좋은 결과)

### 7. 자동 점검 스크립트

```bash
bash scripts/demo-check.sh
```

- [ ] **모든 OK + "READY FOR DEMO" 출력**

---

## 5분 전 — 워밍업 (2분 소요)

### 1. Vercel 콜드 스타트 회피

- [ ] 5개 페이지 사전 로드 (cold start 워밍):
  - https://ai-studio-drab-nine.vercel.app/
  - https://ai-studio-drab-nine.vercel.app/login (로그인 상태면 redirect)
  - https://ai-studio-drab-nine.vercel.app/studio
  - https://ai-studio-drab-nine.vercel.app/dashboard
  - https://ai-studio-drab-nine.vercel.app/dashboard/history
- [ ] 각 페이지 로딩 시간 < 2초

### 2. 인터넷·기기

- [ ] 메인 인터넷 연결 안정 (속도 테스트 ≥ 10Mbps)
- [ ] 모바일 핫스팟 *백업* 활성 가능 상태 (테스트 1회 연결)
- [ ] 노트북 화면 미러링 테스트 — HDMI/AirPlay 1회 연결 끊김 없이
- [ ] 노트북 배터리 ≥ 80% 또는 충전기 연결

### 3. 자료 백업

- [ ] 사전 녹화 영상 데스크톱에 존재 (`demo-recording.mp4`)
- [ ] 백업 URL 5개 *별도 탭으로 미리 열어둠* (시연 중 빠른 전환용)
- [ ] 사업기획안 1페이지 *인쇄본* 또는 *PDF* 데스크톱

### 4. 청중·환경

- [ ] 미팅룸 화면·음향 사전 확인
- [ ] 화면 밝기 ≥ 70% (모노톤 다크 디자인이라 어두우면 안 보임)
- [ ] 노트북 알림 OFF (Slack·이메일 팝업 차단)

---

## 1분 전 — 즉시 점검

- [ ] /studio 페이지 펼쳐둠 (입력 필드 비어있음)
- [ ] 백업 URL 5개 탭 모두 결과 페이지로 미리 진입 (Ctrl+클릭 후 새 탭)
- [ ] 노트북 알림 패널 닫음
- [ ] **심호흡** — 3분 안에 끝나는 데모임

---

## 시연 직후 회고

시연이 *끝나자마자* (청중 떠나기 *전*) 다음 1분 메모:

- [ ] 시연 시간 실측: ___ 초
- [ ] 발생한 장애: 없음 / F-? / 기타
- [ ] CEO 피드백 1줄: _________________
- [ ] 청중 질문 베스트 1개: _________________
- [ ] 다음 액션 1개: _________________

---

## [Stack Meta]
- Document: Demo Pre-check Checklist
- Linked: `demo-script.md` · `demo-troubleshooting.md` · `scripts/demo-check.sh`
- Owner: 본부장
