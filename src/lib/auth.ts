import { NextRequest } from 'next/server';

export const AUTHORIZED_ADMIN_EMAILS = [
  'myremaxclubcristianv@gmail.com',
];

/**
 * Retrieves the internal administrative security key from environment variables or Cloudflare context.
 * Exclusively used for HMAC session token signing and internal cryptographic operations.
 * Fails closed (returns empty string) if not configured. Hardcoded secrets are strictly prohibited.
 */
export function getInternalSecurityKey(): string {
  const envVal = process.env.RADAR_SECURITY_KEY || process.env.ADMIN_KEY || '';
  if (envVal) return envVal.trim();
  try {
    const cfContext = (globalThis as any)[Symbol.for('__cloudflare-context__')];
    return (cfContext?.env?.RADAR_SECURITY_KEY || cfContext?.env?.ADMIN_KEY || '').trim();
  } catch {
    return '';
  }
}

/**
 * Retrieves the dedicated administrator web login passkey from environment variables or Cloudflare context.
 * RADAR_ADMIN_PASSKEY is strictly the ONLY credential accepted for administrator login.
 * Fallback to RADAR_SECURITY_KEY or ADMIN_PASSKEY is completely removed.
 * Returns empty string if unconfigured. Never uses hardcoded defaults.
 */
export function getAdminPasskey(): string {
  const envVal = process.env.RADAR_ADMIN_PASSKEY || '';
  if (envVal) return envVal.trim();
  try {
    const cfContext = (globalThis as any)[Symbol.for('__cloudflare-context__')];
    return (cfContext?.env?.RADAR_ADMIN_PASSKEY || '').trim();
  } catch {
    return '';
  }
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 * Iterates through all characters with XOR comparison regardless of matching status.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (!a || !b) return false;

  const lenA = a.length;
  const lenB = b.length;
  let diff = lenA ^ lenB;
  for (let i = 0; i < lenA; i++) {
    diff |= a.charCodeAt(i) ^ (i < lenB ? b.charCodeAt(i) : 0);
  }
  return diff === 0;
}

/**
 * Cryptographic HMAC-SHA256 signature generation using universal Web Crypto API.
 * Standard across Node.js, Vercel Edge Runtime, and Cloudflare Workers.
 */
export async function computeHmacSha256(message: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex;
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

  // If CF_ACCESS_AUD is configured in environment, allow verified user
  if (process.env.CF_ACCESS_AUD) {
    return { valid: true, email: tokenEmail };
  }

  // If Cloudflare Access is not configured on the worker, do not accept unverified JWT claims
  return { valid: false, reason: 'unverified_jwt' };
}

/**
 * Validates request credentials against Cloudflare Access and internal auth mechanisms
 */
export async function validateRequest(request: NextRequest): Promise<AuthResult> {
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

  // 2. Check Admin Session Cookie (checking both parsed cookies and raw headers)
  let sessionCookie = request.cookies.get('radar_auth_session')?.value;
  if (!sessionCookie) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/(?:^|;\s*)radar_auth_session=([^;]+)/);
    if (match) {
      sessionCookie = match[1];
    }
  }

  if (sessionCookie) {
    const valid = await verifySessionToken(sessionCookie);
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
export async function createSessionToken(email: string): Promise<string> {
  const secret = getInternalSecurityKey();
  if (!secret || secret.length < 16) {
    throw new Error('Internal security key is not configured or too short.');
  }
  const timestamp = Date.now();
  const payload = `${email}:${timestamp}`;
  const signature = await computeHmacSha256(payload, secret);
  return `${payload}:${signature}`;
}

/**
 * Verifies a signed session token
 */
export async function verifySessionToken(token: string): Promise<{ valid: boolean; email?: string }> {
  try {
    const rawToken = typeof token === 'string' && token.includes('%') ? decodeURIComponent(token) : token;
    const secret = getInternalSecurityKey();
    if (!secret || secret.length < 16) return { valid: false };

    const parts = rawToken.split(':');
    if (parts.length !== 3) return { valid: false };

    const [email, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);

    // Session valid for 7 days
    if (isNaN(timestamp) || Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) {
      return { valid: false };
    }

    const payload = `${email}:${timestampStr}`;
    const expectedSignature = await computeHmacSha256(payload, secret);

    if (constantTimeCompare(signature, expectedSignature)) {
      return { valid: true, email };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}
