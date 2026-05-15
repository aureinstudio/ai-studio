# @ai-studio/sdk

Official TypeScript / JavaScript SDK for the **ai-studio Public API**.

## Install

```bash
npm install @ai-studio/sdk
```

## Quick start

```ts
import { AiStudio } from "@ai-studio/sdk";

const client = new AiStudio({
  apiKey: process.env.AI_STUDIO_API_KEY!,
});

// 1. Studio 작업 생성
const job = await client.studio.create({
  topic: "React Hooks 입문",
  level: "intermediate",
  course_category: "professional",
});
console.log("job_id:", job.job_id);

// 2. 완료까지 대기 (폴링)
const result = await client.studio.wait(job.job_id);
console.log("content:", result.content);

// 3. Tutor 단발 질문
const reply = await client.tutor.ask({
  message: "useEffect와 useLayoutEffect 차이?",
});
console.log(reply.answer);

// 4. 본인 테넌트 통계
const stats = await client.analytics.get({ days: 30 });
console.log(stats);
```

## API key 발급

KEG ai-studio 관리자에게 요청하면 발급해드립니다.  
키 형식: `ak_live_<32-hex>` (40자)

## Error handling

```ts
import { AiStudioError } from "@ai-studio/sdk";

try {
  await client.studio.create({ topic: "..." });
} catch (e) {
  if (e instanceof AiStudioError) {
    console.error(e.status, e.code, e.message);
    if (e.status === 429) {
      // rate limit — back off
    }
  }
}
```

## Build

```bash
npm install
npm run build
```

## License

MIT
