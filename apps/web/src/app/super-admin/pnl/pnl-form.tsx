"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PnlForm({ period, defaultB2b, defaultAi }: { period: string; defaultB2b: number; defaultAi: number }) {
  const router = useRouter();
  const [b2c, setB2c] = useState(0);
  const [b2b, setB2b] = useState(defaultB2b);
  const [ai, setAi] = useState(defaultAi);
  const [personnel, setPersonnel] = useState(0);
  const [marketing, setMarketing] = useState(0);
  const [infra, setInfra] = useState(0);
  const [other, setOther] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const totalRev = b2c + b2b;
  const totalCost = ai + personnel + marketing + infra + other;
  const profit = totalRev - totalCost;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/super-admin/pnl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          period,
          b2c_revenue_krw: b2c, b2b_revenue_krw: b2b,
          ai_cost_krw: ai, personnel_cost_krw: personnel,
          marketing_cost_krw: marketing, infra_cost_krw: infra, other_cost_krw: other,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg("✅ 스냅샷 저장됨");
        router.refresh();
      } else {
        setMsg(`❌ ${json.error}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="B2C 매출" value={b2c} onChange={setB2c} />
        <Field label="B2B 매출" value={b2b} onChange={setB2b} hint="추정값 사전 입력됨" />
        <Field label="AI 비용" value={ai} onChange={setAi} hint="추정값 사전 입력됨" />
        <Field label="인건비" value={personnel} onChange={setPersonnel} />
        <Field label="마케팅" value={marketing} onChange={setMarketing} />
        <Field label="인프라" value={infra} onChange={setInfra} />
        <Field label="기타" value={other} onChange={setOther} />
      </div>

      <div className="rounded-md bg-zinc-100 p-3 text-sm">
        <div className="grid grid-cols-3 gap-3 font-mono">
          <div>매출: <b>₩{(totalRev / 1_0000_000).toFixed(1)}M</b></div>
          <div>비용: <b className="text-red-700">₩{(totalCost / 1_0000_000).toFixed(1)}M</b></div>
          <div className={profit >= 0 ? "text-emerald-700" : "text-red-700"}>이익: <b>₩{(profit / 1_0000_000).toFixed(1)}M</b></div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {msg && <span className="text-sm">{msg}</span>}
        <button type="submit" disabled={busy} className="ml-auto rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50">
          {busy ? "저장 중..." : `${period} 스냅샷 저장`}
        </button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label} (KRW)</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} step={100000} className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono" />
      {hint && <span className="text-[10px] text-blue-600">{hint}</span>}
    </label>
  );
}
