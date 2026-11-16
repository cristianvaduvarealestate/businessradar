import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll } from '@/lib/db';
import { getCategoriesForCaen, INDUSTRY_CATEGORIES } from '@/lib/caen';
import { validateRequest } from '@/lib/auth';
import { InsuranceIntelligenceService } from '@/lib/insurance/intelligence';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate' } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get('q')?.trim() || '';
    const county = searchParams.get('county')?.trim() || '';
    const city = searchParams.get('city')?.trim() || '';
    const caen = searchParams.get('caen')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';
    const priority = searchParams.get('priority')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const stage = searchParams.get('stage')?.trim() || '';
    const hasWebsite = searchParams.get('hasWebsite');
    const hasPhone = searchParams.get('hasPhone');
    const hasMobile = searchParams.get('hasMobile');
    const hasLandline = searchParams.get('hasLandline');
    const hasEmail = searchParams.get('hasEmail');
    const hasAnyContact = searchParams.get('hasAnyContact');
    const noContact = searchParams.get('noContact');
    const needsVerification = searchParams.get('needsVerification');
    const isNew = searchParams.get('isNew'); // 'true' for 90 days radar
    const source = searchParams.get('source')?.trim() || '';
    const opportunity = searchParams.get('opportunity')?.trim() || '';
    const requiresCallback = searchParams.get('requiresCallback');

    // Verification & Calling View Filters
    const callingView = searchParams.get('callingView')?.trim() || '';
    const eligibleOnly = searchParams.get('eligibleOnly');
    const ineligibleOnly = searchParams.get('ineligibleOnly');
    const legalStatus = searchParams.get('legalStatus')?.trim() || '';
    const fiscalStatus = searchParams.get('fiscalStatus')?.trim() || '';
    const commercialEvidence = searchParams.get('commercialEvidence')?.trim() || '';
    const exclusionReason = searchParams.get('exclusionReason')?.trim() || '';

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: any[] = [];

    // FTS or Substring Search
    if (query) {
      if (/^\d+$/.test(query)) {
        whereClauses.push('(cui = ? OR cui LIKE ?)');
        params.push(parseInt(query, 10), `${query}%`);
      } else {
        whereClauses.push('(name LIKE ? OR normalized_name LIKE ? OR caen_description LIKE ? OR reg_com LIKE ?)');
        const searchPattern = `%${query}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }
    }

    if (county) {
      whereClauses.push('county = ?');
      params.push(county);
    }

    if (city) {
      whereClauses.push('city LIKE ?');
      params.push(`%${city}%`);
    }

    if (caen) {
      whereClauses.push('primary_caen LIKE ?');
      params.push(`${caen}%`);
    }

    if (priority) {
      whereClauses.push('prospect_priority = ?');
      params.push(priority);
    }

    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    // Calling View (Eligible vs Segmented Review Queues)
    if (callingView === 'eligible' || eligibleOnly === 'true') {
      whereClauses.push('is_calling_eligible = 1');
    } else if (callingView === 'unconfirmed_commercial') {
      whereClauses.push("commercial_evidence_status IN ('NO_FINANCIAL_EVIDENCE', 'LIMITED_COMMERCIAL_EVIDENCE', 'HISTORICAL_ACTIVITY_ONLY', 'COMMERCIAL_ACTIVITY_UNKNOWN') AND legal_status = 'ACTIVE' AND fiscal_status IN ('FISCALLY_ACTIVE', 'REACTIVATED')");
    } else if (callingView === 'new_companies') {
      whereClauses.push("commercial_evidence_status = 'NEW_COMPANY' AND legal_status = 'ACTIVE'");
    } else if (callingView === 'needs_verification') {
      whereClauses.push("(legal_status = 'UNKNOWN' OR onrc_status = 'ONRC_UNVERIFIED') AND legal_status NOT IN ('RADIATED', 'SUSPENDED', 'DISSOLVED', 'IN_LIQUIDATION')");
    } else if (callingView === 'unverified_contacts') {
      whereClauses.push("EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui AND cr.verification_status IN ('WRONG_NUMBER', 'INVALID_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED', 'FORMAT_VALID_ONLY', 'UNVERIFIED'))");
    } else if (callingView === 'excluded' || ineligibleOnly === 'true') {
      whereClauses.push("is_calling_eligible = 0 AND (legal_status IN ('RADIATED', 'SUSPENDED', 'DISSOLVED', 'IN_LIQUIDATION') OR fiscal_status = 'FISCALLY_INACTIVE' OR ineligibility_reasons LIKE '%suprimare%')");
    }

    if (legalStatus) {
      whereClauses.push('legal_status = ?');
      params.push(legalStatus);
    }

    if (fiscalStatus) {
      whereClauses.push('fiscal_status = ?');
      params.push(fiscalStatus);
    }

    if (commercialEvidence) {
      whereClauses.push('commercial_evidence_status = ?');
      params.push(commercialEvidence);
    }

    if (exclusionReason) {
      whereClauses.push('ineligibility_reasons LIKE ?');
      params.push(`%${exclusionReason}%`);
    }

    if (stage) {
      whereClauses.push("EXISTS (SELECT 1 FROM prospect_pipeline pp WHERE pp.cui = companies.cui AND pp.status = ?)");
      params.push(stage);
    }

    if (hasWebsite === 'true') {
      whereClauses.push("website IS NOT NULL AND website != ''");
    }

    if (hasPhone === 'true') {
      whereClauses.push("EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui AND cr.contact_type LIKE '%PHONE%')");
    }

    if (hasMobile === 'true') {
      whereClauses.push("EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'MOBILE' OR cr.contact_value LIKE '+407%' OR cr.contact_value LIKE '07%'))");
    }

    if (hasLandline === 'true') {
      whereClauses.push("EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'LANDLINE' OR cr.contact_value LIKE '+402%' OR cr.contact_value LIKE '02%' OR cr.contact_value LIKE '+403%' OR cr.contact_value LIKE '03%'))");
    }

    if (hasEmail === 'true') {
      whereClauses.push("EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui AND cr.contact_type LIKE '%EMAIL%')");
    }

    if (hasAnyContact === 'true') {
      whereClauses.push("EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui)");
    }

    if (noContact === 'true') {
      whereClauses.push("NOT EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui)");
    }

    if (needsVerification === 'true') {
      whereClauses.push("EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui AND cr.verification_status IN ('UNVERIFIED', 'FORMAT_VALID_ONLY', 'PUBLIC_UNVERIFIED'))");
    }

    if (source === 'ANAF') {
      whereClauses.push("EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui AND cr.source_name = 'ANAF_OPEN_DATA')");
    } else if (source === 'WEBSITE') {
      whereClauses.push("EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui AND cr.source_name = 'OFFICIAL_WEBSITE')");
    } else if (source === 'MANUAL') {
      whereClauses.push("EXISTS (SELECT 1 FROM contact_records cr WHERE cr.cui = companies.cui AND cr.verification_status = 'MANUALLY_CONFIRMED')");
    }

    if (opportunity) {
      whereClauses.push("EXISTS (SELECT 1 FROM insurance_opportunities io WHERE io.cui = companies.cui AND io.product_category = ?)");
      params.push(opportunity);
    }

    if (requiresCallback === 'true') {
      whereClauses.push("EXISTS (SELECT 1 FROM crm_follow_ups cf WHERE cf.cui = companies.cui AND cf.status = 'PENDING')");
    }

    if (isNew === 'true') {
      whereClauses.push("datetime(first_observed_at, '+90 days') >= datetime('now')");
    }

    // Category filtering
    if (category && INDUSTRY_CATEGORIES[category]) {
      const prefixes = INDUSTRY_CATEGORIES[category].caenPrefixes;
      if (prefixes.length > 0) {
        const caenOrs = prefixes.map(() => 'primary_caen LIKE ?').join(' OR ');
        whereClauses.push(`(${caenOrs})`);
        prefixes.forEach((p) => params.push(`${p}%`));
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total Count
    const countSql = `SELECT COUNT(*) as total FROM companies ${whereSql}`;
    const countRes = await queryOne<{ total: number }>(countSql, params);
    const totalCount = countRes?.total ?? 0;

    // Sorting
    const sortField = searchParams.get('sort') || 'opportunity_score';
    const sortOrder = searchParams.get('order')?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const allowedSortFields = ['opportunity_score', 'first_observed_at', 'name', 'turnover', 'employees_avg'];
    const safeSort = allowedSortFields.includes(sortField) ? sortField : 'opportunity_score';

    // Query Data with verification columns
    const querySql = `
      SELECT 
        id, cui, name, normalized_name, reg_com, legal_form, incorporation_date,
        country, county, city, primary_caen, caen_description, status,
        website, first_observed_at, last_observed_at, data_completeness_score,
        opportunity_score, financial_trend, prospect_priority,
        legal_status, legal_status_desc, legal_status_date,
        fiscal_status, fiscal_inactivation_date, fiscal_reactivation_date,
        ro_e_factura, commercial_evidence_status,
        latest_financial_year, turnover, employees_avg, net_profit, net_loss,
        is_calling_eligible, ineligibility_reasons, last_status_check_at, status_verification_source,
        (SELECT pp.status FROM prospect_pipeline pp WHERE pp.cui = companies.cui) as crm_status,
        (SELECT pp.next_follow_up_date FROM prospect_pipeline pp WHERE pp.cui = companies.cui) as next_follow_up_date,
        (SELECT COUNT(*) FROM contact_records cr WHERE cr.cui = companies.cui) as contact_count,
        (SELECT COUNT(*) FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'MOBILE' OR cr.contact_value LIKE '+407%' OR cr.contact_value LIKE '07%')) as has_mobile,
        (SELECT COUNT(*) FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'LANDLINE' OR cr.contact_value LIKE '+402%' OR cr.contact_value LIKE '02%' OR cr.contact_value LIKE '+403%' OR cr.contact_value LIKE '03%')) as has_landline,
        (SELECT COUNT(*) FROM contact_records cr WHERE cr.cui = companies.cui AND cr.contact_type LIKE '%EMAIL%') as has_email,
        (SELECT CASE WHEN companies.website IS NOT NULL AND companies.website != '' THEN 1 ELSE 0 END) as has_website,
        (SELECT COALESCE(cr.normalized_value, cr.contact_value) FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'MOBILE' OR cr.contact_value LIKE '+407%' OR cr.contact_value LIKE '07%') ORDER BY cr.confidence_score DESC LIMIT 1) as mobile_phone,
        (SELECT cr.source_name FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'MOBILE' OR cr.contact_value LIKE '+407%' OR cr.contact_value LIKE '07%') ORDER BY cr.confidence_score DESC LIMIT 1) as mobile_source,
        (SELECT cr.verification_status FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'MOBILE' OR cr.contact_value LIKE '+407%' OR cr.contact_value LIKE '07%') ORDER BY cr.confidence_score DESC LIMIT 1) as mobile_status,
        (SELECT cr.confidence_score FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'MOBILE' OR cr.contact_value LIKE '+407%' OR cr.contact_value LIKE '07%') ORDER BY cr.confidence_score DESC LIMIT 1) as mobile_score,
        (SELECT COALESCE(cr.normalized_value, cr.contact_value) FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'LANDLINE' OR cr.contact_value LIKE '+402%' OR cr.contact_value LIKE '02%' OR cr.contact_value LIKE '+403%' OR cr.contact_value LIKE '03%') ORDER BY cr.confidence_score DESC LIMIT 1) as landline_phone,
        (SELECT cr.source_name FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'LANDLINE' OR cr.contact_value LIKE '+402%' OR cr.contact_value LIKE '02%' OR cr.contact_value LIKE '+403%' OR cr.contact_value LIKE '03%') ORDER BY cr.confidence_score DESC LIMIT 1) as landline_source,
        (SELECT cr.verification_status FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'LANDLINE' OR cr.contact_value LIKE '+402%' OR cr.contact_value LIKE '02%' OR cr.contact_value LIKE '+403%' OR cr.contact_value LIKE '03%') ORDER BY cr.confidence_score DESC LIMIT 1) as landline_status,
        (SELECT cr.confidence_score FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'LANDLINE' OR cr.contact_value LIKE '+402%' OR cr.contact_value LIKE '02%' OR cr.contact_value LIKE '+403%' OR cr.contact_value LIKE '03%') ORDER BY cr.confidence_score DESC LIMIT 1) as landline_score,
        (SELECT COALESCE(cr.normalized_value, cr.contact_value) FROM contact_records cr WHERE cr.cui = companies.cui AND cr.contact_type LIKE '%EMAIL%' ORDER BY cr.confidence_score DESC LIMIT 1) as email_contact,
        (SELECT cr.source_name FROM contact_records cr WHERE cr.cui = companies.cui AND cr.contact_type LIKE '%EMAIL%' ORDER BY cr.confidence_score DESC LIMIT 1) as email_source,
        (SELECT cr.verification_status FROM contact_records cr WHERE cr.cui = companies.cui AND cr.contact_type LIKE '%EMAIL%' ORDER BY cr.confidence_score DESC LIMIT 1) as email_status,
        (SELECT COALESCE(cr.normalized_value, cr.contact_value) FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'MOBILE' OR cr.contact_type = 'LANDLINE' OR cr.contact_type LIKE '%PHONE%') ORDER BY cr.confidence_score DESC LIMIT 1) as sample_phone,
        (SELECT COALESCE(cr.normalized_value, cr.contact_value) FROM contact_records cr WHERE cr.cui = companies.cui AND cr.contact_type LIKE '%EMAIL%' ORDER BY cr.confidence_score DESC LIMIT 1) as sample_email,
        (SELECT GROUP_CONCAT(product_name, ' | ') FROM insurance_opportunities io WHERE io.cui = companies.cui) as insurance_topics,
        (SELECT outcome FROM crm_interactions ci WHERE ci.cui = companies.cui ORDER BY created_at DESC LIMIT 1) as last_interaction_outcome,
        (SELECT created_at FROM crm_interactions ci WHERE ci.cui = companies.cui ORDER BY created_at DESC LIMIT 1) as last_interaction_at
      FROM companies
      ${whereSql}
      ORDER BY ${safeSort} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const items = await queryAll(querySql, [...params, limit, offset]);

    // Enrich with categories and insurance intelligence briefing
    const enrichedItems = items.map((c: any) => ({
      ...c,
      categories: getCategoriesForCaen(c.primary_caen),
      insurance_briefing: InsuranceIntelligenceService.generateBriefing({
        cui: c.cui,
        name: c.name,
        primaryCaen: c.primary_caen,
        caenDescription: c.caen_description,
        legalStatus: c.legal_status,
        fiscalStatus: c.fiscal_status,
        employeesAvg: c.employees_avg,
        turnover: c.turnover,
        latestFinancialYear: c.latest_financial_year,
      }),
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          items: enrichedItems,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalItems: totalCount,
            totalPages: Math.ceil(totalCount / limit) || 1,
          },
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
