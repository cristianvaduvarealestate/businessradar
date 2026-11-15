import { NextRequest } from 'next/server';

export const AUTHORIZED_ADMIN_EMAILS = [
  'myremaxclubcristianv@gmail.com',
];

// Fallback internal admin key for administrative session & API automation
export const DEFAULT_INTERNAL_KEY = 'radar_sec_4f9a88c2e1b7305981d4a0f8e2c69137';

export function getInternalSecurityKey(): string {
  return process.env.RADAR_SECURITY_KEY || DEFAULT_INTERNAL_KEY;
}

export interface AuthResult {
  authenticated: boolean;
  user?: string;
  source?: 'cloudflare-access' | 'api-key' | 'session-cookie' | 'dev-bypass';
  reason?: 'no_credentials' | 'unauthorized_identity' | 'invalid_token';
}

/**
 * Validates request credentials against Cloudflare Access and internal auth mechanisms
 */
export function validateRequest(request: NextRequest): AuthResult {
  // 1. Check Cloudflare Access edge identity headers
  const cfEmail = request.headers.get('cf-access-authenticated-user-email');
  const cfJwt = request.headers.get('cf-access-jwt-assertion');

  if (cfEmail) {
    const normalizedEmail = cfEmail.trim().toLowerCase();
    const isAuthorized = AUTHORIZED_ADMIN_EMAILS.some(
      (admin) => admin.toLowerCase() === normalizedEmail
    );

    if (isAuthorized) {
      return {
        authenticated: true,
        user: normalizedEmail,
        source: 'cloudflare-access',
      };
    } else {
      return {
        authenticated: false,
        reason: 'unauthorized_identity',
        user: normalizedEmail,
      };
    }
  }

  // 2. Check API Key / Bearer Token (for programmatic/automated ingestion/exports)
  const authHeader = request.headers.get('authorization');
  const customKeyHeader = request.headers.get('x-radar-api-key');
  const expectedKey = getInternalSecurityKey();

  if (customKeyHeader && customKeyHeader === expectedKey) {
    return {
      authenticated: true,
      user: 'api-admin',
      source: 'api-key',
    };
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    if (bearerToken === expectedKey) {
      return {
        authenticated: true,
        user: 'api-admin',
        source: 'api-key',
      };
    }
  }

  // 3. Check Admin Session Cookie
  const sessionCookie = request.cookies.get('radar_auth_session')?.value;
  if (sessionCookie) {
    const valid = verifySessionToken(sessionCookie);
    if (valid.valid && valid.email) {
      const isAuthorized = AUTHORIZED_ADMIN_EMAILS.some(
        (admin) => admin.toLowerCase() === valid.email!.toLowerCase()
      );
      if (isAuthorized) {
        return {
          authenticated: true,
          user: valid.email,
          source: 'session-cookie',
        };
      }
    }
  }

  // 4. Development loopback bypass (only active when explicitly configured in non-production)
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.DEV_AUTH_BYPASS === 'true'
  ) {
    return {
      authenticated: true,
      user: 'dev-admin@local',
      source: 'dev-bypass',
    };
  }

  return {
    authenticated: false,
    reason: 'no_credentials',
  };
}

/**
 * Creates a signed session token: email:timestamp:signature
 */
export function createSessionToken(email: string): string {
  const timestamp = Date.now();
  const payload = `${email}:${timestamp}`;
  const signature = simpleHmac(payload, getInternalSecurityKey());
  return `${payload}:${signature}`;
}

/**
 * Verifies a signed session token
 */
export function verifySessionToken(token: string): { valid: boolean; email?: string } {
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return { valid: false };

    const [email, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);

    // Session valid for 7 days
    if (isNaN(timestamp) || Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) {
      return { valid: false };
    }

    const payload = `${email}:${timestampStr}`;
    const expectedSignature = simpleHmac(payload, getInternalSecurityKey());

    if (signature === expectedSignature) {
      return { valid: true, email };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

/**
 * Deterministic hash function for signing tokens without external crypto dependencies
 */
function simpleHmac(message: string, secret: string): string {
  let hash = 0x811c9dc5;
  const combined = message + '###' + secret;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
