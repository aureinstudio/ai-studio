/**
 * k6 부하 시나리오 — Tutor 50명 ramp + 5분 sustain.
 *
 * 실행:
 *   k6 run \
 *     -e BASE_URL=https://ai-studio-drab-nine.vercel.app \
 *     -e STUDIO_JOB_ID=<공개 sample uuid> \
 *     -e TOKENS_FILE=./tokens.json \
 *     tests/load/scenario-tutor.js
 *
 * tokens.json — scripts/create-test-users.ts로 생성. 형태:
 *   [{ "user_id": "uuid", "access_token": "eyJ..." }, ...]
 *
 * 검증 임계:
 *   p95 < 5s, 실패율 < 5%, ratelimit 비율 < 2%.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const STUDIO_JOB_ID = __ENV.STUDIO_JOB_ID;

const tokens = JSON.parse(open(__ENV.TOKENS_FILE || "./tokens.json"));

const QUESTIONS = [
  "한식 양념 종류를 알려주세요",
  "발효 식품의 효능은?",
  "김치의 핵심 재료는?",
  "한식 상차림의 기본 원칙은?",
  "Korean cuisine 특징을 영어로 설명해주세요",
  "고추장과 된장의 차이는?",
  "전통 한식 조리법 3가지를 알려주세요",
];

const rateLimited = new Counter("rate_limited_429");
const blocked = new Counter("threat_blocked_400");
const success = new Rate("success");

export const options = {
  scenarios: {
    students_using_tutor: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "1m", target: 10 },
        { duration: "3m", target: 50 },
        { duration: "5m", target: 50 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<5000", "p(99)<10000"],
    http_req_failed: ["rate<0.05"],
    success: ["rate>0.90"],
  },
};

export default function () {
  if (!STUDIO_JOB_ID) {
    throw new Error("STUDIO_JOB_ID env required");
  }
  const tok = tokens[__VU % tokens.length];
  const question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];

  const res = http.post(
    `${BASE_URL}/api/tutor/ask`,
    JSON.stringify({
      question,
      studio_job_id: STUDIO_JOB_ID,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tok.access_token}`,
      },
      tags: { endpoint: "tutor:ask" },
    },
  );

  if (res.status === 429) rateLimited.add(1);
  if (res.status === 400) blocked.add(1);

  const ok = check(res, {
    "status 200": (r) => r.status === 200,
    "p<5s": (r) => r.timings.duration < 5000,
    "has answer": (r) => {
      try { return !!JSON.parse(r.body).answer; } catch { return false; }
    },
  });
  success.add(ok);

  // 실제 학생 패턴 — 10~40초 think time
  sleep(Math.random() * 30 + 10);
}
