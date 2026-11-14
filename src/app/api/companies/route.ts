import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getCategoriesForCaen, INDUSTRY_CATEGORIES } from '@/lib/caen';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    if (query) {
      if (/^\d+$/.test(query)) {
        whereClauses.push('c.cui = ?');
        params.push(parseInt(query, 10));
      } else {
        whereClauses.push('(c.name LIKE ? OR c.reg_com LIKE ? OR c.city LIKE ?)');
        const wild = `%${query}%`;
        params.push(wild, wild, wild);
      }
    }

    if (county) {
      whereClauses.push('c.county = ?');
      params.push(county);
    }

    if (city) {
      whereClauses.push('c.city LIKE ?');
      params.push(`%${city}%`);
    }

    if (caen) {
      whereClauses.push('c.primary_caen LIKE ?');
      params.push(`${caen}%`);
    }

    if (category && INDUSTRY_CATEGORIES[category]) {
      const cat = INDUSTRY_CATEGORIES[category];
      const orPrefixes = cat.caenPrefixes.map(() => 'c.primary_caen LIKE ?').join(' OR ');
      whereClauses.push(`(${orPrefixes})`);
      for (const p of cat.caenPrefixes) {
        params.push(`${p}%`);
      }
    }

    if (priority) {
      whereClauses.push('c.prospect_priority = ?');
      params.push(priority);
    }

    if (status) {
      whereClauses.push('c.status = ?');
      params.push(status);
    }

    if (hasWebsite === 'true') {
      whereClauses.push("c.website IS NOT NULL AND c.website != ''");
    }

    if (isNew === 'true') {
      whereClauses.push("datetime(c.first_observed_at, '+90 days') >= datetime('now')");
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total Count
    const countSql = `SELECT COUNT(*) as total FROM companies c ${whereSql}`;
    const totalCount = (db.prepare(countSql).get(...params) as any).total;

    // Paginated Items
    const querySql = `
      SELECT 
        c.id, c.cui, c.name, c.reg_com, c.legal_form, c.incorporation_date,
        c.county, c.city, c.primary_caen, c.caen_description, c.status,
        c.website, c.opportunity_score, c.data_completeness_score, c.prospect_priority,
        c.first_observed_at,
        (SELECT COUNT(*) FROM insurance_opportunities io WHERE io.cui = c.cui) as opp_count,
        (SELECT COUNT(*) FROM contact_records cr WHERE cr.cui = c.cui) as contact_count,
        (SELECT p.status FROM prospect_pipeline p WHERE p.cui = c.cui) as pipeline_status
      FROM companies c
      ${whereSql}
      ORDER BY c.opportunity_score DESC, c.first_observed_at DESC
      LIMIT ? OFFSET ?
    `;

    const items = db.prepare(querySql).all(...params, limit, offset);

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
