"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = ["press_release","interview","article","conference_talk","podcast","case_study"];
const SENTIMENTS = ["positive","neutral","negative"];

export default function NewPressForm() {
  const router = useRouter();
  const [type, setType] = useState("interview");
  const [outlet, setOutlet] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reach, setReach] = useState(0);
  const [sentiment, setSentiment] = useState("positive");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/press", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mention_type: type, outlet, title, url, published_date: date, reach_estimate: reach, sentiment }),
      });
      if (res.ok) {
        setOutlet(""); setTitle(""); setUrl(""); setReach(0);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={outlet} onChange={(e) => setOutlet(e.target.value)} required placeholder="매체 *" className="rounded-md border bg-background px-3 py-2 text-sm" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm" />
        <select value={sentiment} onChange={(e) => setSentiment(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
          {SENTIMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="제목 *" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" className="rounded-md border bg-background px-3 py-2 text-sm" />
        <input type="number" value={reach} onChange={(e) => setReach(Number(e.target.value))} placeholder="도달 추정 (조회수 등)" className="rounded-md border bg-background px-3 py-2 text-sm" />
      </div>
      <button type="submit" disabled={busy || !outlet || !title} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
        {busy ? "추가 중..." : "언급 추가"}
      </button>
    </form>
  );
}
