import Link from "next/link";

export const metadata = { title: "Webhooks · ai-studio" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/docs" className="text-sm text-blue-600 hover:underline">← Docs</Link>
      <h1 className="mt-2 text-3xl font-bold">Webhooks</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Studio·Cast·Tutor 작업이 완료되면 등록된 URL로 POST 발송. HMAC SHA256 서명 검증 필수.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-bold">지원 이벤트</h2>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left">Event</th>
              <th className="px-3 py-2 text-left">언제</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b"><td className="px-3 py-2 font-mono">studio.completed</td><td className="px-3 py-2">Studio 콘텐츠 생성 완료</td></tr>
            <tr className="border-b"><td className="px-3 py-2 font-mono">studio.failed</td><td className="px-3 py-2">Studio 실패</td></tr>
            <tr className="border-b"><td className="px-3 py-2 font-mono">cast.completed</td><td className="px-3 py-2">Cast 영상 합성 완료</td></tr>
            <tr className="border-b"><td className="px-3 py-2 font-mono">cast.failed</td><td className="px-3 py-2">Cast 실패</td></tr>
            <tr className="border-b"><td className="px-3 py-2 font-mono">tutor.flagged</td><td className="px-3 py-2">Tutor 응답 부적절 감지 (환각·OFF_TOPIC 등)</td></tr>
          </tbody>
        </table>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-bold">요청 헤더</h2>
        <ul className="ml-4 list-disc space-y-1 text-sm">
          <li><code>X-AI-Studio-Event</code> — 이벤트 타입</li>
          <li><code>X-AI-Studio-Delivery</code> — UUID (재시도 중복 방지)</li>
          <li><code>X-AI-Studio-Timestamp</code> — Unix ms</li>
          <li><code>X-AI-Studio-Signature</code> — <code>t=&lt;ts&gt;,v1=&lt;HMAC-SHA256-hex&gt;</code></li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-bold">서명 검증 (Node.js)</h2>
        <pre className="overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-100">{`import crypto from "node:crypto";

app.post("/webhooks/ai-studio", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.header("X-AI-Studio-Signature") ?? "";
  const ts = req.header("X-AI-Studio-Timestamp") ?? "";
  const match = sig.match(/v1=([a-f0-9]+)/);
  if (!match) return res.status(400).send("no signature");

  const expected = crypto
    .createHmac("sha256", process.env.WEBHOOK_SECRET!)
    .update(\`\${ts}.\${req.body}\`)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(match[1]), Buffer.from(expected))) {
    return res.status(401).send("invalid signature");
  }

  // 5분 이상 지난 webhook은 거부 (replay 방지)
  if (Math.abs(Date.now() - Number(ts)) > 300_000) {
    return res.status(401).send("stale");
  }

  const event = JSON.parse(req.body.toString());
  switch (event.type) {
    case "studio.completed":
      // event.data.job_id, event.data.topic 등
      break;
  }
  res.sendStatus(200);
});`}</pre>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-bold">서명 검증 (Python)</h2>
        <pre className="overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-100">{`import hmac, hashlib, time
from fastapi import FastAPI, Request, HTTPException

@app.post("/webhooks/ai-studio")
async def webhook(req: Request):
    body = await req.body()
    sig = req.headers.get("X-AI-Studio-Signature", "")
    ts = req.headers.get("X-AI-Studio-Timestamp", "0")

    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        f"{ts}.{body.decode()}".encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(sig.split("v1=")[-1], expected):
        raise HTTPException(401, "invalid signature")

    if abs(int(time.time() * 1000) - int(ts)) > 300_000:
        raise HTTPException(401, "stale")

    # event 처리`}</pre>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-bold">재시도 정책</h2>
        <p className="text-sm">
          2xx 응답 받을 때까지 재시도. backoff: 1분 → 5분 → 30분 → 2시간 → 12시간 → 24시간 (총 6회). 그 후 포기.
        </p>
      </section>

      <section className="mt-8 rounded-lg border bg-card p-6">
        <h2 className="mb-2 font-bold">Webhook 등록</h2>
        <p className="text-sm text-muted-foreground">
          현재 Phase 4 PR-A: webhook_endpoints는 SQL로 직접 등록. 관리 UI는 후속 PR에서 제공 예정.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">{`INSERT INTO webhook_endpoints (tenant_id, url, events, secret)
VALUES (
  '<tenant_uuid>',
  'https://your-lms.example.com/webhooks/ai-studio',
  '["studio.completed", "cast.completed"]'::jsonb,
  'whsec_' || encode(gen_random_bytes(24), 'hex')
);`}</pre>
      </section>
    </div>
  );
}
