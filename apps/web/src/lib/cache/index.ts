/**
 * Multi-tier cache — L1 in-memory LRU + L2 Upstash Redis.
 *
 * L1: 인스턴스-로컬 LRU (~512 entries, 60s TTL). 콜드 스타트 시 비어있음.
 * L2: Upstash Redis (configurable TTL, 기본 5분). 인스턴스 간 공유.
 *
 * 미설정(Redis 없음) 시 L1만 동작 → 단일 인스턴스 hit만 캐시.
 *
 * 캐시 대상:
 *   - Gemini 임베딩 (학생 질문 → vector, 약 200~500ms 절약)
 *   - RAG 검색 결과 (job + question 조합)
 *   - 학생 프로필·과정 메타데이터
 */
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// L1 — 단순 Map 기반 LRU (오버헤드 최소). insertion order = LRU order.
const L1_MAX = 512;
type L1Entry<T> = { value: T; expiresAt: number };
const l1 = new Map<string, L1Entry<unknown>>();

function l1Get<T>(key: string): T | null {
  const entry = l1.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    l1.delete(key);
    return null;
  }
  // LRU 갱신 — 재삽입
  l1.delete(key);
  l1.set(key, entry);
  return entry.value as T;
}

function l1Set<T>(key: string, value: T, ttlSec: number): void {
  if (l1.size >= L1_MAX) {
    const oldest = l1.keys().next().value;
    if (oldest !== undefined) l1.delete(oldest);
  }
  l1.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

/**
 * SHA256 prefix — long text를 짧은 키로 변환.
 */
export function hashKey(parts: (string | number)[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

type GetOpts = {
  l1TtlSec?: number; // 기본 60s
  l2TtlSec?: number; // 기본 300s. 0이면 L2 미사용.
};

/**
 * Cache wrapper — L1 hit → L2 hit → compute → fill both.
 */
export async function cached<T>(
  key: string,
  compute: () => Promise<T>,
  opts: GetOpts = {},
): Promise<T> {
  const l1Ttl = opts.l1TtlSec ?? 60;
  const l2Ttl = opts.l2TtlSec ?? 300;

  // L1
  const v1 = l1Get<T>(key);
  if (v1 !== null) return v1;

  // L2 (Upstash)
  if (l2Ttl > 0) {
    const r = getRedis();
    if (r) {
      try {
        const v2 = await r.get<T>(key);
        if (v2 !== null && v2 !== undefined) {
          l1Set(key, v2, l1Ttl);
          return v2;
        }
      } catch (err) {
        console.warn("[cache] L2 get failed (non-fatal):", err);
      }
    }
  }

  // Compute
  const value = await compute();

  // Fill
  l1Set(key, value, l1Ttl);
  if (l2Ttl > 0) {
    const r = getRedis();
    if (r) {
      try {
        await r.set(key, value, { ex: l2Ttl });
      } catch (err) {
        console.warn("[cache] L2 set failed (non-fatal):", err);
      }
    }
  }
  return value;
}

/**
 * 캐시 무효화 (prefix match — L1만, L2는 TTL 자연 만료).
 */
export function invalidatePrefix(prefix: string): number {
  let n = 0;
  for (const k of Array.from(l1.keys())) {
    if (k.startsWith(prefix)) {
      l1.delete(k);
      n++;
    }
  }
  return n;
}

export function getCacheStats(): { l1_size: number; l1_max: number } {
  return { l1_size: l1.size, l1_max: L1_MAX };
}
