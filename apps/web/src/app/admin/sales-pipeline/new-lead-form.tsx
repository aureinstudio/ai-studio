"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewLeadForm() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [arr, setArr] = useState(30_000_000);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sales-leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company_name: company, contact_name: contact, contact_email: email, estimated_arr_krw: arr }),
      });
      if (res.ok) {
        setCompany("");
        setContact("");
        setEmail("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-2 md:grid-cols-5">
      <input value={company} onChange={(e) => setCompany(e.target.value)} required placeholder="회사명 *" className="rounded-md border bg-background px-3 py-2 text-sm" />
      <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="담당자" className="rounded-md border bg-background px-3 py-2 text-sm" />
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" className="rounded-md border bg-background px-3 py-2 text-sm" />
      <input type="number" value={arr} onChange={(e) => setArr(Number(e.target.value))} step={1_000_000} placeholder="예상 ARR (KRW)" className="rounded-md border bg-background px-3 py-2 text-sm" />
      <button type="submit" disabled={busy || !company} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
        {busy ? "추가 중..." : "리드 추가"}
      </button>
    </form>
  );
}
