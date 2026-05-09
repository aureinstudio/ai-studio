import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const solutions = [
  {
    name: "Studio",
    tag: "콘텐츠 생성",
    agents: 13,
    description: "교재·슬라이드·퀴즈를 단일 입력에서 동시 생성. 자료 기획부터 최종 품질 검토까지 4팀 협업 구조.",
  },
  {
    name: "Cast",
    tag: "영상 변환",
    agents: 7,
    description: "PPT 한 장에서 강의 영상까지. 슬라이드 분석·스크립트·TTS·아바타 합성을 직렬 자동화.",
  },
  {
    name: "Tutor",
    tag: "AI 튜터",
    agents: 9,
    description: "1:1 학습 상호작용. 의도 분류·RAG 검색·이해도 평가·환각 차단을 결합한 안전한 튜터링.",
  },
];

const stats = [
  { value: "-90%", label: "교재 제작 시간" },
  { value: "-40%", label: "강사 의존도" },
  { value: "8개월", label: "BEP 도달" },
];

export default function Page() {
  return (
    <div className="relative">
      {/* 미세한 무채색 글로우 — 위쪽 중앙에 light spot */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.05),_transparent_60%)]"
      />

      {/* ═══ Hero ═══ */}
      <section className="mx-auto max-w-7xl px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 lg:px-10 lg:pt-36">
        <div className="flex flex-col items-center text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
            v0.2.1 · KEG × Aurein AX
          </span>

          <h1 className="text-5xl font-semibold tracking-tighter text-foreground sm:text-6xl lg:text-7xl">
            ai-studio
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            <span className="font-semibold text-foreground">13개 AI 에이전트</span>가 만드는{" "}
            <br className="hidden sm:block" />
            교육 콘텐츠 플랫폼
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-11 min-w-[140px] bg-foreground px-6 text-base font-medium text-background shadow-lg shadow-foreground/10 hover:bg-foreground/90"
            >
              시작하기
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-11 min-w-[140px] border-border bg-transparent px-6 text-base font-medium text-foreground hover:bg-card"
            >
              어떻게 작동하나요
            </Button>
          </div>
        </div>
      </section>

      {/* ═══ 3 Solutions ═══ */}
      <section className="mx-auto max-w-7xl px-6 pb-24 sm:pb-32 lg:px-10">
        <div className="mb-12 flex flex-col items-center text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            3개 솔루션, 29개 에이전트
          </h2>
          <p className="mt-3 max-w-xl text-base text-muted-foreground">
            콘텐츠부터 영상, 학습 인터랙션까지. 단일 플랫폼에서 통합 운영.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {solutions.map((s) => (
            <Card
              key={s.name}
              className="group relative overflow-hidden border-border/60 bg-card/80 transition-all duration-300 hover:-translate-y-1 hover:border-foreground/30 hover:shadow-2xl hover:shadow-foreground/5"
            >
              {/* 호버 시 미세한 화이트 라인 */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <CardHeader className="pb-3">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-widest text-foreground/70">
                    {s.tag}
                  </span>
                  <span className="text-xs text-muted-foreground/40">·</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {s.agents} Agents
                  </span>
                </div>
                <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
                  {s.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                  {s.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ═══ Stats ═══ */}
      <section className="mx-auto max-w-7xl px-6 pb-32 lg:px-10">
        <div className="rounded-2xl border border-border/60 bg-card/40 px-6 py-12 backdrop-blur sm:px-12 sm:py-16">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`flex flex-col items-center text-center sm:items-start sm:text-left ${
                  i > 0 ? "sm:border-l sm:border-border/40 sm:pl-10" : ""
                }`}
              >
                <p className="bg-gradient-to-br from-foreground via-foreground to-muted-foreground/60 bg-clip-text font-mono text-5xl font-bold tracking-tighter tabular-nums text-transparent sm:text-6xl">
                  {stat.value}
                </p>
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
