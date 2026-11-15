import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);

  // 1. Authenticate request
  const auth = await validateRequest(request);
  if (!auth.authenticated) {
    logAuditEvent({
      user: 'anonymous',
      action: 'EXPORT',
      details: { reason: 'unauthorized_attempt', ip },
      status: 'DENIED',
      ip,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
        message: 'Autentificare necesară pentru exportul de date.',
        status: 401,
      },
      {
        status: 401,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        },
      }
    );
  }

  // 2. Strict Rate Limiting: max 5 exports per 15 minutes
  const rateLimit = checkRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    identifier: `export:${ip}:${auth.user}`,
  });

  if (!rateLimit.allowed) {
    logAuditEvent({
      user: auth.user || 'admin',
      action: 'EXPORT',
      details: { reason: 'rate_limited', ip },
      status: 'DENIED',
      ip,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Prea multe solicitări de export. Limita este de 5 exporturi la 15 minute.',
        status: 429,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds || 900),
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        },
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const db = getDatabase();

    const priority = searchParams.get('priority');
    const county = searchParams.get('county');
    const isNew = searchParams.get('isNew');

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (priority) {
      whereClauses.push('prospect_priority = ?');
      params.push(priority);
    }
    if (county) {
      whereClauses.push('county = ?');
      params.push(county);
    }
    if (isNew === 'true') {
      whereClauses.push("datetime(first_observed_at, '+90 days') >= datetime('now')");
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const rows = db.prepare(`
      SELECT 
        cui, name, reg_com, legal_form, incorporation_date, county, city, street,
        primary_caen, caen_description, status, website, opportunity_score,
        data_completeness_score, prospect_priority
      FROM companies
      ${whereSql}
      ORDER BY opportunity_score DESC
      LIMIT 1000
    `).all(...params) as any[];

    // CSV format with UTF-8 BOM for Excel compatibility
    const header = [
      'CUI', 'Denumire', 'Nr_RegCom', 'Forma_Juridica', 'Data_Inmatriculare',
      'Judet', 'Localitate', 'Strada', 'CAEN', 'Descriere_CAEN', 'Stare',
      'Website', 'Scor_Oportunitate', 'Completitudine', 'Prioritate'
    ];
    
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csvContent = '\uFEFF' + header.join(',') + '\n';
    for (const r of rows) {
      const line = [
        r.cui,
        escapeCsv(r.name),
        escapeCsv(r.reg_com),
        escapeCsv(r.legal_form),
        escapeCsv(r.incorporation_date),
        escapeCsv(r.county),
        escapeCsv(r.city),
        escapeCsv(r.street),
        escapeCsv(r.primary_caen),
        escapeCsv(r.caen_description),
        escapeCsv(r.status),
        escapeCsv(r.website),
        r.opportunity_score,
        r.data_completeness_score,
        escapeCsv(r.prospect_priority),
      ].join(',');
      csvContent += line + '\n';
    }

    // 3. Log audit event
    logAuditEvent({
      user: auth.user || 'admin',
      action: 'EXPORT',
      details: {
        format: 'csv',
        recordCount: rows.length,
        filterPriority: priority,
        filterCounty: county,
        filterIsNew: isNew,
      },
      status: 'SUCCESS',
      ip,
    });

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="radar_business_export_${Date.now()}.csv"`,
        'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      {
        status: 500,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        },
      }
    );
  }
}
