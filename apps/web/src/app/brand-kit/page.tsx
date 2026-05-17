import Image from "next/image";

export const metadata = { title: "Brand Kit · ai-studio" };

const COLORS = [
  { name: "Foreground", hex: "#0F172A", usage: "기본 텍스트·로고 (라이트 모드)" },
  { name: "Background", hex: "#FFFFFF", usage: "라이트 모드 배경" },
  { name: "Accent (Cyan)", hex: "#22D3EE", usage: "강조 · 액션 버튼 호버" },
  { name: "Amber (Pro)", hex: "#F59E0B", usage: "Studio Pro · 프리미엄 강조" },
  { name: "Emerald", hex: "#10B981", usage: "성공 · 완료 상태" },
  { name: "Red", hex: "#EF4444", usage: "에러 · 위험 상태" },
];

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-12">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">Brand Kit v1.0</span>
        <h1 className="mt-1 text-4xl font-bold">ai-studio Brand Guidelines</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          마케팅·영업·콘텐츠 모든 자료에서 일관되게 사용하는 브랜드 자산.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold">로고</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-8 text-center">
            <Image src="/logo_bk.png" alt="ai-studio logo black" width={200} height={50} className="mx-auto" />
            <div className="mt-4 text-xs text-muted-foreground">라이트 배경 · /logo_bk.png</div>
          </div>
          <div className="rounded-lg border bg-zinc-900 p-8 text-center">
            <Image src="/logo_wh.png" alt="ai-studio logo white" width={200} height={50} className="mx-auto" />
            <div className="mt-4 text-xs text-zinc-400">다크 배경 · /logo_wh.png</div>
          </div>
        </div>
        <ul className="mt-4 ml-4 list-disc text-sm space-y-1">
          <li>최소 너비: 80px · 최대 너비: 480px</li>
          <li>주변 여백: 로고 높이의 50% 이상</li>
          <li>색상 변경·왜곡·회전 금지</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold">컬러 팔레트</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {COLORS.map((c) => (
            <div key={c.hex} className="rounded-lg border bg-card overflow-hidden">
              <div style={{ background: c.hex }} className="h-24" />
              <div className="p-3">
                <div className="font-semibold">{c.name}</div>
                <div className="font-mono text-xs text-muted-foreground">{c.hex}</div>
                <div className="mt-1 text-xs">{c.usage}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold">타이포그래피</h2>
        <div className="space-y-3 rounded-lg border bg-card p-6">
          <div>
            <div className="text-xs text-muted-foreground">Heading · Pretendard SemiBold (700)</div>
            <div style={{ fontWeight: 700 }} className="text-4xl">AI 학습 콘텐츠 자동 생성</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Body · Pretendard Regular (400)</div>
            <div className="text-base">한국어 교육 시장을 위한 AI 콘텐츠 생성·영상 합성·1:1 튜터링 통합 플랫폼.</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Mono · 코드·KPI 수치</div>
            <div className="font-mono text-base">ak_live_xxxxxxxxxxxx · 1,247 students · ₩125.4M</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">한국어 본문은 Pretendard, 영문·숫자도 동일 폰트 사용. 코드/모노스페이스만 별도.</p>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold">톤 & 보이스</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
            <div className="font-semibold text-emerald-900">✓ Do</div>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>구체적 KPI·결과 인용</li>
              <li>한국어 자연스럽고 명료</li>
              <li>전문성 · 신뢰감</li>
              <li>강사·학생을 격상시키는 톤</li>
            </ul>
          </div>
          <div className="rounded-lg border border-red-300 bg-red-50 p-4">
            <div className="font-semibold text-red-900">✗ Don&apos;t</div>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>과장 · 100% · 절대 · 완벽 등 절대화</li>
              <li>AI가 강사를 대체한다는 뉘앙스</li>
              <li>불필요한 영어 남발</li>
              <li>한자·전문용어 남발 (학습 장벽)</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-amber-50 p-6 text-sm">
        <h3 className="mb-2 font-bold text-amber-900">변경 이력</h3>
        <ul className="ml-4 list-disc text-amber-800">
          <li>v1.0 (W33) — 최초 확정. 디자이너 영입 후 v1.1 예정.</li>
        </ul>
      </section>
    </div>
  );
}
