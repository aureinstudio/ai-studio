import { BUSINESS_INFO } from "@/lib/legal/business-info";

export const metadata = { title: "이용약관 · KEG AI Studio" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:px-10 lg:py-20">
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Legal
      </p>
      <h1 className="mb-2 text-3xl font-semibold text-foreground">이용약관</h1>
      <p className="mb-8 text-xs text-muted-foreground">
        버전 {BUSINESS_INFO.versions.terms_of_service} · 최종 갱신: 2026-05-12
      </p>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
        ⚠️ 본 문서는 베타 단계의 *템플릿*입니다. 정식 출시 전 변호사 검토 필수.
      </div>

      <section className="prose prose-sm prose-invert mt-8 max-w-none space-y-6 text-sm text-foreground/90">
        <H2>제1조 (목적)</H2>
        <p>
          본 약관은 {BUSINESS_INFO.company_name}(이하 "회사")가 제공하는 {BUSINESS_INFO.service_name}
          서비스(이하 "서비스")의 이용 조건·절차·기타 필요한 사항을 규정합니다.
        </p>

        <H2>제2조 (정의)</H2>
        <ul className="list-disc pl-5">
          <li><strong>"베타 서비스"</strong>: 정식 출시 전 시험 운영 단계의 서비스</li>
          <li><strong>"이용자"</strong>: 약관에 동의하고 서비스를 이용하는 회원</li>
          <li><strong>"AI 생성 콘텐츠"</strong>: 회사의 AI 에이전트가 자동 생성한 교재·영상·답변 등</li>
        </ul>

        <H2>제3조 (베타 서비스 성격)</H2>
        <ul className="list-disc pl-5">
          <li>본 서비스는 베타 단계로, 기능·UI·정책이 사전 통지 없이 변경될 수 있습니다.</li>
          <li>회사는 베타 종료를 7일 전 공지하며, 종료 시 데이터 처리는 개인정보처리방침에 따릅니다.</li>
          <li>AI 생성 콘텐츠는 오류·환각이 포함될 수 있으며, 이용자는 중요한 결정 전 강사·전문가 확인을 권장합니다.</li>
        </ul>

        <H2>제4조 (회원가입)</H2>
        <ul className="list-disc pl-5">
          <li>이용자는 회사가 정한 가입 양식에 따라 정확한 정보를 제공해야 합니다.</li>
          <li>약관·개인정보처리방침·베타 참여 동의서에 모두 동의해야 가입 가능합니다.</li>
          <li>허위 정보·타인 정보 도용 시 가입이 제한되거나 계정이 정지될 수 있습니다.</li>
        </ul>

        <H2>제5조 (이용자의 의무)</H2>
        <ul className="list-disc pl-5">
          <li>계정·비밀번호 관리 책임은 이용자에게 있습니다.</li>
          <li>다음 행위는 금지됩니다:
            <ul className="list-circle ml-5 list-disc">
              <li>타인 명의 도용·정보 유출</li>
              <li>AI 시스템 우회·악용 (프롬프트 인젝션·해킹 시도)</li>
              <li>부정행위·시험 답안 유출 시도</li>
              <li>차별·혐오·자해 유발 콘텐츠 생성·유포</li>
              <li>저작권·지식재산권 침해 콘텐츠 입력</li>
              <li>일일 사용 한도 우회 시도</li>
            </ul>
          </li>
        </ul>

        <H2>제6조 (회사의 권리·의무)</H2>
        <ul className="list-disc pl-5">
          <li>회사는 안정적 서비스 제공을 위해 최선을 다하나, 베타 단계로 100% 가용성을 보장하지 않습니다.</li>
          <li>이용자가 약관을 위반한 경우 사전 통지 없이 서비스 이용을 제한할 수 있습니다.</li>
          <li>AI 생성 콘텐츠의 정확성·완전성을 보증하지 않으며, 안전 게이트(#08 환각 검증)로 위험을 최소화합니다.</li>
        </ul>

        <H2>제7조 (지식재산권)</H2>
        <ul className="list-disc pl-5">
          <li>이용자가 입력한 내용에 대한 권리는 이용자에게 있습니다.</li>
          <li>AI 생성 콘텐츠의 활용 권한은 이용자에게 부여되며, 회사는 서비스 개선 목적으로 익명화된 형태로 활용할 수 있습니다.</li>
          <li>회사의 시스템·디자인·로고에 대한 권리는 회사에 귀속됩니다.</li>
        </ul>

        <H2>제8조 (면책 조항)</H2>
        <ul className="list-disc pl-5">
          <li>천재지변·전쟁·외부 서비스(Anthropic·HeyGen 등) 장애로 인한 서비스 중단 시 회사의 책임은 제한됩니다.</li>
          <li>AI 생성 콘텐츠에 따른 학습·시험·의사결정 결과에 대해 회사는 보증·책임지지 않습니다.</li>
          <li>이용자 간 분쟁에 대해 회사는 개입하지 않으며, 관련 분쟁은 당사자가 해결합니다.</li>
        </ul>

        <H2>제9조 (분쟁 해결)</H2>
        <p>
          본 약관에 관한 분쟁은 대한민국 법률을 준거법으로 하며,
          관할 법원은 회사의 본점 소재지 법원으로 합니다 (단, 소비자보호법 등 강행 규정 우선).
        </p>

        <H2>제10조 (약관 변경)</H2>
        <p>
          회사는 약관을 변경할 수 있으며, 변경 시 시행일 7일 전 공지합니다 (이용자에게 불리한 변경은 30일 전).
          이용자가 변경 후 서비스를 계속 이용하면 동의한 것으로 봅니다.
        </p>

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
