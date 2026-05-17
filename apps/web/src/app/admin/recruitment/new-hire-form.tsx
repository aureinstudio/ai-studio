"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = ["sales","csm","devops","designer","engineer","instructor","sme","other"];

export default function NewHireForm({ departments }: { departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState("sales");
  const [deptId, setDeptId] = useState(departments[0]?.id ?? "");
  const [salary, setSalary] = useState(60_000_000);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/hires", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidate_name: name, role, target_department_id: deptId, expected_salary_krw: salary }),
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
    <form onSubmit={submit} className="grid grid-cols-1 gap-2 md:grid-cols-5">
      <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="후보자명 *" className="rounded-md border bg-background px-3 py-2 text-sm" />
      <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <input type="number" value={salary} onChange={(e) => setSalary(Number(e.target.value))} step={1_000_000} placeholder="예상 연봉 (KRW)" className="rounded-md border bg-background px-3 py-2 text-sm" />
      <button type="submit" disabled={busy || !name} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
        {busy ? "추가 중..." : "후보 추가"}
      </button>
    </form>
  );
}
