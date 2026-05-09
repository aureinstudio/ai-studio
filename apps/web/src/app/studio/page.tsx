"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Level = "beginner" | "intermediate" | "advanced";
type Length = "short" | "medium" | "long";

type StudioContent = {
  chapter_title: string;
  learning_objectives: string[];
  core_concepts: string[];
  practical_example: { problem: string; solution: string };
  assessment: { question: string; options: string[]; answer: string }[];
};

type GenerateResponse = {
  jobId: string | null;
  content: StudioContent;
  cost_usd: number;
  duration_seconds: number;
  tokens: { input: number; output: number };
};

const LEVEL_LABEL: Record<Level, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

const PROGRESS_STEPS = [
  "에이전트가 주제를 분석하는 중",
  "학습 목표를 설계하는 중",
  "핵심 개념을 작성하는 중",
  "실습 예제와 평가 문항 생성 중",
  "최종 검수 중",
];

export default function StudioPage() {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<Level>("beginner");
  const [length, setLength] = useState<Length>("short");
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  // 로딩 중 가짜 진행 단계 순회 (사용자 체감용)
  useEffect(() => {
    if (!loading) {
      setStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, PROGRESS_STEPS.length - 1));
    }, 5_000);
    return () => clearInterval(interval);
  }, [loading]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, level, length }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setResult(data as GenerateResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10 lg:py-20">
      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Studio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          콘텐츠 생성
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          주제를 입력하면 학습 콘텐츠 1챕터(목표 · 본문 · 예제 · 평가)를 자동 생성합니다.
        </p>
      </div>

      {/* ═══ 입력 폼 ═══ */}
      <Card className="border-border/60 bg-card/80">
        <CardContent className="p-6">
          <form onSubmit={handleGenerate} className="space-y-5">
            <div>
              <label
                htmlFor="topic"
                className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                주제
              </label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예: 파이썬 변수와 데이터 타입"
                required
                disabled={loading}
                maxLength={200}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                수준
              </label>
              <div className="flex gap-2">
                {(["beginner", "intermediate", "advanced"] as Level[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    disabled={loading}
                    onClick={() => setLevel(l)}
                    className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                      level === l
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-transparent text-foreground hover:bg-card"
                    } disabled:opacity-50`}
                  >
                    {LEVEL_LABEL[l]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                길이
              </label>
              <div className="flex gap-2">
                {(["short", "medium", "long"] as Length[]).map((len) => {
                  const active = length === len;
                  const disabled = len !== "short"; // medium/long은 v0.6+
                  return (
                    <button
                      key={len}
                      type="button"
                      disabled={loading || disabled}
                      onClick={() => setLength(len)}
                      className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-transparent text-foreground hover:bg-card"
                      } disabled:cursor-not-allowed disabled:opacity-30`}
                    >
                      {len === "short" ? "짧음" : len === "medium" ? "보통 (예정)" : "김 (예정)"}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={loading || !topic.trim()}
              className="h-11 w-full bg-foreground text-base font-medium text-background hover:bg-foreground/90"
            >
              {loading ? "에이전트 작업 중…" : "생성하기"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ═══ 로딩 진행 단계 ═══ */}
      {loading && (
        <div className="mt-6 rounded-lg border border-border/60 bg-card/40 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            진행 상태
          </p>
          <ul className="space-y-2">
            {PROGRESS_STEPS.map((step, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <li
                  key={step}
                  className={`flex items-center gap-3 text-sm ${
                    done ? "text-muted-foreground" : active ? "text-foreground" : "text-muted-foreground/50"
                  }`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      done ? "bg-muted-foreground" : active ? "animate-pulse bg-foreground" : "bg-muted-foreground/30"
                    }`}
                  />
                  {step}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ═══ 결과 ═══ */}
      {result && (
        <div className="mt-10 space-y-5">
          {/* 메타 */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>
              ⚡ <span className="font-mono tabular-nums text-foreground">{result.duration_seconds.toFixed(1)}s</span>
            </span>
            <span>
              💵{" "}
              <span className="font-mono tabular-nums text-foreground">
                ${result.cost_usd.toFixed(4)}
              </span>
            </span>
            <span>
              🔤{" "}
              <span className="font-mono tabular-nums text-foreground">
                {result.tokens.input.toLocaleString()} in / {result.tokens.output.toLocaleString()} out
              </span>
            </span>
            {result.jobId && (
              <span className="font-mono text-muted-foreground/60">
                job: {result.jobId.slice(0, 8)}…
              </span>
            )}
          </div>

          {/* 챕터 제목 */}
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                챕터 제목
              </p>
              <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
                {result.content.chapter_title}
              </CardTitle>
            </CardHeader>
          </Card>

          {/* 학습 목표 */}
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                학습 목표
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.content.learning_objectives.map((obj, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-xs font-mono text-muted-foreground">
                      {i + 1}
                    </span>
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* 핵심 개념 */}
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                핵심 개념
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
                {result.content.core_concepts.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 실습 예제 */}
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                실습 예제
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">문제</p>
                <p className="whitespace-pre-wrap text-sm text-foreground/90">
                  {result.content.practical_example.problem}
                </p>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">풀이</p>
                <p className="whitespace-pre-wrap rounded-md bg-secondary/50 p-3 font-mono text-xs text-foreground/90">
                  {result.content.practical_example.solution}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 평가 */}
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                단원 평가
              </p>
            </CardHeader>
            <CardContent>
              <ol className="space-y-5">
                {result.content.assessment.map((q, i) => (
                  <li key={i} className="text-sm">
                    <p className="mb-2 font-medium text-foreground">
                      Q{i + 1}. {q.question}
                    </p>
                    <ul className="ml-1 space-y-1">
                      {q.options.map((opt, j) => {
                        const isAnswer = opt === q.answer;
                        return (
                          <li
                            key={j}
                            className={`flex items-start gap-2 ${
                              isAnswer ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            <span className="mt-0.5 font-mono text-xs">
                              {String.fromCharCode(0x2460 + j)}
                            </span>
                            <span>
                              {opt}
                              {isAnswer && (
                                <span className="ml-2 text-xs font-medium text-emerald-400">
                                  ✓ 정답
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
