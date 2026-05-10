"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type AgentLogEntry = {
  agent_id: string;
  agent_name: string;
  status: "started" | "completed" | "failed" | "skipped";
  started_at: string;
  completed_at: string;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  error?: string;
};

// ─── TEAM 1 (#01~#04) 산출물 타입 ─────────────────────────────
export type LearningObjective = {
  primary: string;
  secondary: string[];
};

export type AnalysisOutput = {
  course_overview: string;
  target_learners: string;
  prerequisites: string[];
  learning_objective_tree: LearningObjective[];
  estimated_chapters: number;
  difficulty_factors: string[];
};

export type EnvironmentResearchOutput = {
  domain_context: string;
  current_trends: string[];
  industry_keywords: string[];
  common_misconceptions: string[];
  real_world_applications: string[];
  market_relevance: "high" | "medium" | "low";
};

export type TopicPoolEntry = {
  objective_id: string;
  primary_objective: string;
  core_concepts: string[];
  supporting_facts: string[];
  useful_examples: string[];
  common_pitfalls: string[];
};

export type TopicResearchOutput = {
  topic_pool: TopicPoolEntry[];
  cross_topic_connections: string[];
};

export type SectionOutline = {
  section_number: string;
  title: string;
  key_concepts: string[];
  examples_needed: string[];
  assessment_focus: string;
};

export type ChapterOutline = {
  chapter_number: number;
  title: string;
  duration_minutes: number;
  learning_objective_ids: string[];
  sections: SectionOutline[];
};

export type OutlineOutput = {
  chapter_outline: ChapterOutline[];
  logical_flow_rationale: string;
  total_duration_minutes: number;
};

export type PlanningContent = {
  analysis: AnalysisOutput;
  environment: EnvironmentResearchOutput;
  topicResearch: TopicResearchOutput;
  outline: OutlineOutput;
};

// ─── TEAM 2 (#05~#08) 타입 ──────────────────────────────────
export type CuratorOutput = {
  chapter_title: string;
  learning_objectives: string[];
  main_content: { section: string; paragraphs: string[] }[];
  examples: { title: string; type: string; body: string }[];
};

export type SlideMeta = {
  slide_number: number;
  title: string;
  content_blocks: string[];
  visual_suggestions: string;
  speaker_notes: string;
};

export type PlannerOutput = { slides: SlideMeta[] };

export type Infographic = {
  slide_number: number;
  type: "comparison" | "process" | "hierarchy" | "timeline" | "matrix" | "none";
  title: string;
  elements: string[];
  layout_description: string;
  color_emphasis: string[];
};

export type InfographicOutput = { infographics: Infographic[] };

// ─── TEAM 4 (#10~#13) 타입 ──────────────────────────────────
export type ScoreWithIssues = { score: number; issues: string[] };

export type ReviewerOutput = {
  factual_accuracy: ScoreWithIssues;
  consistency: ScoreWithIssues;
  completeness: { score: number; missing_elements: string[] };
  overall_pass: boolean;
};

export type FormatCheckerOutput = {
  structural_compliance: { score: number; violations: string[] };
  naming_conventions: { score: number; violations: string[] };
  metadata_completeness: { score: number; missing: string[] };
  auto_fixable_issues: string[];
  manual_review_required: string[];
  overall_pass: boolean;
};

export type ObjectiveCoverage = {
  objective_id: string;
  coverage_score: number;
  covered_in_sections: string[];
  gaps: string[];
};

export type ComprehensiveReviewerOutput = {
  objective_coverage: ObjectiveCoverage[];
  overall_alignment_score: number;
  strengths: string[];
  weaknesses: string[];
  recommendation: "approve" | "revise" | "reject";
};

export type QualityContent = {
  reviewer: ReviewerOutput;
  format_checker: FormatCheckerOutput;
  comprehensive: ComprehensiveReviewerOutput;
  revise_count: number;
  error_message?: string;
};

export type StudioJobResultProps = {
  /** v0.6: { curator, planner } / v0.9+: { planning, curator, planner } / v0.10+: + team2, quality */
  content: {
    planning?: PlanningContent;
    curator: CuratorOutput;
    planner: PlannerOutput;
    team2?: {
      learning_sequence: unknown;
      curator: CuratorOutput;
      planner: PlannerOutput;
      infographics: InfographicOutput;
    };
    quality?: QualityContent;
  };
  agentLogs: AgentLogEntry[];
  meta: {
    durationSeconds: number | null;
    costUsd: number | null;
    jobId: string | null;
  };
};

type ResultTab = "planning" | "content" | "slides" | "quality" | "logs";

const RELEVANCE_LABEL = {
  high: "높음",
  medium: "보통",
  low: "낮음",
} as const;

/**
 * Studio job 결과 렌더링.
 * v0.9.0+ 4탭: 기획 산출물 (TEAM 1) · 본문 (Curator) · 슬라이드 (Planner) · 에이전트 로그
 * 이전 버전 (v0.6/v0.7) 작업은 planning 미존재 — 기획 탭은 자동 숨김.
 */
export function StudioJobResult({ content, agentLogs, meta }: StudioJobResultProps) {
  const hasPlanning = !!content.planning;
  const hasQuality = !!content.quality;
  const infographics = content.team2?.infographics;
  const [activeTab, setActiveTab] = useState<ResultTab>(
    hasPlanning ? "planning" : "content",
  );

  return (
    <div className="space-y-5">
      {/* 메타 */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>
          ⚡{" "}
          <span className="font-mono tabular-nums text-foreground">
            {meta.durationSeconds?.toFixed(1) ?? "-"}s
          </span>
        </span>
        <span>
          💵{" "}
          <span className="font-mono tabular-nums text-foreground">
            ${meta.costUsd?.toFixed(4) ?? "-"}
          </span>
        </span>
        {meta.jobId && (
          <span className="font-mono text-muted-foreground/60">
            job: {meta.jobId.slice(0, 8)}…
          </span>
        )}
        <span className="font-mono text-muted-foreground/60">
          {agentLogs.length} agents
        </span>
        {hasQuality && content.quality!.revise_count > 0 && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            재생성 {content.quality!.revise_count}회
          </span>
        )}
      </div>

      {/* reject 경고 */}
      {hasQuality && content.quality!.comprehensive.recommendation === "reject" && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4">
          <p className="mb-1 text-sm font-medium text-red-300">품질 검증 미통과</p>
          <p className="text-sm text-red-300/80">
            {content.quality!.error_message ??
              "AI가 생성한 콘텐츠가 학습 목표를 충족하지 못했습니다. 다른 주제로 다시 시도하거나 수준을 조정해보세요."}
          </p>
        </div>
      )}

      {/* 탭 헤더 */}
      <div className="flex flex-wrap gap-1 border-b border-border/60">
        {hasPlanning && (
          <TabButton tab="planning" label="기획 산출물" active={activeTab} setActive={setActiveTab} />
        )}
        <TabButton tab="content" label="본문" active={activeTab} setActive={setActiveTab} />
        <TabButton
          tab="slides"
          label={`슬라이드 (${content.planner.slides.length})`}
          active={activeTab}
          setActive={setActiveTab}
        />
        {hasQuality && (
          <TabButton
            tab="quality"
            label={`품질 검증 ${content.quality!.comprehensive.overall_alignment_score >= 85 ? "✓" : content.quality!.comprehensive.recommendation === "reject" ? "✗" : "△"}`}
            active={activeTab}
            setActive={setActiveTab}
          />
        )}
        <TabButton tab="logs" label="협업 로그" active={activeTab} setActive={setActiveTab} />
      </div>

      {/* 기획 산출물 탭 */}
      {activeTab === "planning" && content.planning && (
        <PlanningPanel planning={content.planning} />
      )}

      {/* 본문 탭 */}
      {activeTab === "content" && <ContentPanel curator={content.curator} />}

      {/* 슬라이드 탭 */}
      {activeTab === "slides" && (
        <SlidesPanel slides={content.planner.slides} infographics={infographics} />
      )}

      {/* 품질 검증 탭 — v0.10.0+ */}
      {activeTab === "quality" && content.quality && (
        <QualityPanel quality={content.quality} />
      )}

      {/* 협업 로그 탭 */}
      {activeTab === "logs" && (
        <LogsPanel
          agentLogs={agentLogs}
          durationSeconds={meta.durationSeconds}
          costUsd={meta.costUsd}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function TabButton({
  tab,
  label,
  active,
  setActive,
}: {
  tab: ResultTab;
  label: string;
  active: ResultTab;
  setActive: (t: ResultTab) => void;
}) {
  const isActive = active === tab;
  return (
    <button
      onClick={() => setActive(tab)}
      className={`-mb-px rounded-t-md border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function PlanningPanel({ planning }: { planning: PlanningContent }) {
  const { analysis, environment, topicResearch, outline } = planning;
  return (
    <div className="space-y-5">
      {/* 과정 개요 + 학습자 */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            과정 개요 · #studio-01
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-foreground/90">{analysis.course_overview}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                대상 학습자
              </p>
              <p className="text-foreground/80">{analysis.target_learners}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                선수 지식
              </p>
              <ul className="text-foreground/80">
                {analysis.prerequisites.length > 0 ? (
                  analysis.prerequisites.map((p, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-muted-foreground/60">•</span>
                      <span>{p}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-muted-foreground/70">없음</li>
                )}
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 font-mono text-xs text-muted-foreground">
            <span>
              예상 챕터:{" "}
              <span className="text-foreground">{analysis.estimated_chapters}</span>
            </span>
            <span>
              난이도 요인:{" "}
              <span className="text-foreground">
                {analysis.difficulty_factors.length}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 학습 목표 트리 */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            학습 목표 트리 · #studio-01
          </p>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {analysis.learning_objective_tree.map((obj, i) => (
              <li key={i} className="text-sm">
                <p className="mb-1.5 flex gap-2 text-foreground">
                  <span className="font-mono text-xs text-muted-foreground">
                    primary-{i + 1}
                  </span>
                  <span className="font-medium">{obj.primary}</span>
                </p>
                <ul className="ml-6 space-y-1 text-muted-foreground">
                  {obj.secondary.map((s, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground/60">
                        {i + 1}.{j + 1}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* 환경 조사 */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            환경 조사 · #studio-02
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              도메인 컨텍스트
            </p>
            <p className="text-foreground/90">{environment.domain_context}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PlanningList title="현재 트렌드" items={environment.current_trends} />
            <PlanningList
              title="실무 적용 사례"
              items={environment.real_world_applications}
            />
            <PlanningList
              title="흔한 오해"
              items={environment.common_misconceptions}
            />
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                시장 관련성
              </p>
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-medium uppercase tracking-widest ${
                  environment.market_relevance === "high"
                    ? "bg-emerald-500/10 text-emerald-300"
                    : environment.market_relevance === "medium"
                      ? "bg-foreground/10 text-foreground"
                      : "bg-muted-foreground/10 text-muted-foreground"
                }`}
              >
                {RELEVANCE_LABEL[environment.market_relevance]}
              </span>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              산업 키워드
            </p>
            <div className="flex flex-wrap gap-1.5">
              {environment.industry_keywords.map((k, i) => (
                <span
                  key={i}
                  className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-xs text-foreground/80"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 주제 풀 */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            주제 풀 · #studio-03
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {topicResearch.topic_pool.map((t) => (
            <div
              key={t.objective_id}
              className="rounded-md border border-border/60 bg-background/40 p-4"
            >
              <p className="mb-3 flex gap-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  {t.objective_id}
                </span>
                <span className="font-medium text-foreground">
                  {t.primary_objective}
                </span>
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <PlanningList title="핵심 개념" items={t.core_concepts} />
                <PlanningList title="활용 예제" items={t.useful_examples} />
                <PlanningList title="보조 사실" items={t.supporting_facts} />
                <PlanningList title="학습자 함정" items={t.common_pitfalls} />
              </div>
            </div>
          ))}
          {topicResearch.cross_topic_connections.length > 0 && (
            <PlanningList
              title="주제 간 연결"
              items={topicResearch.cross_topic_connections}
            />
          )}
        </CardContent>
      </Card>

      {/* 챕터 개요 */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            챕터 구조 · #studio-04
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            총 {outline.total_duration_minutes}분 · {outline.chapter_outline.length}챕터
          </p>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs italic text-muted-foreground">
            논리적 흐름: {outline.logical_flow_rationale}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-center">#</th>
                  <th className="px-2 py-2">챕터 제목</th>
                  <th className="px-2 py-2">학습 목표</th>
                  <th className="hidden px-2 py-2 sm:table-cell">섹션</th>
                  <th className="px-2 py-2 text-right">분</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {outline.chapter_outline.map((ch) => (
                  <tr key={ch.chapter_number} className="text-foreground/80">
                    <td className="px-2 py-3 text-center font-mono text-xs">
                      {ch.chapter_number}
                    </td>
                    <td className="px-2 py-3 font-medium text-foreground">
                      {ch.title}
                    </td>
                    <td className="px-2 py-3 font-mono text-xs text-muted-foreground">
                      {ch.learning_objective_ids.join(", ")}
                    </td>
                    <td className="hidden px-2 py-3 text-xs text-muted-foreground sm:table-cell">
                      {ch.sections.length}
                    </td>
                    <td className="px-2 py-3 text-right font-mono tabular-nums text-muted-foreground">
                      {ch.duration_minutes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanningList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1 text-sm text-foreground/80">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-muted-foreground/60">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContentPanel({ curator }: { curator: CuratorOutput }) {
  return (
    <div className="space-y-5">
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            챕터 제목
          </p>
          <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
            {curator.chapter_title}
          </CardTitle>
        </CardHeader>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            학습 목표
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {curator.learning_objectives.map((obj, i) => (
              <li key={i} className="flex gap-3 text-sm text-foreground">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs text-muted-foreground">
                  {i + 1}
                </span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {curator.main_content.map((section, i) => (
        <Card key={i} className="border-border/60 bg-card/80">
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              섹션 {i + 1}
            </p>
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
              {section.section}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
              {section.paragraphs.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {curator.examples.map((ex, i) => (
        <Card key={i} className="border-border/60 bg-card/80">
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              예제 · {ex.type}
            </p>
            <CardTitle className="text-base font-semibold text-foreground">
              {ex.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-secondary/50 p-3 font-mono text-xs text-foreground/90">
              {ex.body}
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SlidesPanel({
  slides,
  infographics,
}: {
  slides: SlideMeta[];
  infographics?: InfographicOutput;
}) {
  const infMap = new Map(
    (infographics?.infographics ?? []).map((inf) => [inf.slide_number, inf]),
  );

  return (
    <div className="space-y-4">
      {slides.map((slide) => {
        const inf = infMap.get(slide.slide_number);
        return (
          <Card key={slide.slide_number} className="border-border/60 bg-card/80">
            <CardHeader>
              <p className="font-mono text-xs text-muted-foreground">
                Slide {slide.slide_number.toString().padStart(2, "0")}
              </p>
              <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
                {slide.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Content
                </p>
                <ul className="space-y-1 text-sm text-foreground/90">
                  {slide.content_blocks.map((block, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground/60">•</span>
                      <span>{block}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Visual
                </p>
                <p className="text-sm italic text-muted-foreground">
                  {slide.visual_suggestions}
                </p>
              </div>
              {inf && inf.type !== "none" && (
                <div className="rounded-md border border-border/60 bg-background/40 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Infographic
                    </p>
                    <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {inf.type}
                    </span>
                  </div>
                  <p className="mb-2 text-sm font-medium text-foreground">{inf.title}</p>
                  <p className="mb-2 text-xs italic text-muted-foreground">
                    {inf.layout_description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {inf.elements.map((el, i) => (
                      <span
                        key={i}
                        className="rounded-md border border-border bg-card px-2 py-0.5 text-xs text-foreground/80"
                      >
                        {el}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Speaker Notes
                </p>
                <p className="text-sm leading-relaxed text-foreground/80">
                  {slide.speaker_notes}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80 ? "bg-emerald-400" : score >= 60 ? "bg-amber-400" : "bg-red-400";
  const textColor =
    score >= 80 ? "text-emerald-300" : score >= 60 ? "text-amber-300" : "text-red-300";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-mono font-semibold ${textColor}`}>{score}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-border">
        <div
          className={`h-1.5 rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function QualityPanel({ quality }: { quality: QualityContent }) {
  const { reviewer, format_checker, comprehensive, revise_count } = quality;
  const recommendationStyle = {
    approve: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    revise: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    reject: "bg-red-500/10 text-red-300 border-red-500/30",
  }[comprehensive.recommendation];
  const recommendationLabel = {
    approve: "승인",
    revise: `수정 후 승인 (재시도 ${revise_count}회)`,
    reject: "기각",
  }[comprehensive.recommendation];

  return (
    <div className="space-y-5">
      {/* 종합 점수 카드 */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              종합 검토 · #studio-12
            </p>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${recommendationStyle}`}>
              {recommendationLabel}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScoreBar score={comprehensive.overall_alignment_score} label="학습 목표 부합도" />
          <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
            <PlanningList title="강점" items={comprehensive.strengths} />
            <PlanningList title="약점" items={comprehensive.weaknesses} />
          </div>
        </CardContent>
      </Card>

      {/* 학습 목표별 커버리지 */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            학습 목표 커버리지
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {comprehensive.objective_coverage.map((obj) => (
            <div key={obj.objective_id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {obj.objective_id}
                </span>
                <ScoreBar score={obj.coverage_score} label="" />
              </div>
              {obj.gaps.length > 0 && (
                <ul className="ml-4 space-y-0.5 text-xs text-muted-foreground">
                  {obj.gaps.map((gap, i) => (
                    <li key={i} className="flex gap-1.5 text-amber-300/80">
                      <span>△</span>
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 검토 (#10) + 형식 확인 (#11) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              검토 · #studio-10
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScoreBar score={reviewer.factual_accuracy.score} label="사실 정확성" />
            <ScoreBar score={reviewer.consistency.score} label="일관성" />
            <ScoreBar score={reviewer.completeness.score} label="완성도" />
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">판정</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  reviewer.overall_pass
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-red-500/10 text-red-300"
                }`}
              >
                {reviewer.overall_pass ? "PASS" : "FAIL"}
              </span>
            </div>
            {[...reviewer.factual_accuracy.issues, ...reviewer.consistency.issues, ...reviewer.completeness.missing_elements].length > 0 && (
              <ul className="mt-2 space-y-1">
                {[...reviewer.factual_accuracy.issues, ...reviewer.consistency.issues].slice(0, 4).map((issue, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    • {issue}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              형식 확인 · #studio-11
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScoreBar score={format_checker.structural_compliance.score} label="구조 준수" />
            <ScoreBar score={format_checker.naming_conventions.score} label="명명 규칙" />
            <ScoreBar score={format_checker.metadata_completeness.score} label="메타데이터" />
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">판정</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  format_checker.overall_pass
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-red-500/10 text-red-300"
                }`}
              >
                {format_checker.overall_pass ? "PASS" : "FAIL"}
              </span>
            </div>
            {format_checker.auto_fixable_issues.length > 0 && (
              <div className="mt-2">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  자동 수정
                </p>
                <ul className="space-y-0.5">
                  {format_checker.auto_fixable_issues.slice(0, 3).map((issue, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      • {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LogsPanel({
  agentLogs,
  durationSeconds,
  costUsd,
}: {
  agentLogs: AgentLogEntry[];
  durationSeconds: number | null;
  costUsd: number | null;
}) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardContent className="p-6">
        <div className="space-y-6">
          {agentLogs.map((log, i) => {
            const startTime = new Date(log.started_at);
            const endTime = new Date(log.completed_at);
            return (
              <div key={i} className="relative pl-8">
                {i < agentLogs.length - 1 && (
                  <span className="absolute left-2.5 top-6 h-full w-px bg-border" />
                )}
                <span
                  className={`absolute left-1 top-1 inline-flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-background ${
                    log.status === "completed"
                      ? "bg-emerald-400"
                      : log.status === "failed"
                        ? "bg-red-400"
                        : log.status === "skipped"
                          ? "bg-border opacity-50"
                          : log.status === "started"
                            ? "animate-pulse bg-foreground"
                            : "bg-muted-foreground"
                  }`}
                />
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{log.agent_id}
                    </span>
                    <span className="text-base font-semibold text-foreground">
                      {log.agent_name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${
                        log.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-300"
                          : log.status === "failed"
                            ? "bg-red-500/10 text-red-300"
                            : "bg-muted-foreground/10 text-muted-foreground"
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground/70">
                    {startTime.toLocaleTimeString("ko-KR")} →{" "}
                    {endTime.toLocaleTimeString("ko-KR")} (
                    {(log.duration_ms / 1000).toFixed(2)}s)
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
                    <span className="text-muted-foreground">
                      tokens:{" "}
                      <span className="text-foreground">
                        {log.tokens_in.toLocaleString()}
                      </span>{" "}
                      in /{" "}
                      <span className="text-foreground">
                        {log.tokens_out.toLocaleString()}
                      </span>{" "}
                      out
                    </span>
                    <span className="text-muted-foreground">
                      cost:{" "}
                      <span className="text-foreground">
                        ${log.cost_usd.toFixed(4)}
                      </span>
                    </span>
                  </div>
                  {log.error && <p className="text-xs text-red-300">{log.error}</p>}
                </div>
              </div>
            );
          })}
        </div>
        {agentLogs.length > 1 && (
          <div className="mt-6 border-t border-border/40 pt-4">
            <p className="font-mono text-xs text-muted-foreground">
              total:{" "}
              <span className="text-foreground">
                {durationSeconds?.toFixed(2)}s
              </span>{" "}
              · <span className="text-foreground">${costUsd?.toFixed(4)}</span> ·{" "}
              {agentLogs.length} agents
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
