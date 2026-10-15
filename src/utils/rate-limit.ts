/**
 * Tiny in-memory, per-IP rate limiter for public form endpoints.
 * Good enough for a single PM2 process; resets on restart.
 */
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, limit = 5, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return recent.length > limit;
}

export const clientIp = (ctx: any): string =>
  String(ctx.request.headers['x-forwarded-for'] ?? ctx.request.ip ?? '')
    .split(',')[0]
    .trim();
