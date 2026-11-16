import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, executeRun } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { AnafTaxConnector } from '@/lib/providers/anaf';
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
  if (isNaN(cui) || cui <= 0) {
    return NextResponse.json({ success: false, error: 'CUI invalid' }, { status: 400 });
  }

  try {
    const company = await queryOne('SELECT * FROM companies WHERE cui = ?', [cui]);
    if (!company) {
      return NextResponse.json({ success: false, error: 'Compania nu a fost găsită' }, { status: 404 });
    }

    // 1. Query ANAF v9 in real time
    const anaf = new AnafTaxConnector();
    let anafItem: any = null;
    let providerError = false;

    try {
      const anafResults = await anaf.fetchBatchTaxStatus([cui]);
      if (anafResults && anafResults.length > 0) {
        anafItem = anafResults[0];
      }
    } catch (err: any) {
      providerError = true;
    }

    const nowIso = new Date().toISOString();

    // If provider error occurred, do not corrupt or overwrite valid existing company statuses
    if (providerError) {
      await executeRun(
        `INSERT INTO company_status_evidence (
          cui, source_name, source_url, query_timestamp, response_timestamp,
          status_returned, effective_date, verification_method, raw_response_ref,
          last_successful_verification, next_verification_due, provider_error, verified_by
        ) VALUES (?, 'ANAF_PLATITOR_TVA_REST_V9', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva',
                  ?, ?, 'ERROR:PROVIDER_UNAVAILABLE', NULL, 'OFFICIAL_SYNCHRONOUS_REST_API', 'ANAF_CONNECTION_FAILED',
                  ?, ?, 'CONNECTION_FAILED', ?)`,
        [
          cui,
          nowIso,
          nowIso,
          company.last_status_check_at,
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          typeof auth.user === 'string' ? auth.user : 'ADMIN_MANUAL',
        ]
      );
      return NextResponse.json(
        {
          success: false,
          error: 'Serviciul ANAF este temporar indisponibil',
          message: 'Cererea către serverul ANAF v9 a întâmpinat o eroare de conexiune. Statutul companiei din baza de date a fost conservat.',
        },
        { status: 502 }
      );
    }

    // 2. Parse Legal Status
    let legalStatusResult;
    if (anafItem) {
      legalStatusResult = CompanyVerificationService.parseLegalStatus(anafItem.stare_inregistrare);
    } else {
      legalStatusResult = {
        status: 'UNKNOWN' as const,
        description: 'Negăsit în baza de date fiscală ANAF',
      };
    }

    // 3. Parse Fiscal Status
    let fiscalStatusResult;
    if (anafItem) {
      fiscalStatusResult = CompanyVerificationService.parseFiscalStatus({
        statusInactivi: anafItem.statusInactivi,
        dataInactivare: anafItem.dataInactivare,
        dataReactivare: anafItem.dataReactivare,
        statusRO_e_Factura: anafItem.statusRO_e_Factura,
        scpTVA: anafItem.scpTVA,
      });
    } else {
      fiscalStatusResult = {
        status: 'UNKNOWN' as const,
      };
    }

    // 4. Save any declared contacts discovered
    if (anafItem && anafItem.discoveredContacts && anafItem.discoveredContacts.length > 0) {
      for (const dc of anafItem.discoveredContacts) {
        await executeRun(
          `INSERT OR IGNORE INTO contact_records (
            cui, contact_type, contact_value, normalized_value, label,
            source_name, provenance_url, verification_method, verification_status,
            confidence_score, notes, last_checked_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            cui,
            dc.contactType,
            dc.originalValue || dc.normalizedValue,
            dc.normalizedValue,
            dc.label,
            dc.sourceName,
            dc.provenanceUrl,
            dc.verificationMethod,
            dc.verificationStatus,
            dc.confidenceScore,
            dc.notes,
          ]
        );
      }
    }

    // 5. Check if usable contact exists
    const contacts = await queryAll('SELECT * FROM contact_records WHERE cui = ?', [cui]);
    const usableContact = contacts.find(
      (c) =>
        c.contact_value &&
        ['MOBILE', 'LANDLINE'].includes(c.contact_type) &&
        !['UNREACHABLE', 'INVALID', 'WRONG_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED'].includes(c.verification_status || '')
    );
    const hasValidContact = Boolean(usableContact);

    // 6. Check suppression
    const suppression = await queryOne('SELECT * FROM suppression_list WHERE cui = ?', [cui]);
    const isSuppressed = Boolean(suppression);

    // 7. Check financial evidence
    const financial = await queryOne(
      'SELECT * FROM financial_records WHERE cui = ? ORDER BY fiscal_year DESC LIMIT 1',
      [cui]
    );
    const commEvidence = CompanyVerificationService.evaluateCommercialEvidence(
      financial,
      company.incorporation_date
    );

    // 8. Central Eligibility Decision
    const eligibility = CompanyVerificationService.evaluateCompanyEligibility({
      legalStatus: legalStatusResult.status,
      fiscalStatus: fiscalStatusResult.status,
      commercialEvidenceStatus: commEvidence.status,
      hasValidContact,
      contactVerificationStatus: usableContact?.verification_status,
      isSuppressed,
      lastStatusCheckAt: nowIso,
    });

    // 9. Update DB & Record Persistent Audit Evidence
    await executeRun(
      `UPDATE companies SET
        legal_status = ?,
        legal_status_desc = ?,
        legal_status_date = ?,
        fiscal_status = ?,
        fiscal_inactivation_date = ?,
        fiscal_reactivation_date = ?,
        ro_e_factura = ?,
        commercial_evidence_status = ?,
        is_calling_eligible = ?,
        ineligibility_reasons = ?,
        last_status_check_at = datetime('now'),
        status_verification_source = 'ANAF_FISCAL_REGISTER',
        onrc_status = COALESCE(onrc_status, 'ONRC_UNVERIFIED')
      WHERE cui = ?`,
      [
        legalStatusResult.status,
        legalStatusResult.description,
        legalStatusResult.date || null,
        fiscalStatusResult.status,
        fiscalStatusResult.inactivationDate || null,
        fiscalStatusResult.reactivationDate || null,
        fiscalStatusResult.isRoEFactura ? 1 : 0,
        commEvidence.status,
        eligibility.isEligible ? 1 : 0,
        eligibility.reasonsText || null,
        cui,
      ]
    );

    // Record persistent status evidence
    const evidenceStatus = `LEGAL:${legalStatusResult.status}|FISCAL:${fiscalStatusResult.status}|EFACTURA:${fiscalStatusResult.isRoEFactura ? 1 : 0}`;
    const nextDue = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await executeRun(
      `INSERT INTO company_status_evidence (
        cui, source_name, source_url, query_timestamp, response_timestamp,
        status_returned, effective_date, verification_method, raw_response_ref,
        last_successful_verification, next_verification_due, provider_error, verified_by
      ) VALUES (?, 'ANAF_PLATITOR_TVA_REST_V9', 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva',
                ?, ?, ?, ?, 'OFFICIAL_SYNCHRONOUS_REST_API', ?, ?, ?, ?, ?)`,
      [
        cui,
        nowIso,
        nowIso,
        evidenceStatus,
        legalStatusResult.date || fiscalStatusResult.inactivationDate || null,
        `ANAF_LIVE_STARE: ${legalStatusResult.description}`,
        nowIso,
        nextDue,
        providerError ? 'CONNECTION_FAILED' : null,
        typeof auth.user === 'string' ? auth.user : 'ADMIN_MANUAL',
      ]
    );

    const updated = await queryOne('SELECT * FROM companies WHERE cui = ?', [cui]);

    return NextResponse.json({
      success: true,
      data: {
        company: updated,
        eligibility,
        legalStatus: legalStatusResult,
        fiscalStatus: fiscalStatusResult,
        commercialEvidence: commEvidence,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Eroare la verificare' },
      { status: 500 }
    );
  }
}
