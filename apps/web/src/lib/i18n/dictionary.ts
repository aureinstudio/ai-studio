/**
 * 간이 i18n 사전 — 외부 의존성 없이 핵심 문자열만 다국어화.
 *
 * 본격 도입은 next-intl로 교체 (npm install next-intl 후 messages/{locale}.json).
 * 이번 스캐폴딩은 운영 검증 목적.
 */

export type Locale = "ko" | "en" | "vi" | "ja" | "id" | "th";

export const LOCALES: { code: Locale; label: string; native: string }[] = [
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "en", label: "English", native: "English" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "id", label: "Indonesian", native: "Bahasa Indonesia" },
  { code: "th", label: "Thai", native: "ภาษาไทย" },
];

export const DICTIONARY: Record<Locale, Record<string, string>> = {
  ko: {
    "nav.dashboard": "대시보드",
    "nav.courses": "과정",
    "nav.studio": "Studio",
    "nav.cast": "Cast",
    "nav.tutor": "Tutor",
    "nav.history": "내 작업",
    "auth.login": "로그인",
    "auth.logout": "로그아웃",
    "auth.signup": "회원가입",
    "pricing.title": "요금제",
    "pricing.monthly": "월 구독",
    "pricing.yearly": "연 구독",
    "cert.title": "수료증",
    "cert.completion": "아래 과정을 성공적으로 이수하였습니다",
  },
  en: {
    "nav.dashboard": "Dashboard",
    "nav.courses": "Courses",
    "nav.studio": "Studio",
    "nav.cast": "Cast",
    "nav.tutor": "Tutor",
    "nav.history": "My Work",
    "auth.login": "Sign In",
    "auth.logout": "Sign Out",
    "auth.signup": "Sign Up",
    "pricing.title": "Pricing",
    "pricing.monthly": "Monthly",
    "pricing.yearly": "Yearly",
    "cert.title": "Certificate of Completion",
    "cert.completion": "This certifies the successful completion of",
  },
  vi: {
    "nav.dashboard": "Bảng điều khiển",
    "nav.courses": "Khóa học",
    "nav.studio": "Studio",
    "nav.cast": "Cast",
    "nav.tutor": "Gia sư AI",
    "nav.history": "Bài làm",
    "auth.login": "Đăng nhập",
    "auth.logout": "Đăng xuất",
    "auth.signup": "Đăng ký",
    "pricing.title": "Giá",
    "pricing.monthly": "Hàng tháng",
    "pricing.yearly": "Hàng năm",
    "cert.title": "Chứng chỉ hoàn thành",
    "cert.completion": "Đã hoàn thành thành công khóa học",
  },
  ja: {
    "nav.dashboard": "ダッシュボード",
    "nav.courses": "コース",
    "nav.studio": "Studio",
    "nav.cast": "Cast",
    "nav.tutor": "Tutor",
    "nav.history": "マイワーク",
    "auth.login": "ログイン",
    "auth.logout": "ログアウト",
    "auth.signup": "新規登録",
    "pricing.title": "料金",
    "pricing.monthly": "月額",
    "pricing.yearly": "年額",
    "cert.title": "修了証",
    "cert.completion": "下記のコースを修了されたことを証明します",
  },
  id: {
    "nav.dashboard": "Dasbor",
    "nav.courses": "Kursus",
    "nav.studio": "Studio",
    "nav.cast": "Cast",
    "nav.tutor": "Tutor AI",
    "nav.history": "Pekerjaan Saya",
    "auth.login": "Masuk",
    "auth.logout": "Keluar",
    "auth.signup": "Daftar",
    "pricing.title": "Harga",
    "pricing.monthly": "Bulanan",
    "pricing.yearly": "Tahunan",
    "cert.title": "Sertifikat Penyelesaian",
    "cert.completion": "Berhasil menyelesaikan kursus berikut",
  },
  th: {
    "nav.dashboard": "แดชบอร์ด",
    "nav.courses": "หลักสูตร",
    "nav.studio": "Studio",
    "nav.cast": "Cast",
    "nav.tutor": "Tutor AI",
    "nav.history": "งานของฉัน",
    "auth.login": "เข้าสู่ระบบ",
    "auth.logout": "ออกจากระบบ",
    "auth.signup": "สมัครสมาชิก",
    "pricing.title": "ราคา",
    "pricing.monthly": "รายเดือน",
    "pricing.yearly": "รายปี",
    "cert.title": "ใบประกาศนียบัตร",
    "cert.completion": "สำเร็จการศึกษาในหลักสูตรต่อไปนี้",
  },
};

export function t(locale: Locale, key: string): string {
  return DICTIONARY[locale]?.[key] ?? DICTIONARY.ko[key] ?? key;
}

/**
 * Accept-Language 헤더에서 우선 언어 결정.
 */
export function detectLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return "ko";
  const codes = acceptLanguage.toLowerCase().split(",").map((p) => p.split(";")[0].trim());
  for (const code of codes) {
    const short = code.split("-")[0];
    if (short === "ko") return "ko";
    if (short === "en") return "en";
    if (short === "vi") return "vi";
    if (short === "ja") return "ja";
    if (short === "id") return "id";
    if (short === "th") return "th";
  }
  return "ko";
}
