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
  if (isNaN(cui)) {
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

    // 2. Parse Legal Status
    let legalStatusResult;
    if (providerError) {
      legalStatusResult = {
        status: 'VERIFICATION_ERROR' as const,
        description: 'Eroare conexiune serviciu ANAF/ONRC',
      };
    } else if (anafItem) {
      legalStatusResult = CompanyVerificationService.parseLegalStatus(anafItem.stare_inregistrare);
    } else {
      legalStatusResult = {
        status: 'UNKNOWN' as const,
        description: 'Negăsit în baza de date fiscală ANAF',
      };
    }

    // 3. Parse Fiscal Status
    let fiscalStatusResult;
    if (providerError) {
      fiscalStatusResult = {
        status: 'VERIFICATION_ERROR' as const,
      };
    } else if (anafItem) {
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
            cui, contact_type, original_value, contact_value, label,
            source_name, provenance_url, verification_method, verification_status,
            confidence_score, notes, last_checked_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            cui,
            dc.contactType,
            dc.originalValue,
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

    // 5. Check if contact exists
    const contacts = await queryAll('SELECT * FROM contact_records WHERE cui = ?', [cui]);
    const validContact = contacts.find(
      (c) =>
        c.contact_value &&
        !['UNREACHABLE', 'INVALID', 'WRONG_NUMBER'].includes(c.verification_status || '')
    );
    const hasValidContact = Boolean(validContact);

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
      isSuppressed,
    });

    // 9. Update DB
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
        status_verification_source = 'ANAF_V9_LIVE'
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
