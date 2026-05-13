"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function parseLines(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.replace(/^[\d.\-*\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 10);
}

export default function RetroForm() {
  const router = useRouter();
  const [wentWell, setWentWell] = useState("");
  const [wasHard, setWasHard] = useState("");
  const [doDifferently, setDoDifferently] = useState("");
  const [advice, setAdvice] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/retrospective-final", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          went_well: parseLines(wentWell),
          was_hard: parseLines(wasHard),
          do_differently: parseLines(doDifferently),
          advice_for_successors: advice.slice(0, 5000),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg("✅ 제출 완료");
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
      <Field label="✅ 잘 된 것 Top 10" value={wentWell} onChange={setWentWell} placeholder={"1. ...\n2. ...\n3. ..."} />
      <Field label="⚠ 어려웠던 것 Top 10" value={wasHard} onChange={setWasHard} placeholder={"1. ...\n2. ..."} />
      <Field label="🔁 다음에 다르게 할 것 Top 10" value={doDifferently} onChange={setDoDifferently} placeholder={"1. ...\n2. ..."} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium">다른 본부장 후배에게 전할 조언</span>
        <textarea
          value={advice}
          onChange={(e) => setAdvice(e.target.value)}
          rows={6}
          className="w-full rounded-md border bg-background p-3 text-sm"
          placeholder="14주 동안의 핵심 교훈, 절대 하지 말아야 할 것, 반드시 해야 할 것 등"
        />
      </label>
      <div className="flex items-center justify-between">
        {msg && <span className="text-sm">{msg}</span>}
        <button
          type="submit"
          disabled={busy}
          className="ml-auto rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {busy ? "제출 중..." : "회고 제출"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder={placeholder}
        className="w-full rounded-md border bg-background p-3 text-sm font-mono"
      />
    </label>
  );
}
