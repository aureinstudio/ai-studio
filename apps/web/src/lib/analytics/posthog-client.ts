"use client";
/**
 * PostHog client-side.
 *
 * 추적 이벤트 (PII 제외):
 *   - $pageview (자동)
 *   - tutor_question_sent — { intent, language, verdict, cost_usd, duration_ms } — 질문 텍스트는 X
 *   - studio_job_started / completed
 *   - cast_video_watched — { duration_sec, completion_pct }
 *
 * 무료 티어: 1M events/월 (50명 베타 기준 충분).
 */
import posthog from "posthog-js";
import { useEffect } from "react";

let initialized = false;

export function initPostHog() {
  if (initialized) return;
  if (typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return; // fail-soft
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only", // 익명 트래픽 PII 회피
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true, // 학생 화면 녹화 X (개인정보 보호)
    autocapture: false, // 자동 클릭 추적 X (의도적 이벤트만)
  });
  initialized = true;
}

export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  posthog.capture(name, props);
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  posthog.identify(userId, traits);
}

export function resetUser() {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  posthog.reset();
}

/**
 * React 컴포넌트 — _app/layout에 한 번 마운트.
 */
export function PostHogInit() {
  useEffect(() => {
    initPostHog();
  }, []);
  return null;
}
