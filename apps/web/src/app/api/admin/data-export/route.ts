import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

const ALLOWED = new Set([
  "kpi_metrics",
  "hypothesis_metrics",
  "cost_log",
  "sme_evaluations",
  "nps_responses",
  "student_feedback",
  "incidents",
]);

// 익명화 대상 컬럼
const PII_COLUMNS = new Set(["user_id", "student_id", "evaluator_id", "decided_by", "author_id"]);

function hashId(v: unknown): string {
  if (typeof v !== "string") return "";
  return createHash("sha256").update(v).digest("hex").slice(0, 16);
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escapeCell = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escapeCell(r[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const dataset = sp.get("dataset") ?? "";
  const format = sp.get("format") === "json" ? "json" : "csv";
  if (!ALLOWED.has(dataset)) {
    return NextResponse.json({ error: "invalid_dataset" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from(dataset).select("*").limit(50000);
  if (error) return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });

  // 익명화
  const anonymized = (data ?? []).map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (PII_COLUMNS.has(k) && v) out[k] = hashId(v);
      else out[k] = v;
    }
    return out;
  });

  const filename = `${dataset}-${new Date().toISOString().slice(0, 10)}.${format}`;
  if (format === "json") {
    return new NextResponse(JSON.stringify(anonymized, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
  return new NextResponse(toCsv(anonymized), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
