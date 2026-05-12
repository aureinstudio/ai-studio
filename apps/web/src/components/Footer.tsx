import Link from "next/link";
import { BUSINESS_INFO } from "@/lib/legal/business-info";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border/40 bg-card/30">
      <div className="mx-auto max-w-7xl space-y-5 px-6 py-8 text-xs text-muted-foreground lg:px-10">
        {/* 법적 링크 */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/legal/privacy" className="hover:text-foreground">
            개인정보처리방침
          </Link>
          <Link href="/legal/terms" className="hover:text-foreground">
            이용약관
          </Link>
          <Link href="/legal/beta-consent" className="hover:text-foreground">
            베타 참여 동의서
          </Link>
          <Link href="/legal/data-rights" className="hover:text-foreground">
            데이터 권리
          </Link>
          <Link href="/support" className="hover:text-foreground">
            문의하기
          </Link>
          <Link href="/beta" className="hover:text-foreground">
            베타 모집
          </Link>
        </div>

        {/* 사업자 정보 */}
        <div className="space-y-1 text-[11px] leading-relaxed">
          <p>
            <strong className="text-foreground">{BUSINESS_INFO.company_name}</strong>
            <span className="opacity-60">
              {" "}
              · 대표: {BUSINESS_INFO.representative} · 사업자등록번호:{" "}
              {BUSINESS_INFO.business_registration_number}
            </span>
          </p>
          <p className="opacity-60">
            주소: {BUSINESS_INFO.address} · 전화: {BUSINESS_INFO.phone} · 이메일:{" "}
            {BUSINESS_INFO.email}
          </p>
          <p className="opacity-60">
            통신판매업 신고: {BUSINESS_INFO.online_business_number} · 개인정보 보호책임자:{" "}
            {BUSINESS_INFO.privacy_officer.name} (
            {BUSINESS_INFO.privacy_officer.contact_email})
          </p>
        </div>

        {/* 서비스 상태 + 출처 */}
        <div className="flex flex-col items-start justify-between gap-2 border-t border-border/40 pt-4 sm:flex-row sm:items-center">
          <p className="tracking-wider">
            Powered by{" "}
            <span className="font-medium text-foreground">Aurein AX</span>{" "}
            <span className="opacity-50">×</span>{" "}
            <span className="font-medium text-foreground">KEG</span>
          </p>
          <p className="text-[10px] opacity-60">
            {BUSINESS_INFO.service_name} · {BUSINESS_INFO.status}
          </p>
        </div>
      </div>
    </footer>
  );
}
