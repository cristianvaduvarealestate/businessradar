import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, executeRun } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { CompanyVerificationService } from '@/lib/verification/service';

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
    const {
      fiscalYear,
      turnover,
      employeesAvg,
      netProfit,
      netLoss,
      sourceUrl,
      notes,
    } = body;

    const year = parseInt(fiscalYear, 10);
    if (isNaN(year) || year < 1990 || year > 2030) {
      return NextResponse.json(
        { success: false, error: 'An fiscal invalid' },
        { status: 400 }
      );
    }

    const company = await queryOne('SELECT * FROM companies WHERE cui = ?', [cui]);
    if (!company) {
      return NextResponse.json({ success: false, error: 'Compania nu a fost găsită' }, { status: 404 });
    }

    const numTurnover = turnover !== undefined && turnover !== null ? parseFloat(turnover) : 0;
    const numEmployees = employeesAvg !== undefined && employeesAvg !== null ? parseInt(employeesAvg, 10) : 0;
    const numProfit = netProfit !== undefined && netProfit !== null ? parseFloat(netProfit) : 0;
    const numLoss = netLoss !== undefined && netLoss !== null ? parseFloat(netLoss) : 0;
    const nowIso = new Date().toISOString();
    const adminEmail = typeof auth.user === 'string' ? auth.user : 'ADMIN';

    // 1. Insert into financial_records
    await executeRun(
      `INSERT INTO financial_records (
        cui, fiscal_year, turnover, employees_avg, net_profit, net_loss, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [cui, year, numTurnover, numEmployees, numProfit, numLoss]
    );

    // 2. Evaluate commercial evidence
    const commEvidence = CompanyVerificationService.evaluateCommercialEvidence(
      {
        fiscal_year: year,
        turnover: numTurnover,
        employees_avg: numEmployees,
        net_profit: numProfit,
        net_loss: numLoss,
      },
      company.incorporation_date
    );

    // 3. Check usable contact
    const contacts = await queryAll('SELECT * FROM contact_records WHERE cui = ?', [cui]);
    const usableContact = contacts.find(
      (c) =>
        c.contact_value &&
        ['MOBILE', 'LANDLINE'].includes(c.contact_type) &&
        !['UNREACHABLE', 'INVALID', 'WRONG_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED'].includes(c.verification_status || '')
    );
    const hasValidContact = Boolean(usableContact);

    // 4. Check suppression
    const suppression = await queryOne('SELECT * FROM suppression_list WHERE cui = ?', [cui]);
    const isSuppressed = Boolean(suppression);

    // 5. Re-evaluate eligibility
    const eligibility = CompanyVerificationService.evaluateCompanyEligibility({
      legalStatus: company.legal_status || 'UNKNOWN',
      fiscalStatus: company.fiscal_status || 'UNKNOWN',
      commercialEvidenceStatus: commEvidence.status,
      hasValidContact,
      contactVerificationStatus: usableContact?.verification_status,
      isSuppressed,
      lastStatusCheckAt: nowIso,
    });

    // 6. Update companies table
    await executeRun(
      `UPDATE companies SET
        commercial_evidence_status = ?,
        latest_financial_year = ?,
        turnover = ?,
        employees_avg = ?,
        net_profit = ?,
        net_loss = ?,
        financial_source = ?,
        financial_reporting_year = ?,
        financial_notes = ?,
        is_calling_eligible = ?,
        ineligibility_reasons = ?,
        updated_at = datetime('now')
      WHERE cui = ?`,
      [
        commEvidence.status,
        year,
        numTurnover,
        numEmployees,
        numProfit,
        numLoss,
        sourceUrl || 'mfinante.gov.ro / Bilant Anual',
        year,
        notes || null,
        eligibility.isEligible ? 1 : 0,
        eligibility.reasonsText || null,
        cui,
      ]
    );

    // 7. Record status evidence
    await executeRun(
      `INSERT INTO company_status_evidence (
        cui, source_name, source_url, query_timestamp, response_timestamp,
        status_returned, effective_date, verification_method, raw_response_ref,
        last_successful_verification, verified_by
      ) VALUES (?, 'MFINANTE_BALANCE_SHEET', ?, ?, ?, ?, ?, 'FINANCIAL_STATEMENT_FILING', ?, ?, ?)`,
      [
        cui,
        sourceUrl || 'https://mfinante.gov.ro',
        nowIso,
        nowIso,
        `COMMERCIAL_EVIDENCE:${commEvidence.status}|CA:${numTurnover}|SALARIATI:${numEmployees}`,
        `${year}-12-31`,
        `Bilanț depus anul ${year}: CA ${numTurnover} RON, ${numEmployees} salariați`,
        nowIso,
        adminEmail,
      ]
    );

    const updated = await queryOne('SELECT * FROM companies WHERE cui = ?', [cui]);

    return NextResponse.json({
      success: true,
      data: {
        company: updated,
        commercialEvidence: commEvidence,
        eligibility,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Eroare la actualizarea datelor financiare' },
      { status: 500 }
    );
  }
}
