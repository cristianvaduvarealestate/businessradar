import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll } from '@/lib/db';
import { getCategoriesForCaen } from '@/lib/caen';
import { validateRequest } from '@/lib/auth';
import { InsuranceIntelligenceService } from '@/lib/insurance/intelligence';
import { NationalSearchEngine } from '@/lib/national/search-engine';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { cui: string } }
) {
  const auth = await validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate' } }
    );
  }

  try {
    const cui = parseInt(params.cui, 10);
    if (isNaN(cui)) {
      return NextResponse.json({ success: false, error: 'CUI invalid' }, { status: 400 });
    }

    let company = await queryOne('SELECT * FROM companies WHERE cui = ?', [cui]);
    let isNationalDirectoryOnly = false;

    if (!company) {
      // Fallback to National Dataset (R2 / local shards)
      try {
        const nationalComp = await NationalSearchEngine.getByCui(cui);
        if (nationalComp) {
          isNationalDirectoryOnly = true;
          company = {
            id: -nationalComp.cui,
            cui: nationalComp.cui,
            name: nationalComp.name,
            legal_form: nationalComp.legal_form,
            county: nationalComp.county,
            city: nationalComp.city,
            reg_com: nationalComp.reg_com,
            euid: nationalComp.euid,
            registration_date: nationalComp.registration_date,
            legal_status: nationalComp.legal_status || 'ACTIVE',
            fiscal_status: nationalComp.fiscal_status || 'UNKNOWN',
            primary_caen: nationalComp.primary_caen,
            caen_description: nationalComp.caen_description,
            classification: 'HISTORICAL',
            discovery_source: 'ONRC_NATIONAL_CSV',
          };
        }
      } catch {}
    }

    if (!company) {
      return NextResponse.json({ success: false, error: 'Compania nu a fost găsită' }, { status: 404 });
    }

    const taxRecord = isNationalDirectoryOnly ? null : await queryOne('SELECT * FROM tax_records WHERE cui = ?', [cui]);
    const financials = isNationalDirectoryOnly ? [] : await queryAll('SELECT * FROM financial_records WHERE cui = ? ORDER BY fiscal_year DESC', [cui]);
    const contacts = isNationalDirectoryOnly ? [] : await queryAll('SELECT * FROM contact_records WHERE cui = ? ORDER BY confidence_score DESC, discovered_at DESC', [cui]);
    const opportunities = isNationalDirectoryOnly ? [] : await queryAll('SELECT * FROM insurance_opportunities WHERE cui = ? ORDER BY confidence_level DESC', [cui]);
    const pipeline = isNationalDirectoryOnly ? null : await queryOne('SELECT * FROM prospect_pipeline WHERE cui = ?', [cui]);
    const interactions = isNationalDirectoryOnly ? [] : await queryAll('SELECT * FROM crm_interactions WHERE cui = ? ORDER BY created_at DESC LIMIT 50', [cui]);
    const followUps = isNationalDirectoryOnly ? [] : await queryAll('SELECT * FROM crm_follow_ups WHERE cui = ? ORDER BY due_date ASC, created_at DESC', [cui]);
    const statusHistory = isNationalDirectoryOnly ? [] : await queryAll('SELECT * FROM crm_status_history WHERE cui = ? ORDER BY created_at DESC LIMIT 20', [cui]);
    const secondaryCaens = isNationalDirectoryOnly ? [] : await queryAll('SELECT * FROM company_secondary_caen WHERE cui = ?', [cui]);
    const isSuppressed = isNationalDirectoryOnly ? false : await queryOne('SELECT * FROM suppression_list WHERE cui = ?', [cui]);

    const insuranceBriefing = InsuranceIntelligenceService.generateBriefing({
      cui: company.cui,
      name: company.name,
      primaryCaen: company.primary_caen,
      caenDescription: company.caen_description,
      legalStatus: company.legal_status,
      fiscalStatus: company.fiscal_status,
      employeesAvg: company.employees_avg,
      turnover: company.turnover,
      latestFinancialYear: company.latest_financial_year,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          company,
          isNationalDirectoryOnly,
          taxRecord,
          financials,
          contacts,
          opportunities,
          pipeline,
          interactions,
          followUps,
          statusHistory,
          secondaryCaens,
          categories: getCategoriesForCaen(company.primary_caen),
          isSuppressed: !!isSuppressed,
          insuranceBriefing,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
