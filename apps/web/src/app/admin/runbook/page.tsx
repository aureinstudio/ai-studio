import Link from "next/link";
import { redirect } from "next/navigation";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const DOCS: { slug: string; title: string; emoji: string; desc: string }[] = [
  { slug: "daily-ops", title: "일상 운영", emoji: "🌅", desc: "매일 15분 체크리스트" },
  { slug: "student-management", title: "학생 관리", emoji: "🎓", desc: "신규·위험·NPS·삭제 요청" },
  { slug: "content-management", title: "콘텐츠 관리", emoji: "📚", desc: "Studio 생성·SME 검토·보완 큐" },
  { slug: "incident-response", title: "인시던트 대응", emoji: "🚨", desc: "L1~L4 표준 절차" },
  { slug: "cost-management", title: "비용 관리", emoji: "💰", desc: "임계·차단·플랜 업그레이드" },
  { slug: "analytics", title: "데이터 분석", emoji: "📊", desc: "KPI 페이지·SQL 쿼리·내보내기" },
  { slug: "delegation-checklist", title: "위임 체크리스트", emoji: "📋", desc: "본부장 vs 위임 가능" },
];

function loadDoc(slug: string): string | null {
  const path = join(process.cwd(), "..", "..", "docs", "runbook", `${slug}.md`);
  const altPath = join(process.cwd(), "docs", "runbook", `${slug}.md`);
  for (const p of [path, altPath]) {
    if (existsSync(p)) {
      try {
        return readFileSync(p, "utf-8");
      } catch {}
    }
  }
  return null;
}

/**
 * 매우 소박한 markdown → HTML 변환 (외부 의존성 없음).
 * # → h1, ## → h2, ### → h3, - → li, `code`, **bold**, [link](url), table.
 * 운영 문서용으로 충분. 복잡 markdown은 ReactMarkdown 도입 시 교체.
 */
function renderMarkdown(md: string): string {
  let html = md;
  // escape
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // code fence
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, body) =>
    `<pre class="my-3 rounded bg-muted p-3 text-xs font-mono overflow-x-auto"><code>${body}</code></pre>`,
  );
  // headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-5 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-7 mb-3 border-b pb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-4">$1</h1>');
  // tables — 간단 처리 (header | --- | row)
  html = html.replace(/(?:^\|.+\|\n)+/gm, (block) => {
    const rows = block.trim().split("\n").map((r) => r.split("|").slice(1, -1).map((c) => c.trim()));
    if (rows.length < 2) return block;
    const isSep = (row: string[]) => row.every((c) => /^-+$/.test(c.trim()));
    const header = rows[0];
    const data = rows.slice(isSep(rows[1]) ? 2 : 1);
    const th = header.map((c) => `<th class="border-b p-2 text-left font-semibold">${c}</th>`).join("");
    const trs = data.map((r) =>
      `<tr>${r.map((c) => `<td class="border-b p-2 align-top">${c}</td>`).join("")}</tr>`,
    ).join("");
    return `<table class="my-4 w-full text-sm border-collapse"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
  });
  // lists
  html = html.replace(/^(\s*)- (.+)$/gm, '$1<li class="my-1">$2</li>');
  html = html.replace(/(<li.*<\/li>\n?)+/g, (m) => `<ul class="list-disc pl-6 my-3 space-y-1">${m}</ul>`);
  // ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="my-1">$1</li>');
  // bold + code + links
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-xs font-mono">$1</code>');
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-blue-600 hover:underline">$1</a>',
  );
  // blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-muted pl-3 my-2 text-muted-foreground italic">$1</blockquote>');
  // paragraphs (lines not in tags)
  html = html.replace(/^(?!<|\s*$)(.+)$/gm, '<p class="my-2 leading-relaxed">$1</p>');
  return html;
}

export default async function RunbookPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/runbook");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "operations", "instructor", "sme"].includes(profile.role)) {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-semibold">접근 불가</h1></div>;
  }

  const params = await searchParams;
  const selected = params.doc ? DOCS.find((d) => d.slug === params.doc) ?? null : null;
  const content = selected ? loadDoc(selected.slug) : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* 사이드바 */}
      <aside className="space-y-3">
        <Link href="/admin" className="text-xs text-muted-foreground hover:underline">← 관리자 홈</Link>
        <h1 className="text-xl font-bold">운영 매뉴얼</h1>
        <p className="text-xs text-muted-foreground">자가 학습용 — 본부장 직접 처리 비율 ↓ 목표</p>
        <nav className="space-y-1 mt-4">
          {DOCS.map((d) => (
            <Link
              key={d.slug}
              href={`/admin/runbook?doc=${d.slug}`}
              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                selected?.slug === d.slug
                  ? "bg-foreground text-background"
                  : "hover:bg-muted"
              }`}
            >
              <span className="mr-2">{d.emoji}</span>
              <span className="font-medium">{d.title}</span>
              <span className={`block text-[10px] ${selected?.slug === d.slug ? "text-background/70" : "text-muted-foreground"}`}>
                {d.desc}
              </span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* 본문 */}
      <main>
        {!selected ? (
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-lg font-semibold mb-2">왼쪽에서 매뉴얼을 선택하세요</h2>
              <p className="text-sm text-muted-foreground">
                7개 문서로 구성. 신규 운영팀·강사·SME가 본부장 도움 없이 일상 업무 가능하도록 설계.
              </p>
            </CardContent>
          </Card>
        ) : content === null ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              문서 파일을 찾을 수 없습니다: <code>docs/runbook/{selected.slug}.md</code>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8">
              <article
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
