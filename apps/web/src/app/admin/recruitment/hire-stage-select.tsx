"use client";

import { useRouter } from "next/navigation";

const STAGES = ["sourcing","screening","interview","offer","onboarded","rejected","withdrew"] as const;

export default function HireStageSelect({ id, currentStage }: { id: string; currentStage: string }) {
  const router = useRouter();
  async function change(e: React.ChangeEvent<HTMLSelectElement>) {
    await fetch(`/api/admin/hires/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage: e.target.value }),
    });
    router.refresh();
  }
  return (
    <select defaultValue={currentStage} onChange={change} className="w-full rounded border bg-white px-1 py-0.5 text-[10px]">
      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
