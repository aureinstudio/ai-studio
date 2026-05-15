export const metadata = { title: "ai-studio API 문서" };

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">ai-studio API</h1>
      <p className="mt-2 text-muted-foreground">
        외부 시스템에서 Studio·Cast·Tutor를 호출하기 위한 공개 API.
      </p>
      <div className="mt-4 rounded-md border-2 border-amber-300 bg-amber-50 p-4">
        <div className="font-semibold text-amber-900">⭐ v1 인터랙티브 문서 (Swagger UI)</div>
        <p className="mt-1 text-sm text-amber-800">
          OpenAPI 3.0 스펙 + try-it-out 기능 → <a href="/docs/api/v1" className="underline font-semibold">/docs/api/v1</a>
        </p>
        <p className="mt-1 text-xs text-amber-700">OpenAPI JSON: <a href="/api/v1/openapi.json" className="underline">/api/v1/openapi.json</a></p>
      </div>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold">1. 인증</h2>
        <p>모든 요청에 <code>Authorization: Bearer ak_live_…</code> 헤더를 포함합니다.</p>
        <p>키는 KEG 관리자가 <code>/admin/api-keys</code>에서 발급합니다. 평문 키는 발급 직후 1회만 표시됩니다.</p>
        <pre className="overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-100">{`curl https://ai-studio.example.com/api/studio/generate \\
  -H "Authorization: Bearer ak_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "content-type: application/json" \\
  -d '{ "topic": "React Hooks 입문", "course_category": "professional" }'`}</pre>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold">2. 제한</h2>
        <ul className="list-disc space-y-1 pl-6 text-sm">
          <li><b>Rate limit:</b> 키별 분당 호출수 (기본 60/min, 관리자가 조정).</li>
          <li><b>월 비용 한도:</b> 기본 $100/월. 초과 시 429 반환.</li>
          <li><b>Scopes:</b> <code>studio</code>, <code>cast</code>, <code>tutor</code> — 발급 시 선택.</li>
        </ul>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">3. 주요 엔드포인트</h2>

        <div className="rounded-md border p-4">
          <div className="font-mono text-sm"><b>POST</b> /api/studio/generate</div>
          <p className="mt-1 text-sm text-muted-foreground">교재·슬라이드·퀴즈 생성 (비동기 작업 ID 반환).</p>
          <pre className="mt-2 overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">{`{ "topic": "string", "course_category": "certification|professional|language|hobby|academic" }`}</pre>
        </div>

        <div className="rounded-md border p-4">
          <div className="font-mono text-sm"><b>POST</b> /api/cast/generate</div>
          <p className="mt-1 text-sm text-muted-foreground">PPT → 영상 변환 (avatar PIP 포함).</p>
          <pre className="mt-2 overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">{`{ "studio_job_id": "uuid", "avatar_id": "string" }`}</pre>
        </div>

        <div className="rounded-md border p-4">
          <div className="font-mono text-sm"><b>POST</b> /api/tutor/ask</div>
          <p className="mt-1 text-sm text-muted-foreground">1:1 AI 튜터 질의응답.</p>
          <pre className="mt-2 overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">{`{ "conversation_id": "uuid", "message": "string", "course_topic": "string" }`}</pre>
        </div>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold">4. 응답 코드</h2>
        <ul className="list-disc space-y-1 pl-6 text-sm">
          <li><code>200</code> — 성공</li>
          <li><code>401</code> — 키 누락·취소·잘못된 형식</li>
          <li><code>403</code> — scope 부족</li>
          <li><code>429</code> — rate limit 또는 월 비용 한도 초과</li>
          <li><code>500</code> — 서버 오류 (재시도 가능)</li>
        </ul>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold">5. 지원</h2>
        <p className="text-sm">계약·발급·한도 조정 문의: <a className="underline" href="mailto:aureinstudio@gmail.com">aureinstudio@gmail.com</a></p>
        <p className="text-xs text-muted-foreground">
          본 API는 단일-DB 격리(per-key user scoping) 단계입니다. 완전한 multi-tenant 격리(v0.50+ 예정)는 별도 안내됩니다.
        </p>
      </section>
    </div>
  );
}
