"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CHANNELS = [
  { v: "naver_search", l: "네이버 검색" },
  { v: "google_search", l: "구글 검색" },
  { v: "kakao_ads", l: "카카오 광고" },
  { v: "facebook_ads", l: "페이스북" },
  { v: "instagram", l: "인스타그램" },
  { v: "influencer", l: "인플루언서" },
  { v: "keg_offline", l: "KEG 학원 오프라인" },
  { v: "organic", l: "유기적" },
  { v: "other", l: "기타" },
];

export default function CampaignForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("naver_search");
  const [budget, setBudget] = useState(1_000_000);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/marketing-campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, channel, budget_krw: budget }),
      });
      if (res.ok) {
        setName("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="캠페인 이름" className="rounded-md border bg-background px-3 py-2 text-sm" />
      <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
        {CHANNELS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
      </select>
      <input type="number" min={0} step={100000} value={budget} onChange={(e) => setBudget(Number(e.target.value))} placeholder="예산 (KRW)" className="rounded-md border bg-background px-3 py-2 text-sm" />
      <button type="submit" disabled={busy || !name} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
        {busy ? "생성 중..." : "캠페인 추가"}
      </button>
    </form>
  );
}
