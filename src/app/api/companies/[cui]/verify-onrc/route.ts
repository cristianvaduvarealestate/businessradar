import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, executeRun } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { CompanyVerificationService, LegalStatus } from '@/lib/verification/service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { cui: string } }
) {
  const auth = await validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401 }
    );
  }

  const cui = parseInt(params.cui, 10);
  if (isNaN(cui)) {
    return NextResponse.json({ success: false, error: 'CUI invalid' }, { status: 400 });
  }

  try {
    const body = await request.json() as any;
    const { onrcStatus, resolutionDate, notes } = body;

    const validOnrcStatuses = [
      'ONRC_ACTIVE',
      'ONRC_RADIATED',
      'ONRC_SUSPENDED',
      'ONRC_DISSOLVED',
      'ONRC_IN_LIQUIDATION',
      'ONRC_UNVERIFIED',
    ];

    if (!validOnrcStatuses.includes(onrcStatus)) {
      return NextResponse.json(
        { success: false, error: 'Stare ONRC invalidă' },
        { status: 400 }
      );
    }

    const company = await queryOne('SELECT * FROM companies WHERE cui = ?', [cui]);
    if (!company) {
      return NextResponse.json({ success: false, error: 'Compania nu a fost găsită' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const adminEmail = typeof auth.user === 'string' ? auth.user : 'ADMIN';

    // Map onrcStatus to legal status
    let legalStatus: LegalStatus = 'ACTIVE';
    if (onrcStatus === 'ONRC_RADIATED') legalStatus = 'RADIATED';
    else if (onrcStatus === 'ONRC_SUSPENDED') legalStatus = 'SUSPENDED';
    else if (onrcStatus === 'ONRC_DISSOLVED') legalStatus = 'DISSOLVED';
    else if (onrcStatus === 'ONRC_IN_LIQUIDATION') legalStatus = 'IN_LIQUIDATION';
    else if (onrcStatus === 'ONRC_UNVERIFIED') legalStatus = company.legal_status || 'UNKNOWN';

    // Check usable contact
    const contacts = await queryAll('SELECT * FROM contact_records WHERE cui = ?', [cui]);
    const usableContact = contacts.find(
      (c) =>
        c.contact_value &&
        ['MOBILE', 'LANDLINE'].includes(c.contact_type) &&
        !['UNREACHABLE', 'INVALID', 'WRONG_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED'].includes(c.verification_status || '')
    );
    const hasValidContact = Boolean(usableContact);

    // Check suppression
    const suppression = await queryOne('SELECT * FROM suppression_list WHERE cui = ?', [cui]);
    const isSuppressed = Boolean(suppression);

    // Check financial evidence
    const financial = await queryOne(
      'SELECT * FROM financial_records WHERE cui = ? ORDER BY fiscal_year DESC LIMIT 1',
      [cui]
    );
    const commEvidence = CompanyVerificationService.evaluateCommercialEvidence(
      financial,
      company.incorporation_date
    );

    // Re-evaluate eligibility
    const eligibility = CompanyVerificationService.evaluateCompanyEligibility({
      legalStatus,
      fiscalStatus: company.fiscal_status || 'UNKNOWN',
      commercialEvidenceStatus: commEvidence.status,
      hasValidContact,
      contactVerificationStatus: usableContact?.verification_status,
      isSuppressed,
      lastStatusCheckAt: nowIso,
    });

    // Update companies table
    await executeRun(
      `UPDATE companies SET
        onrc_status = ?,
        onrc_status_date = ?,
        onrc_verified_at = ?,
        onrc_verification_notes = ?,
        onrc_verified_by = ?,
        legal_status = ?,
        is_calling_eligible = ?,
        ineligibility_reasons = ?,
        updated_at = datetime('now')
      WHERE cui = ?`,
      [
        onrcStatus,
        resolutionDate || null,
        nowIso,
        notes || null,
        adminEmail,
        legalStatus,
        eligibility.isEligible ? 1 : 0,
        eligibility.reasonsText || null,
        cui,
      ]
    );

    // Record persistent audit evidence
    const nextDue = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await executeRun(
      `INSERT INTO company_status_evidence (
        cui, source_name, source_url, query_timestamp, response_timestamp,
        status_returned, effective_date, verification_method, raw_response_ref,
        last_successful_verification, next_verification_due, verified_by
      ) VALUES (?, 'ONRC_PORTAL_MANUAL_CHECK', 'https://portal.onrc.ro',
                ?, ?, ?, ?, 'MANUAL_ADMIN_RECOM_VERIFICATION', ?, ?, ?, ?)`,
      [
        cui,
        nowIso,
        nowIso,
        `ONRC:${onrcStatus}|LEGAL:${legalStatus}`,
        resolutionDate || null,
        `ONRC_MANUAL: ${notes || 'Verificat manual de administrator'}`,
        nowIso,
        nextDue,
        adminEmail,
      ]
    );

    const updated = await queryOne('SELECT * FROM companies WHERE cui = ?', [cui]);

    return NextResponse.json({
      success: true,
      data: {
        company: updated,
        eligibility,
        onrcStatus,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Eroare la actualizarea verificării ONRC' },
      { status: 500 }
    );
  }
}
