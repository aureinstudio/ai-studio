import Link from "next/link";

export const metadata = { title: "ai-studio Docs" };

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-bold">ai-studio 문서</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          B2B 통합을 위한 공개 API · SDK · 가이드.
        </p>
      </header>

      <section className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2">
        <DocCard
          href="/docs/getting-started"
          title="🚀 Getting Started"
          desc="5분 만에 첫 API 호출 — Studio 작업 생성부터 결과 받기까지"
        />
        <DocCard
          href="/docs/api/v1"
          title="📖 API Reference"
          desc="OpenAPI 3.0 인터랙티브 문서 (Swagger UI · Try it out)"
        />
        <DocCard
          href="/docs/integrations/lms"
          title="🔌 LMS 통합 가이드"
          desc="Moodle · Canvas · 자체 LMS와 ai-studio 연결 패턴 + 코드 예시"
        />
        <DocCard
          href="/docs/webhooks"
          title="🔔 Webhooks"
          desc="이벤트 구독 (studio.completed 등) · HMAC SHA256 검증"
        />
      </section>

      <section className="mb-12 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-2xl font-bold">SDK</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 font-semibold">TypeScript / JavaScript</div>
            <pre className="overflow-x-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">{`npm install @ai-studio/sdk

import { AiStudio } from "@ai-studio/sdk";
const client = new AiStudio({ apiKey: "ak_live_..." });
const job = await client.studio.create({ topic: "..." });`}</pre>
          </div>
          <div>
            <div className="mb-2 font-semibold">Python</div>
            <pre className="overflow-x-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">{`pip install ai-studio

from ai_studio import AiStudio
client = AiStudio(api_key="ak_live_...")
job = client.studio.create(topic="...")`}</pre>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold">핵심 개념</h2>
        <dl className="space-y-3 text-sm">
          <ConceptRow term="API Key" desc="ak_live_<32hex> 형식. KEG admin이 발급. 1회만 노출 (즉시 저장)." />
          <ConceptRow term="Tenant" desc="고객사 단위 격리. 본인 테넌트 데이터만 접근 가능." />
          <ConceptRow term="Scope" desc="키별 권한 (studio:read, tutor:write 등). admin 키는 자동 우회." />
          <ConceptRow term="Rate Limit" desc="키별 분당 호출수 + 월 비용 한도. 초과 시 429." />
          <ConceptRow term="Webhook" desc="이벤트 발생 시 등록된 URL로 POST. HMAC SHA256 서명 검증 필수." />
        </dl>
      </section>

      <section className="rounded-lg border bg-amber-50 p-6">
        <h2 className="mb-2 text-lg font-bold text-amber-900">지원</h2>
        <p className="text-sm">
          기술 문의 · 키 발급 · 한도 조정: <a className="underline" href="mailto:aureinstudio@gmail.com">aureinstudio@gmail.com</a>
        </p>
      </section>
    </div>
  );
}

function DocCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="text-lg font-semibold">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}

function ConceptRow({ term, desc }: { term: string; desc: string }) {
  return (
    <div className="flex gap-4 rounded-md border bg-card p-3">
      <dt className="w-32 shrink-0 font-mono text-xs font-semibold">{term}</dt>
      <dd className="text-muted-foreground">{desc}</dd>
    </div>
  );
}
