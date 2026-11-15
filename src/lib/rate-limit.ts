interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory sliding window cache per Worker isolate
const rateLimitMap = new Map<string, RateLimitRecord>();

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  identifier: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
}

/**
 * Checks rate limits for a given identifier (IP or user)
 */
export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const key = `${options.identifier}:${options.windowMs}`;
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetAt: now + options.windowMs,
    };
    rateLimitMap.set(key, newRecord);
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetAt: newRecord.resetAt,
    };
  }

  record.count += 1;

  if (record.count > options.maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
      retryAfterSeconds: Math.max(1, retryAfter),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, options.maxRequests - record.count),
    resetAt: record.resetAt,
  };
}

/**
 * Extracts best client IP from request headers
 */
export function getClientIp(headers: Headers): string {
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  return '127.0.0.1';
}
