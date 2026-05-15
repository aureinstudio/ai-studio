import Link from "next/link";

export const metadata = { title: "Getting Started · ai-studio" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/docs" className="text-sm text-blue-600 hover:underline">← Docs</Link>
      <h1 className="mt-2 text-3xl font-bold">5분 Getting Started</h1>

      <Step n={1} title="API 키 발급">
        <p className="text-sm text-muted-foreground">
          KEG admin에게 발급 요청. 형식: <code>ak_live_&lt;32-hex&gt;</code>. <b>발급 즉시 저장</b> — 다시 표시되지 않음.
        </p>
      </Step>

      <Step n={2} title="간단 호출 — Tutor 한 줄 질문">
        <Tabs
          curl={`curl https://ai-studio-drab-nine.vercel.app/api/v1/tutor/ask \\
  -H "Authorization: Bearer ak_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"message":"What is React Hooks?"}'`}
          js={`import { AiStudio } from "@ai-studio/sdk";
const client = new AiStudio({ apiKey: "ak_live_..." });
const reply = await client.tutor.ask({ message: "What is React Hooks?" });
console.log(reply.answer);`}
          py={`from ai_studio import AiStudio
client = AiStudio(api_key="ak_live_...")
reply = client.tutor.ask(message="What is React Hooks?")
print(reply["answer"])`}
        />
      </Step>

      <Step n={3} title="비동기 Studio 작업 + 폴링">
        <Tabs
          curl={`# 1) 작업 생성 (즉시 job_id 반환)
curl -X POST https://ai-studio-drab-nine.vercel.app/api/v1/studio/jobs \\
  -H "Authorization: Bearer ak_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"topic":"React Hooks intro","level":"intermediate"}'

# 2) 30초~몇 분 후 상태 조회
curl https://ai-studio-drab-nine.vercel.app/api/v1/studio/jobs/<JOB_ID> \\
  -H "Authorization: Bearer ak_live_..."`}
          js={`const job = await client.studio.create({
  topic: "React Hooks intro",
  level: "intermediate",
});

// SDK 가 자동 폴링 (최대 10분)
const result = await client.studio.wait(job.job_id);
console.log(result.content);`}
          py={`job = client.studio.create(topic="React Hooks intro", level="intermediate")
result = client.studio.wait(job["job_id"])
print(result["content"])`}
        />
      </Step>

      <Step n={4} title="응답 처리 · 에러">
        <p className="text-sm">주요 HTTP 코드:</p>
        <ul className="ml-4 mt-1 list-disc text-sm space-y-1">
          <li><code>200/201</code> — 성공</li>
          <li><code>401</code> — 키 누락/잘못된 형식</li>
          <li><code>403</code> — scope 부족 (관리자에게 키 권한 확인)</li>
          <li><code>404</code> — 다른 테넌트 리소스 또는 미존재</li>
          <li><code>429</code> — rate limit 또는 월 비용 한도 초과 (Retry-After 헤더 참고)</li>
          <li><code>5xx</code> — 서버 오류 (재시도 가능)</li>
        </ul>
      </Step>

      <Step n={5} title="다음 단계">
        <ul className="ml-4 list-disc text-sm space-y-1">
          <li><Link className="text-blue-600 hover:underline" href="/docs/api/v1">전체 API Reference (Swagger UI)</Link></li>
          <li><Link className="text-blue-600 hover:underline" href="/docs/integrations/lms">LMS 통합 가이드</Link></li>
          <li><Link className="text-blue-600 hover:underline" href="/docs/webhooks">Webhooks 설정</Link></li>
        </ul>
      </Step>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">{n}</span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="ml-10">{children}</div>
    </section>
  );
}

function Tabs({ curl, js, py }: { curl: string; js: string; py: string }) {
  return (
    <div className="mt-3 space-y-3">
      <CodeBlock lang="bash" label="curl">{curl}</CodeBlock>
      <CodeBlock lang="ts" label="TypeScript SDK">{js}</CodeBlock>
      <CodeBlock lang="py" label="Python SDK">{py}</CodeBlock>
    </div>
  );
}

function CodeBlock({ lang, label, children }: { lang: string; label: string; children: string }) {
  return (
    <details className="rounded-md border">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">{label}</summary>
      <pre className="overflow-x-auto bg-zinc-900 p-3 text-xs text-zinc-100"><code className={`lang-${lang}`}>{children}</code></pre>
    </details>
  );
}
