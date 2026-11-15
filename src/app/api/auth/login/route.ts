import { NextRequest, NextResponse } from 'next/server';
import {
  AUTHORIZED_ADMIN_EMAILS,
  constantTimeCompare,
  createSessionToken,
  getInternalSecurityKey,
} from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);

  // Rate limit: max 5 login attempts per 15 minutes per IP
  const rateLimit = checkRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    identifier: `login:${ip}`,
  });

  if (!rateLimit.allowed) {
    logAuditEvent({
      user: 'unknown',
      action: 'AUTH_FAILED',
      details: { reason: 'rate_limited', ip },
      status: 'DENIED',
      ip,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Prea multe încercări. Vă rugăm încercați din nou peste 15 minute.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds || 900),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    const key = (body.key || '').trim();

    const isAuthorizedEmail = AUTHORIZED_ADMIN_EMAILS.some(
      (admin) => admin.toLowerCase() === email
    );
    const serverKey = getInternalSecurityKey();
    const isValidKey = serverKey.length >= 16 && constantTimeCompare(key, serverKey);

    if (!isAuthorizedEmail || !isValidKey) {
      logAuditEvent({
        user: email || 'unknown',
        action: 'AUTH_FAILED',
        details: { reason: 'invalid_credentials', ip },
        status: 'DENIED',
        ip,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Identitate neautorizată sau cheie de acces invalidă.',
        },
        { status: 401 }
      );
    }

    // Generate signed session token
    const token = createSessionToken(email);

    logAuditEvent({
      user: email,
      action: 'AUTH_LOGIN',
      details: { method: 'admin_passkey', ip },
      status: 'SUCCESS',
      ip,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Autentificare reușită.',
      user: email,
    });

    // Set secure HttpOnly session cookie
    response.cookies.set('radar_auth_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Format cerere invalid.' },
      { status: 400 }
    );
  }
}
