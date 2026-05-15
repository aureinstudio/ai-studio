"use client";

import { useRouter } from "next/navigation";

const STAGES = ["lead","qualified","demo","proposal","negotiation","closed_won","closed_lost"] as const;

export default function StageSelect({ id, currentStage }: { id: string; currentStage: string }) {
  const router = useRouter();
  async function change(e: React.ChangeEvent<HTMLSelectElement>) {
    const stage = e.target.value;
    await fetch(`/api/admin/sales-leads/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    router.refresh();
  }
  return (
    <select defaultValue={currentStage} onChange={change} className="w-full rounded border bg-white px-1 py-0.5 text-[10px]">
      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
