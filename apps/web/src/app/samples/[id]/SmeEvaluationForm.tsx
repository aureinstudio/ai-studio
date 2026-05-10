"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SmeEvaluationForm({ jobId }: { jobId: string }) {
  const [rating, setRating] = useState<number>(0);
  const [improvements, setImprovements] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("평점을 선택해주세요");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/sme-evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studio_job_id: jobId,
          rating,
          improvements: improvements.trim() || null,
          evaluator_name: name.trim() || null,
          evaluator_role: role.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setSubmitted(true);
      // 페이지 새로고침으로 새 평가 반영
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
        평가가 제출되었습니다. 감사합니다.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
          이 콘텐츠는 강의에 활용할 만한 수준인가요?
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              disabled={submitting}
              className={`flex-1 rounded-md border px-4 py-3 text-2xl transition-colors ${
                rating >= n
                  ? "border-amber-400 bg-amber-500/10 text-amber-300"
                  : "border-border bg-transparent text-muted-foreground hover:bg-card"
              }`}
              aria-label={`${n}점`}
            >
              ⭐
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>매우 부족</span>
          <span>충분히 활용 가능</span>
        </div>
      </div>

      <div>
        <label
          htmlFor="improvements"
          className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground"
        >
          어떤 부분을 보완하시겠어요? (선택)
        </label>
        <textarea
          id="improvements"
          value={improvements}
          onChange={(e) => setImprovements(e.target.value)}
          disabled={submitting}
          rows={4}
          maxLength={1000}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none disabled:opacity-50"
          placeholder="예: 챕터 2의 예제가 한국 시험 형식과 맞지 않음. 객관식 보기를 5개로..."
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground"
          >
            성함 (선택)
          </label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            maxLength={50}
            placeholder="홍길동"
          />
        </div>
        <div>
          <label
            htmlFor="role"
            className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground"
          >
            소속·역할 (선택)
          </label>
          <Input
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={submitting}
            maxLength={80}
            placeholder="예: KEG 시니어 강사 · 조리"
          />
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
        disabled={submitting || rating === 0}
        className="w-full bg-foreground text-background hover:bg-foreground/90"
      >
        {submitting ? "제출 중..." : "평가 제출"}
      </Button>
    </form>
  );
}
