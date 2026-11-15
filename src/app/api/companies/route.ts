import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll } from '@/lib/db';
import { getCategoriesForCaen, INDUSTRY_CATEGORIES } from '@/lib/caen';
import { validateRequest } from '@/lib/auth';

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
    const allowedSortFields = ['opportunity_score', 'first_observed_at', 'name'];
    const safeSort = allowedSortFields.includes(sortField) ? sortField : 'opportunity_score';

    // Query Data
    const querySql = `
      SELECT 
        id, cui, name, normalized_name, reg_com, legal_form, incorporation_date,
        country, county, city, primary_caen, caen_description, status,
        website, first_observed_at, last_observed_at, data_completeness_score,
        opportunity_score, financial_trend, prospect_priority,
        (SELECT pp.status FROM prospect_pipeline pp WHERE pp.cui = companies.cui) as crm_status,
        (SELECT pp.next_follow_up_date FROM prospect_pipeline pp WHERE pp.cui = companies.cui) as next_follow_up_date,
        (SELECT COUNT(*) FROM contact_records cr WHERE cr.cui = companies.cui) as contact_count,
        (SELECT COUNT(*) FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'MOBILE' OR cr.contact_value LIKE '+407%' OR cr.contact_value LIKE '07%')) as has_mobile,
        (SELECT COUNT(*) FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'LANDLINE' OR cr.contact_value LIKE '+402%' OR cr.contact_value LIKE '02%' OR cr.contact_value LIKE '+403%' OR cr.contact_value LIKE '03%')) as has_landline,
        (SELECT COUNT(*) FROM contact_records cr WHERE cr.cui = companies.cui AND cr.contact_type LIKE '%EMAIL%') as has_email,
        (SELECT CASE WHEN companies.website IS NOT NULL AND companies.website != '' THEN 1 ELSE 0 END) as has_website,
        (SELECT COALESCE(cr.normalized_value, cr.contact_value) FROM contact_records cr WHERE cr.cui = companies.cui AND (cr.contact_type = 'MOBILE' OR cr.contact_type = 'LANDLINE' OR cr.contact_type LIKE '%PHONE%') ORDER BY cr.confidence_score DESC LIMIT 1) as sample_phone,
        (SELECT COALESCE(cr.normalized_value, cr.contact_value) FROM contact_records cr WHERE cr.cui = companies.cui AND cr.contact_type LIKE '%EMAIL%' ORDER BY cr.confidence_score DESC LIMIT 1) as sample_email
      FROM companies
      ${whereSql}
      ORDER BY ${safeSort} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const items = await queryAll(querySql, [...params, limit, offset]);

    // Enrich with categories
    const enrichedItems = items.map((c: any) => ({
      ...c,
      categories: getCategoriesForCaen(c.primary_caen),
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
