import { createClient } from "@/lib/supabase/server";

// 매 요청마다 새로 측정 — 정적 캐싱 비활성화
export const dynamic = "force-dynamic";

type HealthStatus = {
  ok: boolean;
  latency_ms: number;
  message: string;
  detail?: string;
};

async function checkSupabase(): Promise<HealthStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      ok: false,
      latency_ms: 0,
      message: "환경변수 미설정",
      detail: "NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY 누락",
    };
  }

  const start = performance.now();
  try {
    const supabase = await createClient();
    // auth.getSession은 DB 스키마 없이도 작동 — 가장 가벼운 connectivity 테스트
    const { error } = await supabase.auth.getSession();
    const latency = Math.round(performance.now() - start);

    if (error) {
      return {
        ok: false,
        latency_ms: latency,
        message: "API 응답 받았으나 오류",
        detail: error.message,
      };
    }
    return {
      ok: true,
      latency_ms: latency,
      message: "Supabase 연결 정상",
    };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    return {
      ok: false,
      latency_ms: latency,
      message: "연결 실패",
      detail: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function maskUrl(url: string | undefined): string {
  if (!url) return "(미설정)";
  // https://abc123.supabase.co → https://abc***.supabase.co
  return url.replace(/(https:\/\/)([a-z0-9]{3})[a-z0-9]+(\.supabase\.co)/, "$1$2***$3");
}

export default async function HealthPage() {
  const supabaseStatus = await checkSupabase();
  const checkedAt = new Date().toISOString();

  return (
    <div className="mx-auto max-w-3xl px-6 py-20 lg:px-10 lg:py-28">
      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          System Health
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          연결 상태
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          ai-studio 인프라 의존성 헬스체크 — {checkedAt}
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6 border-b border-border/40 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  supabaseStatus.ok ? "bg-emerald-400" : "bg-red-400"
                } ${supabaseStatus.ok ? "animate-pulse" : ""}`}
              />
              <h2 className="text-lg font-semibold text-foreground">Supabase</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  supabaseStatus.ok
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-red-500/10 text-red-300"
                }`}
              >
                {supabaseStatus.ok ? "OK" : "FAIL"}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{supabaseStatus.message}</p>
            {supabaseStatus.detail && (
              <p className="mt-1 font-mono text-xs text-muted-foreground/70">
                {supabaseStatus.detail}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {supabaseStatus.latency_ms}
              <span className="ml-0.5 text-sm font-normal text-muted-foreground">ms</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">round-trip</p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">
              Project URL
            </dt>
            <dd className="mt-1 break-all font-mono text-xs text-foreground/80">
              {maskUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">
              Anon Key
            </dt>
            <dd className="mt-1 font-mono text-xs text-foreground/80">
              {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(0, 18)}***`
                : "(미설정)"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">
              Service Role
            </dt>
            <dd className="mt-1 font-mono text-xs text-foreground/80">
              {process.env.SUPABASE_SERVICE_ROLE_KEY ? "✓ 설정됨 (서버 전용)" : "(미설정)"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">
              Environment
            </dt>
            <dd className="mt-1 font-mono text-xs text-foreground/80">
              {process.env.VERCEL_ENV ?? process.env.NODE_ENV}
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground/60">
        이 페이지는 매 요청마다 실시간 측정. 캐싱 없음.
      </p>
    </div>
  );
}
