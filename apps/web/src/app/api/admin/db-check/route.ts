import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/db-check
 *
 * 마이그레이션 0001~0025가 모두 적용됐는지 한 번에 검증.
 * 각 테이블·핵심 컬럼·헬퍼 함수 존재 여부를 information_schema로 조회.
 *
 * 운영 시작 직전 본부장이 1회 호출 → 누락된 마이그레이션만 추려 적용.
 */
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "keg_super_admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();

  // 마이그레이션별 검증 항목 (테이블 이름 + 검증할 컬럼 1개)
  const checks: { name: string; migration: string; table: string; column?: string }[] = [
    { name: "profiles + role enum (sme/instructor)", migration: "0001,0022", table: "profiles", column: "onboarding_state" },
    { name: "studio_jobs + soft delete", migration: "0002,0004", table: "studio_jobs", column: "deleted_at" },
    { name: "cost_log", migration: "0002", table: "cost_log" },
    { name: "studio_jobs.agent_logs", migration: "0003", table: "studio_jobs", column: "agent_logs" },
    { name: "studio_jobs.model", migration: "0005", table: "studio_jobs", column: "model" },
    { name: "samples + sme_evaluations 3-axis", migration: "0006,0022", table: "sme_evaluations", column: "accuracy_score" },
    { name: "cast_jobs + quality_score + heygen_video_id", migration: "0007,0011,0012", table: "cast_jobs", column: "heygen_video_id" },
    { name: "cast_jobs deleted_at", migration: "0007", table: "cast_jobs", column: "deleted_at" },
    { name: "user_avatars", migration: "0010", table: "user_avatars" },
    { name: "rag_embeddings (pgvector)", migration: "0013", table: "rag_embeddings" },
    { name: "tutor_conversations", migration: "0014", table: "tutor_conversations" },
    { name: "tutor_understanding_alerts + admin_alerts", migration: "0015", table: "admin_alerts" },
    { name: "consent_log + deletion_scheduled_at", migration: "0016", table: "consent_log" },
    { name: "audit_log (보안)", migration: "0017", table: "audit_log" },
    { name: "cost_alerts + cost_overrides", migration: "0017", table: "cost_alerts" },
    { name: "perf indexes (0018)", migration: "0018", table: "studio_jobs", column: "user_id" }, // 인덱스는 직접 확인 어려움 — 컬럼 존재로 대체
    { name: "incidents", migration: "0019", table: "incidents" },
    { name: "beta_applications + learning_reminders_log", migration: "0020", table: "beta_applications" },
    { name: "kpi_metrics + student_feedback + support_tickets + content_reports + care_messages_log", migration: "0021", table: "kpi_metrics" },
    { name: "student_feedback", migration: "0021", table: "student_feedback" },
    { name: "support_tickets", migration: "0021", table: "support_tickets" },
    { name: "content_reports", migration: "0021", table: "content_reports" },
    { name: "care_messages_log", migration: "0021", table: "care_messages_log" },
    { name: "hypothesis_metrics + nps_responses + instructor_usage + sme_review_assignments", migration: "0022", table: "hypothesis_metrics" },
    { name: "nps_responses", migration: "0022", table: "nps_responses" },
    { name: "instructor_usage_reports", migration: "0022", table: "instructor_usage_reports" },
    { name: "content_remediation_queue", migration: "0023", table: "content_remediation_queue" },
    { name: "decision_log + retrospective_entries + beta_end_choices", migration: "0024", table: "decision_log" },
    { name: "retrospective_entries", migration: "0024", table: "retrospective_entries" },
    { name: "beta_end_choices", migration: "0024", table: "beta_end_choices" },
    { name: "course_category (Phase 3)", migration: "0026", table: "studio_jobs", column: "course_category" },
    { name: "role 6종 (W10)", migration: "0027", table: "profiles", column: "role" },
    { name: "student_enrollments (W11)", migration: "0028", table: "student_enrollments" },
    { name: "nps_responses.studio_job_id (W11)", migration: "0028", table: "nps_responses", column: "studio_job_id" },
    { name: "governance_reports (W12)", migration: "0029", table: "governance_reports" },
    { name: "team_activity_log (W12)", migration: "0029", table: "team_activity_log" },
    { name: "api_keys (v0.40)", migration: "0030", table: "api_keys", column: "key_prefix" },
    { name: "api_key_usage (v0.40)", migration: "0030", table: "api_key_usage" },
    { name: "instructor_metrics (W13)", migration: "0031", table: "instructor_metrics" },
    { name: "instructor_incentives (W13)", migration: "0031", table: "instructor_incentives" },
    { name: "instructor_content_proposals (W13)", migration: "0031", table: "instructor_content_proposals" },
    { name: "instructor_nps (W13)", migration: "0031", table: "instructor_nps" },
    { name: "instructor_community_posts (W13)", migration: "0031", table: "instructor_community_posts" },
    { name: "instructor_training_progress (W13)", migration: "0031", table: "instructor_training_progress" },
    { name: "g3_reports (W14)", migration: "0032", table: "g3_reports" },
    { name: "next_year_options (W14)", migration: "0032", table: "next_year_options" },
    { name: "g3_decisions (W14)", migration: "0032", table: "g3_decisions" },
    { name: "saas_assessment (W14)", migration: "0032", table: "saas_assessment" },
    { name: "revenue_scenarios (W14)", migration: "0032", table: "revenue_scenarios" },
    { name: "retrospective_final (W14)", migration: "0032", table: "retrospective_final" },
    { name: "beta_end_data_choices (W14)", migration: "0032", table: "beta_end_data_choices" },
    { name: "phase4_plans (W14)", migration: "0032", table: "phase4_plans" },
    { name: "studio_pro_jobs (v0.43)", migration: "0033", table: "studio_pro_jobs" },
    { name: "instructor_assets (v0.43)", migration: "0033", table: "instructor_assets" },
    { name: "tenants (Phase 4 PR-1)", migration: "0034", table: "tenants", column: "slug" },
    { name: "profiles.tenant_id (Phase 4 PR-1)", migration: "0034", table: "profiles", column: "tenant_id" },
    { name: "studio_jobs.tenant_id (Phase 4 PR-1)", migration: "0034", table: "studio_jobs", column: "tenant_id" },
    { name: "webhook_endpoints (W19)", migration: "0041", table: "webhook_endpoints", column: "secret" },
    { name: "webhook_deliveries (W19)", migration: "0041", table: "webhook_deliveries" },
    { name: "course_catalog (W21)", migration: "0042", table: "course_catalog", column: "migration_progress_pct" },
    { name: "referral_codes (W21)", migration: "0042", table: "referral_codes", column: "code" },
    { name: "instructor_recruitment (W21)", migration: "0042", table: "instructor_recruitment", column: "stage" },
    { name: "marketing_campaigns (W25)", migration: "0043", table: "marketing_campaigns", column: "channel" },
    { name: "sales_leads (W26)", migration: "0043", table: "sales_leads", column: "stage" },
    { name: "case_studies (W28)", migration: "0043", table: "case_studies", column: "published" },
    { name: "mrr_snapshots (W28)", migration: "0043", table: "mrr_snapshots", column: "period" },
    { name: "g4b_reports (W29)", migration: "0044", table: "g4b_reports" },
    { name: "g4b_decisions (W29)", migration: "0044", table: "g4b_decisions", column: "decision" },
    { name: "customer_checkins (W29)", migration: "0044", table: "customer_checkins", column: "checkin_type" },
    { name: "renewal_alerts (W29)", migration: "0044", table: "renewal_alerts", column: "alert_level" },
    { name: "departments (W31)", migration: "0045", table: "departments", column: "team_type" },
    { name: "team_members (W31)", migration: "0045", table: "team_members" },
    { name: "team_kpis (W31)", migration: "0045", table: "team_kpis", column: "metric_key" },
    { name: "pnl_snapshots (W31)", migration: "0045", table: "pnl_snapshots", column: "period" },
    { name: "hires (W31)", migration: "0045", table: "hires", column: "stage" },
  ];

  // 각 체크 — 1 row select로 존재 확인. 컬럼이 명시되면 그 컬럼도 select.
  const results = await Promise.all(
    checks.map(async (c) => {
      const cols = c.column ? `id, ${c.column}` : "id";
      const { error } = await admin.from(c.table).select(cols, { head: true, count: "exact" }).limit(1);
      if (!error) {
        return { ...c, ok: true as const };
      }
      // 42P01 = undefined_table, 42703 = undefined_column
      return {
        ...c,
        ok: false as const,
        error_code: error.code,
        detail: error.message.slice(0, 150),
      };
    }),
  );

  // 추가: is_admin() 헬퍼 함수 존재 검증
  const { error: rpcErr } = await admin.rpc("is_admin", { uid: user.id });
  const isAdminFn = !rpcErr || !/function.*does not exist/i.test(rpcErr.message);

  // Storage 버킷
  const { data: buckets } = await admin.storage.listBuckets();
  const bucketNames = new Set((buckets ?? []).map((b) => b.name));
  const expectedBuckets = ["cast-audio", "cast-video", "cast-captions", "studio-pptx", "cast-slide-images", "user-avatar-sources", "studio-pro-uploads", "instructor-photos", "instructor-voices"];
  const bucketCheck = expectedBuckets.map((name) => ({
    name,
    ok: bucketNames.has(name),
    public: (buckets ?? []).find((b) => b.name === name)?.public ?? false,
  }));

  const missing = results.filter((r) => !r.ok);
  const summary = {
    total_checks: results.length,
    passed: results.length - missing.length,
    failed: missing.length,
    is_admin_function: isAdminFn,
    overall: missing.length === 0 && isAdminFn && bucketCheck.every((b) => b.ok) ? "✅ all_good" : "⚠ missing_items",
  };

  return NextResponse.json(
    {
      summary,
      missing_migrations: missing.length > 0
        ? Array.from(new Set(missing.map((m) => m.migration).flatMap((mig) => mig.split(","))))
            .sort()
        : [],
      table_results: results,
      buckets: bucketCheck,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
