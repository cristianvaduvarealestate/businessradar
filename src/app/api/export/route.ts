import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
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

  // 2. Strict Rate Limiting: max 10 exports per 15 minutes
  const rateLimit = checkRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
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
        error: 'Prea multe solicitări de export. Limita este de 10 exporturi la 15 minute.',
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

    const exportType = searchParams.get('type') || 'companies'; // 'companies' | 'contacts'
    const contactFilter = searchParams.get('contactFilter'); // 'with_mobile' | 'with_landline' | 'with_email' | 'with_website' | 'with_any_contact' | 'no_contacts'
    const priority = searchParams.get('priority');
    const county = searchParams.get('county');

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    if (exportType === 'contacts') {
      // Export discovered contacts with full provenance
      const rows = await queryAll(`
        SELECT 
          cr.id, cr.cui, c.name as company_name, c.county,
          cr.contact_type, cr.contact_value, cr.normalized_value, cr.label,
          cr.source_name, cr.provenance_url, cr.verification_status, cr.confidence_score,
          cr.contact_person, cr.contact_person_position, cr.notes, cr.discovered_at
        FROM contact_records cr
        JOIN companies c ON c.cui = cr.cui
        WHERE c.cui NOT IN (SELECT cui FROM suppression_list WHERE cui IS NOT NULL)
        ORDER BY cr.cui ASC, cr.confidence_score DESC
      `);

      const header = [
        'ID', 'CUI', 'Companie', 'Judet', 'Tip_Contact', 'Valoare_Originala',
        'Valoare_Normalizata', 'Eticheta', 'Sursa', 'URL_Provenienta',
        'Status_Verificare', 'Scor_Incredere', 'Persoana_Contact', 'Functie', 'Note', 'Data_Colectarii'
      ];

      let csv = '\uFEFF' + header.join(',') + '\n';
      for (const r of rows) {
        csv += [
          r.id,
          r.cui,
          escapeCsv(r.company_name),
          escapeCsv(r.county),
          escapeCsv(r.contact_type),
          escapeCsv(r.contact_value),
          escapeCsv(r.normalized_value),
          escapeCsv(r.label),
          escapeCsv(r.source_name),
          escapeCsv(r.provenance_url),
          escapeCsv(r.verification_status),
          r.confidence_score,
          escapeCsv(r.contact_person),
          escapeCsv(r.contact_person_position),
          escapeCsv(r.notes),
          escapeCsv(r.discovered_at),
        ].join(',') + '\n';
      }

      logAuditEvent({
        user: auth.user || 'admin',
        action: 'EXPORT',
        details: { exportType: 'contacts', recordCount: rows.length },
        status: 'SUCCESS',
        ip,
      });

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="radar_contacts_provenance_${Date.now()}.csv"`,
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
          'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
        },
      });
    }

    // Export companies with contact filters & suppression enforcement
    const whereClauses: string[] = [
      'cui NOT IN (SELECT cui FROM suppression_list WHERE cui IS NOT NULL)'
    ];
    const params: any[] = [];

    if (priority) {
      whereClauses.push('prospect_priority = ?');
      params.push(priority);
    }
    if (county) {
      whereClauses.push('county = ?');
      params.push(county);
    }

    if (contactFilter === 'with_mobile') {
      whereClauses.push("EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'MOBILE' OR cr.contact_value LIKE '+407%' OR cr.contact_value LIKE '07%'))");
    } else if (contactFilter === 'with_landline') {
      whereClauses.push("EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'LANDLINE' OR cr.contact_value LIKE '+402%' OR cr.contact_value LIKE '02%' OR cr.contact_value LIKE '+403%' OR cr.contact_value LIKE '03%'))");
    } else if (contactFilter === 'with_email') {
      whereClauses.push("EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui AND cr.contact_type = 'EMAIL')");
    } else if (contactFilter === 'with_website') {
      whereClauses.push("website IS NOT NULL AND website != ''");
    } else if (contactFilter === 'with_any_contact') {
      whereClauses.push("EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui)");
    } else if (contactFilter === 'no_contacts') {
      whereClauses.push("NOT EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui)");
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const rows = await queryAll(`
      SELECT 
        cui, name, reg_com, legal_form, incorporation_date, county, city,
        primary_caen, caen_description, status, website, opportunity_score,
        prospect_priority,
        (SELECT COALESCE(normalized_value, contact_value) FROM contact_records WHERE cui = companies.cui AND (contact_type = 'MOBILE' OR contact_type LIKE '%PHONE%') ORDER BY confidence_score DESC LIMIT 1) as phone_contact,
        (SELECT COALESCE(normalized_value, contact_value) FROM contact_records WHERE cui = companies.cui AND contact_type = 'EMAIL' ORDER BY confidence_score DESC LIMIT 1) as email_contact,
        (SELECT status FROM prospect_pipeline WHERE cui = companies.cui) as pipeline_stage
      FROM companies
      ${whereSql}
      ORDER BY opportunity_score DESC
      LIMIT 5000
    `, params);

    const header = [
      'CUI', 'Denumire', 'Nr_RegCom', 'Forma_Juridica', 'Data_Inmatriculare',
      'Judet', 'Localitate', 'CAEN', 'Descriere_CAEN', 'Stare',
      'Website', 'Telefon_Principal', 'Email_Principal', 'Stadiu_Pipeline', 'Scor_Oportunitate', 'Prioritate'
    ];

    let csvContent = '\uFEFF' + header.join(',') + '\n';
    for (const r of rows) {
      csvContent += [
        r.cui,
        escapeCsv(r.name),
        escapeCsv(r.reg_com),
        escapeCsv(r.legal_form),
        escapeCsv(r.incorporation_date),
        escapeCsv(r.county),
        escapeCsv(r.city),
        escapeCsv(r.primary_caen),
        escapeCsv(r.caen_description),
        escapeCsv(r.status),
        escapeCsv(r.website),
        escapeCsv(r.phone_contact),
        escapeCsv(r.email_contact),
        escapeCsv(r.pipeline_stage),
        r.opportunity_score,
        escapeCsv(r.prospect_priority),
      ].join(',') + '\n';
    }

    logAuditEvent({
      user: auth.user || 'admin',
      action: 'EXPORT',
      details: { exportType: 'companies', contactFilter, recordCount: rows.length },
      status: 'SUCCESS',
      ip,
    });

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="radar_prospects_${contactFilter || 'all'}_${Date.now()}.csv"`,
        'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
