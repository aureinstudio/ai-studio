import { BUSINESS_INFO } from "@/lib/legal/business-info";

export const metadata = { title: "베타 참여 동의서 · KEG AI Studio" };

export default function BetaConsentPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:px-10 lg:py-20">
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Legal · Beta
      </p>
      <h1 className="mb-2 text-3xl font-semibold text-foreground">베타 참여 동의서</h1>
      <p className="mb-8 text-xs text-muted-foreground">
        버전 {BUSINESS_INFO.versions.beta_consent} · 최종 갱신: 2026-05-12
      </p>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
        ⚠️ 본 문서는 베타 단계의 *템플릿*입니다. 정식 출시 전 변호사 검토 필수.
      </div>

      <section className="prose prose-sm prose-invert mt-8 max-w-none space-y-6 text-sm text-foreground/90">
        <p>
          KEG AI Studio 베타 서비스에 참여해 주셔서 감사합니다. 베타 참여 전 아래 사항을 확인하고 동의해 주세요.
        </p>

        <H2>1. 베타 서비스의 성격</H2>
        <ul className="list-disc pl-5">
          <li>본 서비스는 정식 출시 전 시험 운영 단계입니다.</li>
          <li>기능·UI·정책이 사전 통지 없이 변경될 수 있습니다.</li>
          <li>오류·환각·시스템 중단 등이 발생할 수 있음을 인지합니다.</li>
        </ul>

        <H2>2. 학습 데이터 수집·분석 동의</H2>
        <ul className="list-disc pl-5">
          <li>이용자가 입력한 학습 활동(질문·대화·작업 기록)을 회사가 수집·분석합니다.</li>
          <li>수집 목적: 이해도 진단, 학습 권장, 안전·이탈 감지, 서비스 품질 개선.</li>
          <li>분석 결과는 이용자 본인의 학습 지원에 사용되며, /dashboard/learning에서 확인 가능합니다.</li>
        </ul>

        <H2>3. AI 응답 품질 개선용 대화 활용 동의</H2>
        <ul className="list-disc pl-5">
          <li>이용자 대화 일부는 *익명화*된 형태로 AI 시스템 개선에 활용될 수 있습니다.</li>
          <li>개인 식별 정보(이름·이메일 등)는 제거됩니다.</li>
          <li>활용 거부 시 일부 개인화 기능이 제한될 수 있습니다.</li>
        </ul>

        <H2>4. 베타 종료 시 데이터 처리</H2>
        <ul className="list-disc pl-5">
          <li>베타 종료 7일 전 공지합니다.</li>
          <li>종료 후 데이터 처리 옵션:
            <ul className="list-circle ml-5 list-disc">
              <li>정식 서비스 마이그레이션 (선택 동의 시)</li>
              <li>완전 삭제 (요청 시)</li>
              <li>익명화 후 연구·통계 활용 (별도 동의 시)</li>
            </ul>
          </li>
          <li>기본 6개월 후 자동 삭제됩니다.</li>
        </ul>

        <H2>5. 시스템 한계 인지</H2>
        <ul className="list-disc pl-5">
          <li>AI 응답은 사실 오류·환각이 발생할 수 있습니다.</li>
          <li>회사는 #08 환각 검증 게이트로 위험을 최소화하나, 100% 정확성을 보장하지 않습니다.</li>
          <li>시험·법령·의료 등 고위험 정보는 반드시 강사·전문가에게 추가 확인하시기 바랍니다.</li>
          <li>학습 결과·시험 합격에 대한 보증은 없습니다.</li>
        </ul>

        <H2>6. 비용 가드레일 안내</H2>
        <ul className="list-disc pl-5">
          <li>베타 단계에서는 사용량에 따라 비용이 발생할 수 있으며, 회사가 일정 한도 내에서 지원합니다.</li>
          <li>일일 사용 한도가 적용됩니다 (Studio · Cast · Tutor 별).</li>
          <li>본부장 승인 없이 제한 우회 시도 시 계정이 제한될 수 있습니다.</li>
        </ul>

        <H2>7. 안전·웰빙 모니터링</H2>
        <ul className="list-disc pl-5">
          <li>회사는 학생 안전(자해·차별·부정행위)을 위해 자동 모니터링(#09)을 운영합니다.</li>
          <li>위험 신호 감지 시 강사·관리자가 개입할 수 있습니다.</li>
          <li>본인 안전과 직결된 콘텐츠는 외부 전문 상담(자살예방상담전화 1393 등)을 연계합니다.</li>
        </ul>

        <H2>8. 연락처</H2>
        <p>
          베타 관련 문의: {BUSINESS_INFO.privacy_officer.contact_email}<br />
          긴급 상황: {BUSINESS_INFO.phone}
        </p>

        <p className="mt-8 text-xs text-muted-foreground">
          본 동의서는 회원가입 시 별도 동의 절차로 확인됩니다. 동의 기록은 consent_log 테이블에 저장됩니다.
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
