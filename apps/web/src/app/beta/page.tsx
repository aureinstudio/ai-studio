import BetaApplyForm from "./apply-form";

export const dynamic = "force-static";

export const metadata = {
  title: "베타 모집 — KEG AI Studio",
  description: "자격증 학습을 AI 튜터와 함께. 4주 베타 참여자 모집.",
};

export default function BetaLandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative py-20 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-block px-3 py-1 mb-6 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
            베타 4주 · 정원 50명 한정
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            ai-studio 베타에 참여하세요
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            KEG 자격증 학습을 AI 튜터와 함께. 24/7 1:1 답변, 다국어 지원,<br />
            맞춤 학습 콘텐츠 — 정식 출시 전 무료 체험.
          </p>
          <a
            href="#apply"
            className="inline-block mt-8 px-8 py-3 rounded-lg bg-foreground text-background font-semibold hover:opacity-90"
          >
            지금 신청하기 →
          </a>
        </div>
      </section>

      {/* 혜택 3개 */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">베타 참여 혜택</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "학습 콘텐츠 무료",
                body: "자격증 과정 1개 무료 + 정식 서비스 50% 할인 쿠폰",
              },
              {
                title: "AI 튜터 24/7",
                body: "1:1 답변, 다국어(한·영·중·베·인니), 출처 표시로 신뢰 학습",
              },
              {
                title: "우선 액세스",
                body: "베타 종료 시 정식 서비스 우선 액세스 + 신규 기능 사전 체험",
              },
            ].map((c, i) => (
              <div key={i} className="bg-background rounded-lg p-6 border">
                <div className="text-sm font-semibold text-blue-600 mb-2">#{i + 1}</div>
                <h3 className="text-lg font-bold mb-2">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 자격 요건 */}
      <section className="py-16 px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold mb-6">참여 자격</h2>
          <ul className="space-y-3 text-sm">
            {[
              "KEG 자격증 과정에 1개월 이내 등록(또는 등록 예정)인 학습자",
              "베타 종료(4주)까지 주 3회 이상 학습 참여 가능",
              "베타 약관 및 개인정보 처리방침 동의 가능자",
              "피드백 설문(주 1회, 5분 이내) 참여 의향이 있는 분",
            ].map((line, i) => (
              <li key={i} className="flex items-start">
                <span className="mr-3 mt-1 text-emerald-600">✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 신청 폼 */}
      <section id="apply" className="py-16 px-6 bg-muted/30 border-t">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold mb-2">신청서 작성</h2>
          <p className="text-sm text-muted-foreground mb-8">
            제출 후 본부장 검토를 거쳐 2영업일 내 결과 안내드립니다.
          </p>
          <BetaApplyForm />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold mb-6">자주 묻는 질문</h2>
          <div className="space-y-6">
            {[
              {
                q: "베타 기간 비용은 정말 없나요?",
                a: "네. 4주 베타 기간 동안 학습 콘텐츠와 AI 튜터 이용 일체 무료입니다. 정식 서비스 전환 시점에 사전 안내드리며, 동의 시에만 유료 전환됩니다.",
              },
              {
                q: "AI 튜터 답변은 정확한가요?",
                a: "교재(과정 콘텐츠)를 출처로 한 응답만 제공합니다. 출처가 불충분하면 답변을 거부하고 강사 문의를 권장합니다(환각 차단). 그래도 오류 가능성은 있으므로, 시험 직전 핵심 개념은 강사·교재로 한 번 더 확인해 주세요.",
              },
              {
                q: "데이터는 어떻게 관리되나요?",
                a: "Supabase Seoul 리전 저장 + 개인정보 처리방침 준수. 베타 종료 후 30일 내 계정·데이터 삭제 가능합니다.",
              },
              {
                q: "선발 기준은?",
                a: "자격증 과정 등록 여부 + 베타 기간 참여 가능성을 종합 검토합니다. 정원 50명 충원 시 마감됩니다.",
              },
            ].map((f, i) => (
              <details key={i} className="border-b pb-4">
                <summary className="font-semibold cursor-pointer">{f.q}</summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6 text-center text-xs text-muted-foreground">
        <p>KEG AI Studio 베타 · 모집 마감 시 사전 공지 · 문의 support@keg.com</p>
        <p className="mt-2">
          <a href="/legal/terms" className="hover:underline">이용약관</a>
          <span className="mx-2">·</span>
          <a href="/legal/privacy" className="hover:underline">개인정보처리방침</a>
          <span className="mx-2">·</span>
          <a href="/legal/beta-consent" className="hover:underline">베타 동의서</a>
        </p>
      </footer>
    </div>
  );
}
