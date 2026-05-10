import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:px-10 lg:py-20">
      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          KEG · AI Studio · CEO Demo
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          13 에이전트 협업으로
          <br />
          교육 콘텐츠 생성
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          KEG Studio는 4개 팀 13개 AI 에이전트가 순차·병렬 협업하여
          자격증·강의 콘텐츠를 생성합니다. 입력 한 줄로 챕터 구성·본문·슬라이드·인포그래픽까지 자동 작성됩니다.
        </p>
      </div>

      {/* 4팀 구조 */}
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TeamCard color="emerald" team="TEAM 3" name="오케스트레이션" count={1} desc="실행 계획" />
        <TeamCard color="blue" team="TEAM 1" name="기획" count={4} desc="목표·조사·구조" />
        <TeamCard color="violet" team="TEAM 2" name="제작" count={4} desc="본문·슬라이드" />
        <TeamCard color="amber" team="TEAM 4" name="품질" count={4} desc="검증·마감" />
      </div>

      {/* 주요 기능 */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FeatureCard title="동적 라우팅" desc="입력 특성에 따라 #05·#08을 자동 스킵해 시간·비용 절감" />
        <FeatureCard title="품질 게이트" desc="2단계 검증 (정확성·일관성 + 형식·구조) 후 종합 평가" />
        <FeatureCard title="실시간 진행" desc="스트리밍으로 각 에이전트의 토큰 생성을 실시간 표시" />
      </div>

      {/* CTA */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/samples"
          className="block rounded-lg border border-border/60 bg-card/80 p-6 transition-colors hover:border-foreground/30 hover:bg-card"
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            01 · 검증된 샘플 보기
          </p>
          <h3 className="mb-2 text-xl font-semibold text-foreground">
            샘플 콘텐츠 →
          </h3>
          <p className="text-sm text-muted-foreground">
            미리 생성된 자격증 과정 콘텐츠. SME 평가 결과도 함께 확인하세요.
          </p>
        </Link>

        <Link
          href="/studio"
          className="block rounded-lg border border-foreground/30 bg-foreground/5 p-6 transition-colors hover:border-foreground/50 hover:bg-foreground/10"
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            02 · 직접 생성하기
          </p>
          <h3 className="mb-2 text-xl font-semibold text-foreground">
            라이브 시연 →
          </h3>
          <p className="text-sm text-muted-foreground">
            주제를 입력하고 13 에이전트가 협업하는 과정을 실시간 관찰. 로그인 필요.
          </p>
        </Link>
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Aurein Studio · KEG · v0.13.0 · 2026
      </p>
    </div>
  );
}

function TeamCard({
  color,
  team,
  name,
  count,
  desc,
}: {
  color: "emerald" | "blue" | "violet" | "amber";
  team: string;
  name: string;
  count: number;
  desc: string;
}) {
  const colorClasses = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    blue: "border-blue-500/30 bg-blue-500/5",
    violet: "border-violet-500/30 bg-violet-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
  };
  const badgeClasses = {
    emerald: "bg-emerald-500/10 text-emerald-400",
    blue: "bg-blue-500/10 text-blue-400",
    violet: "bg-violet-500/10 text-violet-400",
    amber: "bg-amber-500/10 text-amber-400",
  };
  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className={`mb-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${badgeClasses[color]}`}>
        {team}
      </p>
      <p className="text-sm font-semibold text-foreground">{name}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        에이전트 {count}개
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">{desc}</p>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardContent className="p-4">
        <h4 className="mb-1 text-sm font-semibold text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
