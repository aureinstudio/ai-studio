"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function randomCode(len = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동 글자 제외
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function GenerateCodeForm() {
  const router = useRouter();
  const [ownerEmail, setOwnerEmail] = useState("");
  const [code, setCode] = useState(randomCode());
  const [reward, setReward] = useState(30000);
  const [discount, setDiscount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner_email: ownerEmail, code, reward_krw: reward, discount_pct: discount }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg(`✅ 코드 ${code} 발급 — 소유자에게 공유`);
        setCode(randomCode());
        setOwnerEmail("");
        router.refresh();
      } else {
        setMsg(`❌ ${json.error}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">소유자 이메일</span>
        <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="instructor@..." />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">코드 (자동 생성)</span>
        <div className="flex gap-1">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} pattern="[A-Z0-9]{4,12}" required className="flex-1 rounded-md border bg-background px-3 py-2 font-mono text-sm" />
          <button type="button" onClick={() => setCode(randomCode())} className="rounded-md border px-2 text-xs">↻</button>
        </div>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">보상/건 (KRW)</span>
        <input type="number" min={0} value={reward} onChange={(e) => setReward(Number(e.target.value))} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">신규 할인 %</span>
        <input type="number" min={0} max={50} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </label>
      <div className="md:col-span-4 flex items-center gap-3">
        <button type="submit" disabled={busy || !ownerEmail} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
          {busy ? "발급 중..." : "발급"}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </form>
  );
}
