/**
 * 스트레스 시나리오 — 100 VU까지 ramp, 한계 임계 식별용.
 *
 * 실행:
 *   k6 run -e BASE_URL=... -e STUDIO_JOB_ID=... -e TOKENS_FILE=... \
 *     tests/load/scenario-stress.js
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const STUDIO_JOB_ID = __ENV.STUDIO_JOB_ID;
const tokens = JSON.parse(open(__ENV.TOKENS_FILE || "./tokens.json"));

export const options = {
  scenarios: {
    breakpoint: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "2m", target: 30 },
        { duration: "2m", target: 60 },
        { duration: "2m", target: 100 },
        { duration: "3m", target: 100 },
        { duration: "1m", target: 0 },
      ],
    },
  },
  // 임계 미설정 — "어디서 무너지는가"를 직접 관찰
};

const QUESTIONS = [
  "한식 양념의 기본 5가지를 알려주세요",
  "한국 발효 식품 종류는?",
  "김치 담그는 핵심 비법은?",
];

export default function () {
  const tok = tokens[__VU % tokens.length];
  const res = http.post(
    `${BASE_URL}/api/tutor/ask`,
    JSON.stringify({
      question: QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)],
      studio_job_id: STUDIO_JOB_ID,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tok.access_token}`,
      },
    },
  );
  check(res, {
    "not 5xx": (r) => r.status < 500,
  });
  sleep(Math.random() * 20 + 5);
}
