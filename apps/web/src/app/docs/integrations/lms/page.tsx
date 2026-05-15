import Link from "next/link";

export const metadata = { title: "LMS Integration · ai-studio" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/docs" className="text-sm text-blue-600 hover:underline">← Docs</Link>
      <h1 className="mt-2 text-3xl font-bold">LMS 통합 가이드</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Moodle · Canvas · 자체 LMS에서 ai-studio를 백엔드로 사용하는 표준 패턴.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-bold">통합 아키텍처</h2>
        <pre className="overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-100">{`┌──────────────┐         ┌────────────────┐
│   LMS UI     │         │   ai-studio    │
│ (Moodle 등)  │         │   Public API   │
└──────┬───────┘         └────────┬───────┘
       │                          │
       │ 1. 강의 콘텐츠 요청        │
       ├─────────────────────────▶│ POST /v1/studio/jobs
       │                          │ → job_id
       │                          │
       │ 2. 학생 질문              │
       ├─────────────────────────▶│ POST /v1/tutor/ask
       │  ◀───────────────────────│ ← answer
       │                          │
       │ 3. (이벤트 알림 webhook)    │
       │  ◀─────────────────────  │ studio.completed → LMS 콘텐츠 등록
       └──                       ──┘`}</pre>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-bold">패턴 A: 콘텐츠 자동 생성</h2>
        <p className="text-sm">LMS에서 "AI 강의 생성" 버튼 → ai-studio 호출 → 생성된 콘텐츠 LMS DB에 저장.</p>
        <pre className="overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-100">{`// 1. LMS 백엔드에서 ai-studio SDK 사용
import { AiStudio } from "@ai-studio/sdk";
const client = new AiStudio({ apiKey: process.env.AI_STUDIO_KEY! });

// 2. 강사가 토픽 입력
const job = await client.studio.create({
  topic: req.body.topic,
  level: req.body.level,
  course_category: "professional",
});

// 3. 작업 ID + webhook으로 비동기 완료 알림
await db.lessons.insert({
  lms_lesson_id: req.params.lessonId,
  studio_job_id: job.job_id,
  status: "generating",
});

// 4. Webhook 핸들러 (별도 endpoint)
//    POST /webhooks/ai-studio
//    headers: X-AI-Studio-Event: studio.completed
app.post("/webhooks/ai-studio", async (req, res) => {
  const event = req.body;
  if (event.type === "studio.completed") {
    const job = await client.studio.get(event.data.job_id);
    await db.lessons.update({ studio_job_id: event.data.job_id }, {
      content: job.content,
      status: "ready",
    });
  }
  res.sendStatus(200);
});`}</pre>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-bold">패턴 B: 학생 AI 튜터 임베드</h2>
        <p className="text-sm">LMS 강의 페이지에서 학생이 질문 → ai-studio Tutor 동기 호출 → 답변 표시.</p>
        <pre className="overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-100">{`// LMS 프론트엔드 (강의 페이지 사이드바)
// ⚠ API 키를 절대 프론트엔드에 노출하지 말 것.
//   LMS 백엔드를 proxy로 사용:

// /api/lms/tutor (LMS 백엔드)
app.post("/api/lms/tutor", authenticateStudent, async (req, res) => {
  const reply = await client.tutor.ask({
    message: req.body.question,
    course_topic: req.body.lessonTitle,
  });
  res.json(reply);
});

// 프론트엔드
const reply = await fetch("/api/lms/tutor", {
  method: "POST",
  body: JSON.stringify({ question, lessonTitle }),
}).then((r) => r.json());`}</pre>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-bold">패턴 C: 학생 진척 데이터 동기화</h2>
        <p className="text-sm">매일 cron으로 ai-studio analytics를 가져와 LMS 분석 화면에 표시.</p>
        <pre className="overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-100">{`// Daily cron
const stats = await client.analytics.get({ days: 1 });
await lmsAnalyticsDB.insert({
  date: today,
  students: stats.students,
  studio_jobs: stats.studio_jobs,
  tutor_conversations: stats.tutor_conversations,
});`}</pre>
      </section>

      <section className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-6">
        <h2 className="mb-2 font-bold text-amber-900">⚠ 보안 가이드</h2>
        <ul className="ml-4 list-disc space-y-1 text-sm">
          <li>API 키는 LMS 백엔드 환경변수에만 저장. 프론트엔드·git에 절대 노출 X.</li>
          <li>Webhook 받을 때 <code>X-AI-Studio-Signature</code>로 HMAC SHA256 검증 필수.</li>
          <li>Rate limit (Starter 60/min) 초과 시 LMS측 queue로 backoff.</li>
          <li>학생 PII가 들어가는 ask 메시지는 sanitize 후 전달.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Moodle 플러그인</h2>
        <p className="text-sm">
          Moodle은 Activity Module로 별도 플러그인 작성 가능. PHP에서 HTTP 호출:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-100">{`$ch = curl_init('https://ai-studio-drab-nine.vercel.app/api/v1/studio/jobs');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . AI_STUDIO_KEY,
    'Content-Type: application/json',
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'topic' => $topic,
    'level' => $level,
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = json_decode(curl_exec($ch), true);
$job_id = $response['job_id'];`}</pre>
      </section>

      <section className="mt-8 rounded-md border bg-card p-4 text-xs text-muted-foreground">
        <h3 className="mb-1 font-semibold">Canvas LTI</h3>
        <p>
          Canvas는 LTI 1.3 표준 지원. Custom Tool로 등록 후 deep linking 시 ai-studio에서 콘텐츠 생성 후 Canvas course에 자동 추가. 상세 가이드는 별도 요청 시 제공.
        </p>
      </section>
    </div>
  );
}
