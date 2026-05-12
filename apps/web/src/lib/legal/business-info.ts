/**
 * KEG 사업자 정보 — Footer·약관·법적 페이지에서 사용하는 단일 진실 소스.
 *
 * ⚠️ 본부장이 실제 값으로 교체 필요:
 *   - 대표자명, 사업자등록번호, 주소, 전화, 통신판매업 신고번호 등.
 *   - 현재는 placeholder. Production 전 반드시 갱신.
 */

export const BUSINESS_INFO = {
  // 기본 정보
  company_name: "KEG · Korean Education Group",
  representative: "김영우", // ⚠️ 본부장이 입력
  business_registration_number: "214-87-88737", // ⚠️ 본부장이 입력
  online_business_number: "[제2026-서울XX-XXXX호]", // ⚠️ 통신판매업 신고번호 (해당 시)

  // 주소·연락처
  address: "서울특별시 강남구 도곡동 946번지 부영빌딩 4층", // ⚠️ 본부장이 입력
  phone: "02-3471-0531", // ⚠️ 본부장이 입력
  email: "keg@koreaedugroup.com",

  // 개인정보 보호책임자
  privacy_officer: {
    name: "김영우",
    contact_email: "keg@koreaedugroup.com",
    phone: "02-3471-0531",
  },

  // 서비스 정보
  service_name: "KEG AI Studio (베타)",
  service_url: "https://ai-studio-drab-nine.vercel.app", // 도메인 연결 시 갱신
  status: "베타 서비스 — 정식 출시 전",

  // 법적 문서 버전 (변경 시 갱신, consent_log에 기록됨)
  versions: {
    terms_of_service: "2026-05-12-v1",
    privacy_policy: "2026-05-12-v1",
    beta_consent: "2026-05-12-v1",
  },
} as const;
