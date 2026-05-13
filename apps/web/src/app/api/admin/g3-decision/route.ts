import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = new Set(["expand", "deepen", "saas", "stop"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { selected_option, rationale, next_quarter_actions } = body;
  if (!VALID.has(selected_option)) return NextResponse.json({ error: "invalid option" }, { status: 400 });
  if (!rationale?.trim()) return NextResponse.json({ error: "rationale required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: decision, error } = await admin
    .from("g3_decisions")
    .insert({
      selected_option,
      rationale: rationale.toString().slice(0, 5000),
      next_quarter_actions: next_quarter_actions?.toString().slice(0, 10000) ?? null,
      decided_by: user.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Phase 4 초안 자동 생성 (GO 옵션일 때만)
  if (selected_option !== "stop") {
    await admin.from("phase4_plans").insert({
      decision_id: decision.id,
      business_plan_md: buildBusinessPlanTemplate(selected_option, rationale, next_quarter_actions ?? ""),
      budget_md: buildBudgetTemplate(selected_option),
      hiring_jds_md: buildHiringTemplate(selected_option),
      marketing_md: buildMarketingTemplate(selected_option),
      created_by: user.id,
    });
  }

  return NextResponse.json({ ok: true, decision_id: decision.id });
}

function buildBusinessPlanTemplate(option: string, rationale: string, actions: string): string {
  return `# Phase 4 차년도 사업 계획서 (초안)

## 선택 옵션
**${option.toUpperCase()}**

## 의사결정 사유
${rationale}

## 차년도 액션 플랜
${actions || "(미작성)"}

## 다음 단계 (자동 생성 — 본부장 검토 후 확정)
- [ ] 임원진 보고
- [ ] 예산 신청서 확정 (별도 문서)
- [ ] 인력 채용 JD 확정 (별도 문서)
- [ ] 마케팅 캠페인 계획 확정 (별도 문서)
- [ ] 분기별 마일스톤 설정
- [ ] KPI 재정의

> 이 문서는 G3 결정 시점 자동 초안입니다. /admin/g3-final-report 데이터로 보강하여 사업 계획 v1으로 확정하세요.
`;
}

function buildBudgetTemplate(option: string): string {
  const budgets: Record<string, string> = {
    expand: "## 예산 (EXPAND)\n- 인건비: ₩5억 (8명 × 12개월)\n- 인프라/AI API: ₩1.5억\n- 마케팅: ₩1억\n- 운영비: ₩0.5억\n- **Total: ₩8억**",
    deepen: "## 예산 (DEEPEN)\n- 인건비: ₩1.5억 (2명 × 12개월)\n- 인프라/AI API: ₩0.3억\n- 운영비: ₩0.2억\n- **Total: ₩2억**",
    saas: "## 예산 (SAAS)\n- 인건비: ₩3억 (5명 — 영업/CS/엔지니어)\n- 인프라/멀티-테넌트 구축: ₩1억\n- 영업·마케팅: ₩1억\n- **Total: ₩5억**",
  };
  return budgets[option] ?? "## 예산\n- (옵션별 산정)";
}

function buildHiringTemplate(option: string): string {
  const hiring: Record<string, string> = {
    expand: "## 채용 JD (EXPAND)\n1. AI 엔지니어 1명\n2. 강사 3명 (직무·언어·취미 영역)\n3. 운영팀 2명\n4. SME 1명 (학술)\n5. 콘텐츠 PM 1명",
    deepen: "## 채용 JD (DEEPEN)\n1. 강사 1명 (보강)\n2. 운영팀 1명",
    saas: "## 채용 JD (SAAS)\n1. B2B 세일즈 리더 1명\n2. 솔루션 엔지니어 1명\n3. CS 매니저 1명\n4. 통합 엔지니어 (멀티-테넌트) 2명",
  };
  return hiring[option] ?? "## 채용\n- (옵션별 산정)";
}

function buildMarketingTemplate(option: string): string {
  const mkt: Record<string, string> = {
    expand: "## 마케팅 (EXPAND)\n- 채널: 검색·SNS·교육 박람회\n- 캠페인: 무료 체험 30일 + 자격증 합격 보장\n- 목표: 1년 1,000명 신규 수강",
    deepen: "## 마케팅 (DEEPEN)\n- 채널: 기존 KEG 채널 활용\n- 캠페인: 만족도 후기 기반 콘텐츠 마케팅\n- 목표: 500명 안정 유지",
    saas: "## 마케팅 (SAAS)\n- 채널: 교육 컨퍼런스·아웃바운드\n- 캠페인: 6개월 무료 PoC + 케이스 스터디\n- 목표: 1년 5~10개 교육기관 확보",
  };
  return mkt[option] ?? "## 마케팅\n- (옵션별 산정)";
}
