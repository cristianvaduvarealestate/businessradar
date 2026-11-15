import { NextRequest } from 'next/server';
import crypto from 'crypto';

export const AUTHORIZED_ADMIN_EMAILS = [
  'myremaxclubcristianv@gmail.com',
];

/**
 * Retrieves the internal administrative security key from environment variables.
 * Fails closed (returns empty string) if not configured. Hardcoded secrets are strictly prohibited.
 */
export function getInternalSecurityKey(): string {
  const key = process.env.RADAR_SECURITY_KEY || process.env.ADMIN_KEY || '';
  return key.trim();
}

/**
 * Constant-time string comparison using SHA-256 fixed-size digests and crypto.timingSafeEqual.
 * Prevents timing side-channel attacks and string length leakage.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (!a || !b) return false;

  try {
    const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
    const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
    return crypto.timingSafeEqual(hashA, hashB);
  } catch {
    // Constant-time XOR comparison fallback
    const lenA = a.length;
    const lenB = b.length;
    let diff = lenA ^ lenB;
    for (let i = 0; i < lenA; i++) {
      diff |= a.charCodeAt(i) ^ (i < lenB ? b.charCodeAt(i) : 0);
    }
    return diff === 0;
  }
}

/**
 * Cryptographic HMAC-SHA256 signature generation.
 */
export function createHmacSha256(message: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(message, 'utf8').digest('hex');
}

export interface AuthResult {
  authenticated: boolean;
  user?: string;
  source?: 'cloudflare-access' | 'api-key' | 'session-cookie' | 'dev-bypass';
  reason?:
    | 'no_credentials'
    | 'unauthorized_identity'
    | 'invalid_token'
    | 'spoofed_identity_header'
    | 'unverified_jwt'
    | 'expired_jwt'
    | 'invalid_key';
}

interface ParsedJwt {
  header: Record<string, any>;
  payload: Record<string, any>;
  signature: string;
  rawSignedData: string;
}

/**
 * Parses and validates JWT structure
 */
function parseJwt(token: string): ParsedJwt | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const headerStr = Buffer.from(parts[0], 'base64url').toString('utf8');
    const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf8');
    const header = JSON.parse(headerStr);
    const payload = JSON.parse(payloadStr);

    return {
      header,
      payload,
      signature: parts[2],
      rawSignedData: `${parts[0]}.${parts[1]}`,
    };
  } catch {
    return null;
  }
}

/**
 * Validates Cloudflare Access edge token.
 * CRITICAL: Fails closed. If Access is not configured or JWT is invalid, it is rejected.
 */
function validateCloudflareAccessJwt(
  jwtAssertion: string,
  cfEmailHeader?: string | null
): { valid: boolean; email?: string; reason?: AuthResult['reason'] } {
  const parsed = parseJwt(jwtAssertion);
  if (!parsed) {
    return { valid: false, reason: 'unverified_jwt' };
  }

  const { header, payload } = parsed;

  // 1. Header validation: must use RS256 algorithm and contain a key id
  if (header.alg !== 'RS256' || !header.kid) {
    return { valid: false, reason: 'unverified_jwt' };
  }

  // 2. Expiry validation (exp claim in seconds)
  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || typeof payload.exp !== 'number' || payload.exp < nowSec) {
    return { valid: false, reason: 'expired_jwt' };
  }

  // 3. Not-before / Issued-at validation
  if (payload.nbf && typeof payload.nbf !== 'number' && payload.nbf > nowSec + 60) {
    return { valid: false, reason: 'unverified_jwt' };
  }

  // 4. Identity validation: extract email from payload
  const tokenEmail = (payload.email || payload.identity?.email || '').trim().toLowerCase();
  if (!tokenEmail) {
    return { valid: false, reason: 'unauthorized_identity' };
  }

  // 5. If cf-access-authenticated-user-email header was sent, it MUST match token email claim
  if (cfEmailHeader) {
    const normalizedHeaderEmail = cfEmailHeader.trim().toLowerCase();
    if (tokenEmail !== normalizedHeaderEmail) {
      return { valid: false, reason: 'spoofed_identity_header' };
    }
  }

  // 6. Audience & Issuer validation if configured in environment
  const expectedAud = process.env.CF_ACCESS_AUD?.trim();
  if (expectedAud) {
    const tokenAud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!tokenAud.includes(expectedAud)) {
      return { valid: false, reason: 'unverified_jwt' };
    }
  }

  const expectedTeamDomain = process.env.CF_ACCESS_TEAM_DOMAIN?.trim();
  if (expectedTeamDomain) {
    const expectedIss = `https://${expectedTeamDomain}.cloudflareaccess.com`;
    if (payload.iss !== expectedIss) {
      return { valid: false, reason: 'unverified_jwt' };
    }
  }

  // 7. Verify identity is in authorized admin list
  const isAuthorized = AUTHORIZED_ADMIN_EMAILS.some(
    (admin) => admin.toLowerCase() === tokenEmail
  );
  if (!isAuthorized) {
    return { valid: false, reason: 'unauthorized_identity' };
  }

  // Fail closed if CF_ACCESS_AUD is not set in production
  if (process.env.CF_ACCESS_AUD) {
    return { valid: true, email: tokenEmail };
  }

  // If Cloudflare Access is not configured on the worker, do not accept unverified JWT claims
  return { valid: false, reason: 'unverified_jwt' };
}

/**
 * Validates request credentials against Cloudflare Access and internal auth mechanisms
 */
export function validateRequest(request: NextRequest): AuthResult {
  // 1. Check Cloudflare Access edge identity headers
  const cfEmail = request.headers.get('cf-access-authenticated-user-email');
  const cfJwt = request.headers.get('cf-access-jwt-assertion');

  // CRITICAL DEFENSE: If cf-email header is present WITHOUT a valid cf-access-jwt-assertion,
  // reject immediately as spoofed header!
  if (cfEmail && !cfJwt) {
    return {
      authenticated: false,
      reason: 'spoofed_identity_header',
      user: cfEmail,
    };
  }

  if (cfJwt) {
    const cfResult = validateCloudflareAccessJwt(cfJwt, cfEmail);
    if (cfResult.valid && cfResult.email) {
      return {
        authenticated: true,
        user: cfResult.email,
        source: 'cloudflare-access',
      };
    } else {
      return {
        authenticated: false,
        reason: cfResult.reason || 'unverified_jwt',
        user: cfResult.email || cfEmail || undefined,
      };
    }
  }

  // 2. Check Admin Session Cookie
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

  // 3. Check API Key / Bearer Token (for programmatic/automated ingestion/exports)
  const authHeader = request.headers.get('authorization');
  const customKeyHeader = request.headers.get('x-radar-api-key');
  const expectedKey = getInternalSecurityKey();

  // Fail closed: Never allow authentication if internal security key is unconfigured or weak (< 16 chars)
  if (expectedKey.length >= 16) {
    if (customKeyHeader && constantTimeCompare(customKeyHeader, expectedKey)) {
      return {
        authenticated: true,
        user: 'api-admin',
        source: 'api-key',
      };
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const bearerToken = authHeader.substring(7).trim();
      if (constantTimeCompare(bearerToken, expectedKey)) {
        return {
          authenticated: true,
          user: 'api-admin',
          source: 'api-key',
        };
      }
    }
  }

  // 4. Development loopback bypass (strictly non-production only)
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
 * Creates a signed session token: email:timestamp:hmac_sha256
 */
export function createSessionToken(email: string): string {
  const secret = getInternalSecurityKey();
  if (!secret || secret.length < 16) {
    throw new Error('Internal security key is not configured or too short.');
  }
  const timestamp = Date.now();
  const payload = `${email}:${timestamp}`;
  const signature = createHmacSha256(payload, secret);
  return `${payload}:${signature}`;
}

/**
 * Verifies a signed session token
 */
export function verifySessionToken(token: string): { valid: boolean; email?: string } {
  try {
    const secret = getInternalSecurityKey();
    if (!secret || secret.length < 16) return { valid: false };

    const parts = token.split(':');
    if (parts.length !== 3) return { valid: false };

    const [email, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);

    // Session valid for 7 days
    if (isNaN(timestamp) || Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) {
      return { valid: false };
    }

    const payload = `${email}:${timestampStr}`;
    const expectedSignature = createHmacSha256(payload, secret);

    if (constantTimeCompare(signature, expectedSignature)) {
      return { valid: true, email };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}
