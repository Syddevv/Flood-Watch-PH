type MemoryRateLimitEntry = {
  count: number;
  expiresAt: number;
};

const entries = new Map<string, MemoryRateLimitEntry>();
const MAX_ENTRIES = 10_000;

export function consumeInMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  const existing = entries.get(key);
  const entry = !existing || existing.expiresAt <= now
    ? { count: 1, expiresAt: now + windowMs }
    : { count: existing.count + 1, expiresAt: existing.expiresAt };

  entries.set(key, entry);

  if (entries.size > MAX_ENTRIES) {
    for (const [entryKey, value] of entries) {
      if (value.expiresAt <= now || entries.size > MAX_ENTRIES) {
        entries.delete(entryKey);
      }
      if (entries.size <= MAX_ENTRIES) {
        break;
      }
    }
  }

  return {
    allowed: entry.count <= limit,
    expiresAt: new Date(entry.expiresAt),
  };
}
