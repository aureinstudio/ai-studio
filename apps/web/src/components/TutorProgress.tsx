"use client";

import { useEffect, useState } from "react";

/**
 * Tutor 답변 생성 5단계 시각 진행 표시.
 *
 * 실제 백엔드 단계와 매핑된 추정 타임라인 (orchestrator-v1 평균치):
 *   1. 의도·언어 분석    ~2s  (Haiku 병렬)
 *   2. 교재 검색         ~1s  (RAG)
 *   3. 답변 생성         ~3s  (Sonnet)
 *   4. 검증              ~2s  (Haiku, HallucinationChecker)
 *
 * SSE 없이 순수 클라이언트 타이머로 단계 전환. 응답 도착하면 부모가 unmount.
 */

const STAGES = [
  { label: "의도·언어 분석", at: 0 },
  { label: "교재 내용 검색", at: 2000 },
  { label: "답변 생성", at: 3000 },
  { label: "출처 검증", at: 6000 },
] as const;

export function TutorProgress() {
  const [elapsed, setElapsed] = useState(0);
  const [start] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - start), 250);
    return () => clearInterval(t);
  }, [start]);

  // 현재 활성 단계 인덱스 (마지막 완료된 단계 + 1)
  const activeIdx = STAGES.reduce(
    (acc, s, i) => (elapsed >= s.at ? i : acc),
    0,
  );
  const elapsedSec = (elapsed / 1000).toFixed(1);

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
          </span>
          <span className="text-xs font-medium text-foreground">AI 튜터 응답 중…</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{elapsedSec}s</span>
      </div>

      <ol className="space-y-1.5">
        {STAGES.map((s, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <li key={s.label} className="flex items-center gap-2 text-xs">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-blue-500 text-white"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={
                  done
                    ? "text-muted-foreground line-through"
                    : active
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                }
              >
                {s.label}
                {active && <span className="ml-1 inline-block animate-pulse">…</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
