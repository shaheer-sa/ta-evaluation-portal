import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

// We check this at runtime so the app doesn't crash if the env vars are missing
let redis: Redis | null = null;
let hasLoggedWarning = false;

if (
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_URL.startsWith("https") &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} else {
  if (process.env.NODE_ENV !== "test" && !hasLoggedWarning) {
    console.warn("Upstash Redis credentials missing. Rate limiting is disabled.");
    hasLoggedWarning = true;
  }
}

export function createRateLimiter(config: { tokens: number; window: `${number} s` | `${number} m` | `${number} h` | `${number} d` }) {
  if (!redis) {
    return null;
  }
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.tokens, config.window),
    analytics: true,
  });
}

export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return "unknown";
}
