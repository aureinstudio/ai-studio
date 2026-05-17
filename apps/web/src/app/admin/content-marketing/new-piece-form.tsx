"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CHANNELS = ["blog", "youtube", "instagram", "linkedin", "x", "newsletter"];
const CATEGORIES = ["demo", "case-study", "tutorial", "announcement", "industry"];

export default function NewPieceForm() {
  const router = useRouter();
  const [channel, setChannel] = useState("youtube");
  const [title, setTitle] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [category, setCategory] = useState("demo");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/content-pieces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, title, scheduled_date: scheduledDate || null, category, url }),
      });
      if (res.ok) {
        setTitle(""); setScheduledDate(""); setUrl("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-2 md:grid-cols-6">
      <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
        {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="제목 *" className="md:col-span-2 rounded-md border bg-background px-3 py-2 text-sm" />
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm" />
      <button type="submit" disabled={busy || !title} className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50">
        {busy ? "..." : "추가"}
      </button>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (선택)" className="md:col-span-6 rounded-md border bg-background px-3 py-2 text-sm" />
    </form>
  );
}
