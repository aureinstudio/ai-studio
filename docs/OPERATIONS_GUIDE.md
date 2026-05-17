# ai-studio 운영 가이드

본부장이 직접 처리해야 하는 외부 작업 정리. dev 작업은 모두 완료 (v2.2.0 기준).

## 1. 환경 변수 설정 (Vercel)

`vercel.com/aureinstudio/ai-studio/settings/environment-variables`에서 추가:

### 필수 (이미 설정됨)
- `ANTHROPIC_API_KEY` ✓
- `HEYGEN_API_KEY` ✓
- `GEMINI_API_KEY` ✓
- `NEXT_PUBLIC_SUPABASE_URL` ✓
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✓
- `SUPABASE_SECRET_KEY` ✓

### v2.1 추가 필요
| 변수 | 값 | 발급 방법 |
|---|---|---|
| `RESEND_API_KEY` | `re_...` | https://resend.com/api-keys 가입 → API Key 생성 |
| `RESEND_FROM_EMAIL` | `ai-studio <noreply@ai-studio.kr>` | 도메인 인증 후 (Resend Domains 메뉴) |
| `STRIPE_SECRET_KEY` | `sk_live_...` | https://dashboard.stripe.com/apikeys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe Webhooks 메뉴에서 endpoint 추가 후 발급 |
| `STRIPE_PRICE_B2C_MONTHLY` | `price_...` | Stripe Products에서 가격 생성 (₩49,000/월) |
| `STRIPE_PRICE_B2C_YEARLY` | `price_...` | (₩490,000/년) |
| `STRIPE_PRICE_B2B_STARTER` | `price_...` | (₩500,000/월) |
| `STRIPE_PRICE_B2B_PRO` | `price_...` | (₩2,000,000/월) |

### Stripe Webhook 등록
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://ai-studio.kr/api/payments/webhook`
3. 이벤트: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
4. 발급된 signing secret을 `STRIPE_WEBHOOK_SECRET`에 입력

## 2. 도메인 연결 (ai-studio.kr)

### A. 메인 도메인
1. 도메인 등록 (가비아·후이즈 등)
2. Vercel Project → Settings → Domains → Add → `ai-studio.kr`
3. Vercel이 안내하는 A 레코드 또는 CNAME을 도메인 등록기관 DNS에 추가
4. SSL 자동 발급 (Let's Encrypt — 5분 내)

### B. 서브도메인 라우팅 (B2B 멀티 테넌트)
1. Vercel Project → Settings → Domains → Add → `*.ai-studio.kr` (wildcard)
2. DNS에 wildcard A 레코드 추가:
   ```
   * IN A <Vercel IP>
   ```
3. 또는 wildcard CNAME:
   ```
   * IN CNAME cname.vercel-dns.com.
   ```
4. 적용 후 `acme.ai-studio.kr`, `keg.ai-studio.kr` 등 자동 동작
5. 코드에서는 `proxy.ts`의 `extractTenantSlug` 함수가 자동 인식

### C. Resend 도메인 인증
1. Resend Dashboard → Domains → Add Domain → `ai-studio.kr`
2. 제공된 SPF + DKIM + DMARC TXT 레코드를 DNS에 추가
3. 인증 완료 시 `noreply@ai-studio.kr`로 발송 가능

## 3. SDK 배포

### npm (TypeScript SDK)
```bash
cd packages/sdk-js
npm install
npm run build
npm login                    # npm 계정 필요
npm publish --access public  # 첫 배포만 --access public
```

배포 후 `npm install @ai-studio/sdk`로 누구나 설치 가능.

### PyPI (Python SDK)
```bash
cd packages/sdk-python
pip install build twine
python -m build
twine upload dist/*          # PyPI 계정 필요
```

배포 후 `pip install ai-studio`로 누구나 설치 가능.

## 4. 운영 점검 체크리스트

| 점검 | 주기 | 위치 |
|---|---|---|
| `/api/admin/db-check` | 매 deploy 후 | API 직접 호출 |
| Vercel 비용 | 주간 | Vercel Dashboard |
| Anthropic 비용 | 주간 | console.anthropic.com |
| HeyGen 크레딧 | 주간 | heygen.com |
| Supabase 한도 | 월간 | supabase.com dashboard |
| `/admin/monitoring` | 매일 1회 | 자체 페이지 |
| 학생 NPS | 월 1회 | `/admin/dashboard` |
| `/super-admin/pnl` 입력 | 매월 1일 | 자체 페이지 |

## 5. 비상 대응

| 상황 | 대응 |
|---|---|
| Vercel 배포 실패 | 직전 배포로 rollback (`vercel rollback`) |
| 비용 폭증 | `/admin/monitoring`에서 cost_overrides 추가 |
| 학생 데이터 유출 의심 | `/admin/security` + `/admin/audit-log` |
| HeyGen API 다운 | 영상 작업 일시 중단 + 학생 안내 |
| Anthropic API 다운 | Tutor 일시 중단 + 사과 메일 |

## 6. 백업

| 자원 | 백업 주기 | 위치 |
|---|---|---|
| Supabase DB | 자동 일일 | Supabase Backups |
| Storage 버킷 | 자동 일일 | Supabase Storage |
| GitHub 코드 | 매 push | github.com/aureinstudio/ai-studio |
| 환경 변수 | 수동 | 1Password 등 비밀 저장소에 별도 보관 |

## 7. 연락처

- **기술 문제:** aureinstudio@gmail.com (24시간 내 응답)
- **결제 문의:** Stripe Dashboard → Disputes
- **법무:** 별도 자문 (개인정보·약관)
