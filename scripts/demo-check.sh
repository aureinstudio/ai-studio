#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# scripts/demo-check.sh — CEO 시연 직전 자동 점검
# 사용: bash scripts/demo-check.sh
# 종료 코드: 0 = ready · 1 = 1개 이상 실패
# ─────────────────────────────────────────────────────────

set -uo pipefail

LIVE_URL="${LIVE_URL:-https://ai-studio-drab-nine.vercel.app}"
PASSED=0
FAILED=0

# 색상 (Windows Git Bash 호환)
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

check() {
  local label="$1"
  local cmd="$2"
  local expected="$3"
  local actual

  actual=$(eval "$cmd" 2>/dev/null) || actual=""

  if [[ "$actual" == *"$expected"* ]]; then
    echo -e "  ${GREEN}✓${NC} $label"
    PASSED=$((PASSED + 1))
  else
    echo -e "  ${RED}✗${NC} $label (expected: $expected, got: $actual)"
    FAILED=$((FAILED + 1))
  fi
}

echo "═══════════════════════════════════════════════════════════"
echo "ai-studio CEO 시연 사전 점검"
echo "URL: $LIVE_URL"
echo "$(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1. 라이브 라우팅 (HTTPS + 응답 코드)
echo "▸ 라이브 라우팅"
check "/ (랜딩) → 200" \
  "curl -s -o /dev/null -w '%{http_code}' '$LIVE_URL/'" \
  "200"

check "/login (공개) → 200" \
  "curl -s -o /dev/null -w '%{http_code}' '$LIVE_URL/login'" \
  "200"

check "/studio (보호) → 307" \
  "curl -s -o /dev/null -w '%{http_code}' '$LIVE_URL/studio'" \
  "307"

check "/dashboard (보호) → 307" \
  "curl -s -o /dev/null -w '%{http_code}' '$LIVE_URL/dashboard'" \
  "307"

check "/dashboard/history (보호) → 307" \
  "curl -s -o /dev/null -w '%{http_code}' '$LIVE_URL/dashboard/history'" \
  "307"

echo ""

# 2. API 라우트 (인증 가드)
echo "▸ API 인증 가드"
check "POST /api/studio/generate (미인증) → 401" \
  "curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' '$LIVE_URL/api/studio/generate'" \
  "401"

check "GET /api/studio/jobs (미인증) → 401" \
  "curl -s -o /dev/null -w '%{http_code}' '$LIVE_URL/api/studio/jobs'" \
  "401"

check "DELETE /api/studio/jobs/x (미인증) → 401" \
  "curl -s -o /dev/null -w '%{http_code}' -X DELETE '$LIVE_URL/api/studio/jobs/00000000-0000-0000-0000-000000000000'" \
  "401"

echo ""

# 3. /health Supabase 연결
echo "▸ Supabase 연결"
HEALTH_HTML=$(curl -s "$LIVE_URL/health" 2>/dev/null || echo "")

if [[ "$HEALTH_HTML" == *'">OK<'* ]]; then
  echo -e "  ${GREEN}✓${NC} /health Supabase OK"
  PASSED=$((PASSED + 1))
else
  echo -e "  ${RED}✗${NC} /health Supabase 응답 비정상"
  FAILED=$((FAILED + 1))
fi

# Supabase RTT 추출 (ms 숫자)
RTT=$(echo "$HEALTH_HTML" | grep -oE 'tabular-nums[^>]*>[0-9]+' | grep -oE '[0-9]+' | head -1)
if [[ -n "$RTT" ]]; then
  if [[ "$RTT" -lt 2000 ]]; then
    echo -e "  ${GREEN}✓${NC} Supabase RTT ${RTT}ms (≤ 2000ms 정상)"
    PASSED=$((PASSED + 1))
  else
    echo -e "  ${YELLOW}⚠${NC} Supabase RTT ${RTT}ms (느림 — cold start 가능성)"
    FAILED=$((FAILED + 1))
  fi
fi

echo ""

# 4. 콜드 스타트 워밍 — 5개 페이지 GET (응답 시간 측정)
echo "▸ 콜드 스타트 워밍"
for path in "/" "/studio" "/dashboard" "/dashboard/history" "/health"; do
  total=$(curl -s -o /dev/null -w '%{time_total}' "$LIVE_URL$path" 2>/dev/null || echo "0")
  ms=$(echo "$total * 1000" | awk '{printf "%.0f", $1}')
  if [[ "$ms" -lt 5000 ]]; then
    echo -e "  ${GREEN}✓${NC} $path ${ms}ms"
    PASSED=$((PASSED + 1))
  else
    echo -e "  ${YELLOW}⚠${NC} $path ${ms}ms (느림)"
    FAILED=$((FAILED + 1))
  fi
done

echo ""

# 5. 수동 확인 안내 (자동 측정 불가 항목)
echo "▸ 수동 확인 필요 (체크박스로 직접 확인)"
echo "  [ ] Anthropic API 잔액 ≥ \$20 → https://console.anthropic.com/settings/billing"
echo "  [ ] 본부장 계정 로그인 상태 (브라우저 헤더에 이메일 표시)"
echo "  [ ] 백업 URL 5개 노출 점검 (docs/demo-script.md)"
echo "  [ ] 모바일 핫스팟 백업 가능 상태"
echo "  [ ] 사전 녹화 영상 데스크톱 백업"

echo ""
echo "═══════════════════════════════════════════════════════════"

if [[ "$FAILED" -eq 0 ]]; then
  echo -e "${GREEN}✅ READY FOR DEMO${NC} ($PASSED checks passed)"
  exit 0
else
  echo -e "${RED}❌ NOT READY${NC} ($PASSED passed, $FAILED failed)"
  echo "위 ✗ 항목 해결 후 재실행 권장."
  echo "장애 대응: docs/demo-troubleshooting.md"
  exit 1
fi
