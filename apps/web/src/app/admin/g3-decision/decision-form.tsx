"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DecisionForm({
  options,
  initialKey,
}: {
  options: { key: string; label: string }[];
  initialKey: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialKey ?? "");
  const [rationale, setRationale] = useState("");
  const [actions, setActions] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !rationale.trim()) return;
    if (!confirm(`최종 결정: ${selected}. 저장하시겠습니까?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/g3-decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selected_option: selected, rationale, next_quarter_actions: actions }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg("✅ 저장 완료");
        router.refresh();
      } else {
        setMsg(`❌ ${json.error}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">선택 옵션</label>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setSelected(o.key)}
              className={`rounded-md border px-4 py-2 text-sm font-medium ${
                selected === o.key ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">결정 사유 *</span>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={4}
          required
          className="w-full rounded-md border bg-background p-3 text-sm"
          placeholder="이 옵션을 선택한 이유와 의사결정 근거 (G3 보고서 데이터 인용 권장)"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">다음 분기 액션 플랜</span>
        <textarea
          value={actions}
          onChange={(e) => setActions(e.target.value)}
          rows={6}
          className="w-full rounded-md border bg-background p-3 text-sm"
          placeholder={`- 1분기: ...\n- 2분기: ...\n- 핵심 마일스톤 / 예산 / 인력`}
        />
      </label>

      <div className="flex items-center justify-between">
        {msg && <span className="text-sm">{msg}</span>}
        <button
          type="submit"
          disabled={busy || !selected || !rationale.trim()}
          className="ml-auto rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {busy ? "저장 중..." : "최종 결정 기록"}
        </button>
      </div>
    </form>
  );
}
