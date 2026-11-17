import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { COMMERCIAL_STATUSES, CommercialStatusKey, PortfolioType } from '@/lib/prospecting-types';

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
    const portfolio = searchParams.get('portfolio') as PortfolioType || 'GENERAL';
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status') as CommercialStatusKey | null;
    const callbackFilter = searchParams.get('callback_filter'); // 'today' | 'overdue' | 'week'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ['portfolio_type = ?'];
    const params: any[] = [portfolio];

    if (search) {
      whereClauses.push(`(
        company_name LIKE ? OR 
        city LIKE ? OR 
        domain LIKE ? OR 
        phones LIKE ? OR 
        emails LIKE ? OR 
        cui LIKE ?
      )`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (status && COMMERCIAL_STATUSES[status]) {
      whereClauses.push('commercial_status = ?');
      params.push(status);
    }

    const todayDate = new Date().toISOString().split('T')[0];

    if (callbackFilter === 'today') {
      whereClauses.push(`date(next_callback_date) = date(?)`);
      params.push(todayDate);
    } else if (callbackFilter === 'overdue') {
      whereClauses.push(`date(next_callback_date) < date(?) AND commercial_status NOT IN ('CLOSED_WON_POLICY_ISSUED', 'CLOSED_LOST_DEFINITIVE_REFUSAL')`);
      params.push(todayDate);
    } else if (callbackFilter === 'week') {
      whereClauses.push(`date(next_callback_date) >= date(?) AND date(next_callback_date) <= date(?, '+7 days')`);
      params.push(todayDate, todayDate);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count with current filters
    const countRow = await queryOne<{ total: number }>(
      `SELECT count(*) as total FROM prospect_records ${whereSql}`,
      params
    );
    const total = countRow?.total || 0;

    // Fetch paginated records with discussions count and last interaction date
    const querySql = `
      SELECT 
        pr.*,
        (SELECT count(*) FROM prospect_discussions pd WHERE pd.prospect_id = pr.id) as discussions_count,
        (SELECT max(pd.interaction_date) FROM prospect_discussions pd WHERE pd.prospect_id = pr.id) as last_discussion_date
      FROM prospect_records pr
      ${whereSql}
      ORDER BY 
        CASE 
          WHEN pr.next_callback_date IS NOT NULL AND date(pr.next_callback_date) <= date('${todayDate}') THEN 0
          WHEN pr.next_callback_date IS NOT NULL THEN 1
          ELSE 2
        END,
        pr.updated_at DESC
      LIMIT ? OFFSET ?
    `;

    const rawRecords = await queryAll(querySql, [...params, limit, offset]);

    const formattedRecords = rawRecords.map((r: any) => {
      let phones: string[] = [];
      let emails: string[] = [];
      let confirmedProducts: string[] = [];

      try {
        phones = r.phones ? JSON.parse(r.phones) : [];
      } catch {
        phones = r.phones ? [r.phones] : [];
      }

      try {
        emails = r.emails ? JSON.parse(r.emails) : [];
      } catch {
        emails = r.emails ? [r.emails] : [];
      }

      try {
        confirmedProducts = r.confirmed_interested_products ? JSON.parse(r.confirmed_interested_products) : [];
      } catch {
        confirmedProducts = [];
      }

      return {
        ...r,
        phones,
        emails,
        confirmed_interested_products: confirmedProducts,
      };
    });

    // Compute status counts for the selected portfolio
    const statusCountsRaw = await queryAll<{ commercial_status: string; cnt: number }>(
      `SELECT commercial_status, count(*) as cnt FROM prospect_records WHERE portfolio_type = ? GROUP BY commercial_status`,
      [portfolio]
    );

    const statusCounts: Record<string, number> = {};
    for (const key of Object.keys(COMMERCIAL_STATUSES)) {
      statusCounts[key] = 0;
    }
    for (const row of statusCountsRaw) {
      statusCounts[row.commercial_status] = row.cnt;
    }

    // Compute callback counts
    const callbackCounts = await queryOne<{ overdue: number; today: number; week: number }>(
      `
      SELECT 
        SUM(CASE WHEN date(next_callback_date) < date('${todayDate}') AND commercial_status NOT IN ('CLOSED_WON_POLICY_ISSUED', 'CLOSED_LOST_DEFINITIVE_REFUSAL') THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN date(next_callback_date) = date('${todayDate}') THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN date(next_callback_date) >= date('${todayDate}') AND date(next_callback_date) <= date('${todayDate}', '+7 days') THEN 1 ELSE 0 END) as week
      FROM prospect_records
      WHERE portfolio_type = ?
      `,
      [portfolio]
    );

    return NextResponse.json({
      success: true,
      data: formattedRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      status_counts: statusCounts,
      callback_counts: {
        overdue: callbackCounts?.overdue || 0,
        today: callbackCounts?.today || 0,
        week: callbackCounts?.week || 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching prospects:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
