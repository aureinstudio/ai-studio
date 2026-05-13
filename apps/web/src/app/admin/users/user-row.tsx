"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "user" | "admin" | "sme" | "instructor" | "operations" | "creator";

const ROLE_LABEL: Record<Role, string> = {
  user: "학생",
  admin: "관리자",
  sme: "SME",
  instructor: "강사",
  operations: "운영팀",
  creator: "콘텐츠 제작",
};

const ROLE_CLS: Record<Role, string> = {
  user: "bg-zinc-100 text-zinc-700",
  admin: "bg-red-100 text-red-700",
  sme: "bg-purple-100 text-purple-700",
  instructor: "bg-blue-100 text-blue-700",
  operations: "bg-emerald-100 text-emerald-700",
  creator: "bg-amber-100 text-amber-700",
};

export default function UserRow({
  user,
  isSelf,
}: {
  user: { id: string; email: string; name: string | null; role: Role; last_seen_at: string | null };
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<Role>(user.role);

  async function changeRole(next: Role) {
    if (next === currentRole) return;
    if (isSelf && next !== "admin") {
      setErr("본인 admin 강등 불가");
      return;
    }
    if (!confirm(`${user.email}의 역할을 ${ROLE_LABEL[next]}로 변경합니다.`)) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.message ?? j.detail ?? j.error ?? "실패");
        return;
      }
      setCurrentRole(next);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-6 py-3 font-mono text-xs">
        {user.email}
        {isSelf && <span className="ml-2 text-[10px] text-blue-600">(본인)</span>}
      </td>
      <td className="py-3 text-sm">{user.name ?? "—"}</td>
      <td className="py-3">
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${ROLE_CLS[currentRole]}`}>
          {ROLE_LABEL[currentRole]}
        </span>
      </td>
      <td className="py-3 text-xs text-muted-foreground font-mono">
        {user.last_seen_at ? new Date(user.last_seen_at).toLocaleDateString() : "—"}
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          <select
            value={currentRole}
            onChange={(e) => changeRole(e.target.value as Role)}
            disabled={busy}
            className="text-xs px-2 py-1 border rounded bg-background"
          >
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]} ({r})</option>
            ))}
          </select>
          {busy && <span className="text-xs text-muted-foreground">변경 중…</span>}
          {err && <span className="text-xs text-red-600">⚠ {err}</span>}
        </div>
      </td>
    </tr>
  );
}
