import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getCategoriesForCaen, INDUSTRY_CATEGORIES } from '@/lib/caen';
import { validateRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Defense-in-depth auth check
  const auth = validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate' } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const db = getDatabase();

    const query = searchParams.get('q')?.trim() || '';
    const county = searchParams.get('county')?.trim() || '';
    const city = searchParams.get('city')?.trim() || '';
    const caen = searchParams.get('caen')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';
    const priority = searchParams.get('priority')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const hasWebsite = searchParams.get('hasWebsite');
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
      whereClauses.push('primary_caen = ?');
      params.push(caen);
    }

    if (priority) {
      whereClauses.push('prospect_priority = ?');
      params.push(priority);
    }

    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    if (hasWebsite === 'true') {
      whereClauses.push("website IS NOT NULL AND website != ''");
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
    const totalCount = (db.prepare(countSql).get(...params) as any).total;

    // Sorting
    const sortField = searchParams.get('sort') || 'opportunity_score';
    const sortOrder = searchParams.get('order')?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const allowedSortFields = ['opportunity_score', 'first_observed_at', 'name', 'turnover', 'employees_avg'];
    const safeSort = allowedSortFields.includes(sortField) ? sortField : 'opportunity_score';

    // Query Data
    const querySql = `
      SELECT 
        id, cui, name, normalized_name, reg_com, legal_form, incorporation_date,
        country, county, city, primary_caen, caen_description, status,
        website, first_observed_at, last_observed_at, data_completeness_score,
        opportunity_score, financial_trend, prospect_priority
      FROM companies
      ${whereSql}
      ORDER BY ${safeSort} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const items = db.prepare(querySql).all(...params, limit, offset);

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
            totalItems: totalCount,
            totalPages: Math.ceil(totalCount / limit),
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
