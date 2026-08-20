type RateLimitEntry = { count: number; resetAt: number };

const windowMs = 60_000;
const maximumRequests = 20;
const maximumEntries = 2_000;

declare global {
  var xguardAnalyzeRateLimits: Map<string, RateLimitEntry> | undefined;
}

function store() {
  if (!globalThis.xguardAnalyzeRateLimits) globalThis.xguardAnalyzeRateLimits = new Map();
  return globalThis.xguardAnalyzeRateLimits;
}

export function consumeAnalyzeRateLimit(key: string, now = Date.now()) {
  const entries = store();
  if (entries.size > maximumEntries) {
    for (const [entryKey, entry] of entries) if (entry.resetAt <= now) entries.delete(entryKey);
  }
  const current = entries.get(key);
  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maximumRequests - 1, retryAfterSeconds: 0 };
  }
  if (current.count >= maximumRequests) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, remaining: maximumRequests - current.count, retryAfterSeconds: 0 };
}

export function resetAnalyzeRateLimits() {
  store().clear();
}
