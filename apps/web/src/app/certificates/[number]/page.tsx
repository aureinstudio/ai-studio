import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const admin = createAdminClient();
  const { data: cert } = await admin
    .from("certificates")
    .select("*")
    .eq("certificate_number", number)
    .maybeSingle();

  if (!cert) notFound();

  return (
    <div className="min-h-screen bg-zinc-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto flex max-w-4xl flex-col items-end px-6 print:hidden">
        <PrintButton />
      </div>

      {/* 인증서 본문 — A4 가로 (1123×794) */}
      <div className="mx-auto mt-4 max-w-4xl bg-white shadow-xl print:shadow-none" style={{ width: "297mm", minHeight: "210mm", padding: "30mm 25mm" }}>
        <div className="border-8 border-double border-amber-700 p-12">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-amber-700">Certificate of Completion</div>
            <h1 className="mt-4 text-5xl font-bold tracking-tight">수료증</h1>
            <div className="mt-2 text-sm text-muted-foreground">Certificate · {cert.certificate_number}</div>
          </div>

          <div className="mt-16 text-center">
            <p className="text-lg">아래의 과정을 성공적으로 이수하였기에 이 증서를 수여합니다.</p>
            <div className="mt-12 text-4xl font-bold">{cert.student_name}</div>
            <div className="mt-2 text-sm text-muted-foreground">수강생</div>

            <div className="mt-12 inline-block border-y border-zinc-300 py-4 px-12">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">과정</div>
              <div className="mt-1 text-2xl font-semibold">{cert.course_name}</div>
              {cert.course_category && <div className="mt-1 text-sm text-muted-foreground">{cert.course_category}</div>}
            </div>

            {cert.score !== null && (
              <div className="mt-8">
                <span className="text-sm text-muted-foreground">최종 점수: </span>
                <span className="font-bold">{Number(cert.score).toFixed(1)} / 100</span>
              </div>
            )}
          </div>

          <div className="mt-16 flex items-end justify-between">
            <div>
              <div className="text-xs text-muted-foreground">발급일</div>
              <div className="text-lg font-semibold">{new Date(cert.issued_at).toLocaleDateString("ko-KR")}</div>
              {cert.completion_date && (
                <>
                  <div className="mt-2 text-xs text-muted-foreground">수료일</div>
                  <div>{new Date(cert.completion_date).toLocaleDateString("ko-KR")}</div>
                </>
              )}
            </div>
            <div className="text-right">
              <div className="border-t-2 border-zinc-800 pt-2 text-sm">KEG · Korean Education Group</div>
              <div className="text-xs text-muted-foreground">대표 김영우</div>
              <div className="mt-3 text-[10px] text-muted-foreground">
                인증 확인: /certificates/{cert.certificate_number}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
