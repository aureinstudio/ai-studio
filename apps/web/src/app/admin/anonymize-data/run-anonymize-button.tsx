"use client";

import { useState } from "react";

export default function RunAnonymizeButton() {
  const [mode, setMode] = useState<"dry_run" | "execute">("dry_run");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function run() {
    if (mode === "execute" && !confirm("실제 처리합니다. 되돌릴 수 없습니다. 진행하시겠습니까?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/anonymize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      setResult(await res.json());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setMode("dry_run")}
          className={`rounded-md border px-3 py-1.5 text-sm ${mode === "dry_run" ? "border-foreground bg-foreground text-background" : ""}`}
        >
          DRY RUN
        </button>
        <button
          onClick={() => setMode("execute")}
          className={`rounded-md border px-3 py-1.5 text-sm ${mode === "execute" ? "border-red-500 bg-red-500 text-white" : ""}`}
        >
          실행
        </button>
        <button
          onClick={run}
          disabled={busy}
          className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {busy ? "처리 중..." : "처리 시작"}
        </button>
      </div>
      {result != null && (
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}
