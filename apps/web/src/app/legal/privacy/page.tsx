import { BUSINESS_INFO } from "@/lib/legal/business-info";

export const metadata = { title: "개인정보처리방침 · KEG AI Studio" };

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:px-10 lg:py-20">
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Legal
      </p>
      <h1 className="mb-2 text-3xl font-semibold text-foreground">개인정보처리방침</h1>
      <p className="mb-8 text-xs text-muted-foreground">
        버전 {BUSINESS_INFO.versions.privacy_policy} · 최종 갱신: 2026-05-12
      </p>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
        ⚠️ 본 문서는 베타 단계의 *템플릿*입니다. 정식 출시 전 변호사 검토 필수.
      </div>

      <section className="prose prose-sm prose-invert mt-8 max-w-none space-y-6 text-sm text-foreground/90">
        <p>
          {BUSINESS_INFO.company_name}(이하 "회사")는 KEG AI Studio 서비스(이하 "서비스") 이용자의 개인정보를
          중요시하며, 「개인정보 보호법」을 준수합니다.
        </p>

        <H2>1. 수집하는 개인정보 항목</H2>
        <p><strong>필수:</strong> 이메일, 이름, 학습 활동 기록 (Studio·Cast·Tutor 사용 이력), 대화 로그</p>
        <p><strong>선택:</strong> 휴대폰 번호, 학습 목표, 마케팅 수신 동의 여부</p>
        <p><strong>자동 수집:</strong> IP 주소, 브라우저·OS 정보, 접속 일시, 쿠키</p>

        <H2>2. 수집 목적</H2>
        <ul className="list-disc pl-5">
          <li>베타 서비스 제공 (콘텐츠 생성·영상 변환·Tutor 응답)</li>
          <li>학습 진도·이해도 분석 및 개인화 피드백</li>
          <li>AI 응답 품질 개선 (대화 분석)</li>
          <li>시스템 안전·보안 (환각·부정행위 감지)</li>
          <li>법령상 의무 이행</li>
        </ul>

        <H2>3. 보유·이용 기간</H2>
        <p>
          베타 종료 후 6개월간 보관 후 안전하게 파기합니다. 단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 보관합니다.
        </p>
        <ul className="list-disc pl-5">
          <li>회원 정보: 탈퇴 후 30일 이내 파기 (소비자 분쟁 해결 등 법령상 보존 의무 제외)</li>
          <li>학습 활동 기록: 베타 종료 후 6개월</li>
          <li>cost_log·결제 기록: 5년 (전자상거래법)</li>
          <li>접속 로그: 3개월 (통신비밀보호법)</li>
        </ul>

        <H2>4. 제3자 제공</H2>
        <p>회사는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 단, 아래 서비스 제공을 위해 일부 정보가 위탁 처리됩니다.</p>

        <H2>5. 처리 위탁 (Sub-processors)</H2>
        <table className="w-full text-xs">
          <thead className="border-b border-border">
            <tr><th className="py-2 text-left">위탁 업체</th><th className="text-left">목적</th><th className="text-left">위치</th></tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            <tr><td className="py-2">Vercel (USA)</td><td>웹 호스팅·CDN</td><td>글로벌</td></tr>
            <tr><td className="py-2">Supabase (USA)</td><td>데이터베이스·인증·Storage</td><td>서울 리전</td></tr>
            <tr><td className="py-2">Anthropic (USA)</td><td>LLM 처리 (Claude)</td><td>USA</td></tr>
            <tr><td className="py-2">Google (USA)</td><td>이미지 생성·임베딩 (Gemini)</td><td>USA</td></tr>
            <tr><td className="py-2">HeyGen (USA)</td><td>아바타 영상 생성</td><td>USA</td></tr>
            <tr><td className="py-2">ElevenLabs (USA)</td><td>TTS 음성 합성 (선택 사용)</td><td>USA</td></tr>
          </tbody>
        </table>

        <H2>6. 정보주체의 권리·행사</H2>
        <p>이용자는 언제든 다음 권리를 행사할 수 있습니다.</p>
        <ul className="list-disc pl-5">
          <li>개인정보 열람 요청</li>
          <li>오류 정정 요청</li>
          <li>삭제 요청 (계정 탈퇴)</li>
          <li>처리 정지 요청</li>
        </ul>
        <p>
          행사 방법: <a href="/legal/data-rights" className="text-foreground underline">/legal/data-rights</a> 페이지 또는{" "}
          {BUSINESS_INFO.privacy_officer.contact_email}로 요청
        </p>

        <H2>7. 개인정보 보호책임자</H2>
        <p>
          <strong>{BUSINESS_INFO.privacy_officer.name}</strong><br />
          이메일: {BUSINESS_INFO.privacy_officer.contact_email}<br />
          전화: {BUSINESS_INFO.privacy_officer.phone}
        </p>

        <H2>8. 쿠키 사용</H2>
        <p>
          본 서비스는 인증 세션 유지·사용자 식별을 위해 쿠키를 사용합니다.
          분석·광고 쿠키는 사용하지 않습니다. 쿠키 사용을 거부하면 일부 기능이 제한될 수 있습니다.
        </p>

        <H2>9. 변경 시 고지</H2>
        <p>방침 변경 시 시행 7일 전 공지 (중요한 변경은 30일 전).</p>

        <p className="mt-8 text-xs text-muted-foreground">
          시행일: 2026-05-12
        </p>
      </section>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-6 border-b border-border/40 pb-2 text-base font-semibold text-foreground">
      {children}
    </h2>
  );
}
