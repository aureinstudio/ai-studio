"use client";

import { useAuth } from "@/contexts/AuthContext";

/**
 * 현재 사용자를 클라이언트 컴포넌트에서 가져오는 훅.
 * AuthContext의 user를 그대로 노출 — Single Source of Truth 원칙.
 */
export function useUser() {
  const { user, loading } = useAuth();
  return { user, loading };
}
