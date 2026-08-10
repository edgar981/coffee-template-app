// Basic in-memory fixed-window rate limiter, keyed by an arbitrary identifier
// (e.g. client IP). This is intentionally lightweight — it lives in a single
// process's memory, so it does NOT coordinate across multiple serverless
// instances. It's enough to blunt naive enumeration of a public endpoint; for
// hard guarantees behind a horizontally-scaled deployment, back it with a
// shared store (Redis/Upstash).

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

// Best-effort sweep so the Map doesn't grow unbounded for one-off callers.
function sweep(now: number) {
  if (buckets.size < 10_000) return;
  for (const [key, win] of buckets) {
    if (win.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the current window resets (for a Retry-After header). */
  retryAfter: number;
}

/**
 * Allow up to `limit` hits per `windowMs` for a given `key`.
 * Returns `ok: false` once the limit is exceeded within the window.
 */
export function rateLimit(
  key: string,
  { limit = 10, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const win = buckets.get(key);
  if (!win || win.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  win.count += 1;
  if (win.count > limit) {
    return { ok: false, retryAfter: Math.ceil((win.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}
