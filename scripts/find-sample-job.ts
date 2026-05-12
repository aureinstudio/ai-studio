/**
 * 부하 테스트용 sample studio_job_id 탐색.
 * is_sample=true + status=completed + rag_embeddings 인덱싱된 것 선호.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: jobs } = await admin
    .from("studio_jobs")
    .select("id, topic, is_sample, status")
    .eq("status", "completed")
    .order("is_sample", { ascending: false })
    .limit(10);

  console.log("Top 10 completed jobs:");
  for (const j of jobs ?? []) {
    const { count } = await admin
      .from("rag_embeddings")
      .select("*", { count: "exact", head: true })
      .eq("studio_job_id", j.id);
    console.log(`  ${j.id} · sample=${j.is_sample} · rag=${count ?? 0} · "${j.topic?.slice(0, 50)}"`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
