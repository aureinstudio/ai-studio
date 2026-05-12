"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Application = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  course_interest: string | null;
  motivation: string | null;
  availability: string | null;
  status: "pending" | "approved" | "rejected" | "onboarded";
  reviewed_at: string | null;
  invite_sent_at: string | null;
  first_login_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<Application["status"], { label: string; cls: string }> = {
  pending: { label: "대기", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "승인", cls: "bg-blue-100 text-blue-800" },
  rejected: { label: "거부", cls: "bg-zinc-200 text-zinc-700" },
  onboarded: { label: "온보딩", cls: "bg-emerald-100 text-emerald-800" },
};

export default function ApplicationRow({ a }: { a: Application }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    if (busy) return;
    const note =
      action === "reject"
        ? window.prompt("거부 사유(선택, 빈 칸 가능):")?.slice(0, 500)
        : undefined;
    if (action === "reject" && note === undefined) return; // 사용자 취소

    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/beta/applications/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.detail ?? j.error ?? "실패");
        return;
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const meta = STATUS_LABEL[a.status];
  return (
    <tr className="border-b align-top">
      <td className="px-6 py-4">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${meta.cls}`}>
          {meta.label}
        </span>
      </td>
      <td className="py-4">
        <div className="font-semibold">{a.name}</div>
        <div className="text-xs text-muted-foreground font-mono">{a.email}</div>
        {a.phone && <div className="text-xs text-muted-foreground">{a.phone}</div>}
      </td>
      <td className="py-4 text-xs">{a.course_interest ?? "—"}</td>
      <td className="py-4 text-xs">{a.availability ?? "—"}</td>
      <td className="py-4 max-w-xs">
        <p className="text-xs leading-relaxed line-clamp-3">{a.motivation ?? "—"}</p>
      </td>
      <td className="py-4 text-xs font-mono whitespace-nowrap">
        {new Date(a.created_at).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 text-right">
        {a.status === "pending" ? (
          <div className="flex gap-2 justify-end">
            <button
              disabled={busy}
              onClick={() => act("approve")}
              className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700"
            >
              승인 + 초대
            </button>
            <button
              disabled={busy}
              onClick={() => act("reject")}
              className="px-3 py-1.5 text-xs rounded border border-zinc-300 disabled:opacity-50 hover:bg-zinc-100"
            >
              거부
            </button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            {a.reviewed_at ? new Date(a.reviewed_at).toLocaleDateString() : ""}
            {a.first_login_at && <div>가입 ✓</div>}
          </div>
        )}
        {err && <div className="text-xs text-red-600 mt-1">⚠️ {err}</div>}
      </td>
    </tr>
  );
}
