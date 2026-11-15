import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, executeRun } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { getClientIp } from '@/lib/rate-limit';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // today, overdue, upcoming, completed, all
    const cui = searchParams.get('cui');

    let whereClause = '1=1';
    const params: any[] = [];

    if (cui) {
      whereClause += ' AND f.cui = ?';
      params.push(Number(cui));
    }

    const today = new Date().toISOString().slice(0, 10);

    if (filter === 'today') {
      whereClause += " AND f.due_date = ? AND f.status = 'PENDING'";
      params.push(today);
    } else if (filter === 'overdue') {
      whereClause += " AND f.due_date < ? AND f.status = 'PENDING'";
      params.push(today);
    } else if (filter === 'upcoming') {
      whereClause += " AND f.due_date > ? AND f.status = 'PENDING'";
      params.push(today);
    } else if (filter === 'completed') {
      whereClause += " AND f.status = 'COMPLETED'";
    } else if (filter === 'pending') {
      whereClause += " AND f.status = 'PENDING'";
    }

    const sql = `
      SELECT 
        f.id, f.cui, f.title, f.description, f.due_date, f.priority, f.status,
        f.completed_at, f.completed_by, f.created_by, f.created_at,
        c.name as company_name, c.county, c.city, c.primary_caen, c.caen_description,
        c.opportunity_score, c.prospect_priority,
        p.status as pipeline_status
      FROM crm_follow_ups f
      JOIN companies c ON c.cui = f.cui
      LEFT JOIN prospect_pipeline p ON p.cui = f.cui
      WHERE ${whereClause}
      ORDER BY 
        CASE WHEN f.status = 'PENDING' THEN 0 ELSE 1 END,
        f.due_date ASC,
        f.created_at DESC
      LIMIT 100
    `;

    const tasks = await queryAll(sql, params);

    // Get counts for filters
    const countsSql = `
      SELECT 
        COUNT(CASE WHEN due_date = ? AND status = 'PENDING' THEN 1 END) as today_count,
        COUNT(CASE WHEN due_date < ? AND status = 'PENDING' THEN 1 END) as overdue_count,
        COUNT(CASE WHEN due_date > ? AND status = 'PENDING' THEN 1 END) as upcoming_count,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as total_pending
      FROM crm_follow_ups
    `;
    const counts = (await queryOne(countsSql, [today, today, today])) || {
      today_count: 0,
      overdue_count: 0,
      upcoming_count: 0,
      completed_count: 0,
      total_pending: 0,
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          items: tasks,
          counts,
          currentDate: today,
        },
      },
      { headers: { 'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate' } }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const auth = await validateRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { cui, title, description, due_date, priority } = body;

    if (!cui || !title || !due_date) {
      return NextResponse.json(
        { success: false, error: 'Câmpurile cui, title și due_date sunt obligatorii.' },
        { status: 400 }
      );
    }

    const user = auth.user || 'myremaxclubcristianv@gmail.com';

    const result = await executeRun(
      `INSERT INTO crm_follow_ups (
        cui, title, description, due_date, priority, status, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, datetime('now'))`,
      [Number(cui), title, description || null, due_date, priority || 'MEDIUM', user]
    );

    // Update next_follow_up_date on pipeline
    await executeRun(
      `UPDATE prospect_pipeline 
       SET next_follow_up_date = ?, updated_at = datetime('now')
       WHERE cui = ?`,
      [due_date, Number(cui)]
    );

    logAuditEvent({
      user,
      action: 'CRM_FOLLOW_UP_CREATED',
      details: { cui, title, due_date, priority },
      status: 'ALLOWED',
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Sarcină de follow-up programată cu succes.',
      data: { id: result.lastInsertRowid },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const auth = await validateRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, status, due_date, notes } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'ID și status obligatorii.' }, { status: 400 });
    }

    const user = auth.user || 'myremaxclubcristianv@gmail.com';

    if (status === 'COMPLETED') {
      await executeRun(
        `UPDATE crm_follow_ups 
         SET status = 'COMPLETED', completed_at = datetime('now'), completed_by = ?
         WHERE id = ?`,
        [user, Number(id)]
      );
    } else if (status === 'SNOOZED' || status === 'PENDING') {
      if (!due_date) {
        return NextResponse.json({ success: false, error: 'Noua dată de follow-up este obligatorie.' }, { status: 400 });
      }
      await executeRun(
        `UPDATE crm_follow_ups 
         SET status = 'PENDING', due_date = ?, description = COALESCE(description || ' | ' || ?, description)
         WHERE id = ?`,
        [due_date, notes ? `Amânat: ${notes}` : 'Amânat', Number(id)]
      );
    } else if (status === 'CANCELLED') {
      await executeRun(
        `UPDATE crm_follow_ups 
         SET status = 'CANCELLED'
         WHERE id = ?`,
        [Number(id)]
      );
    }

    logAuditEvent({
      user,
      action: 'CRM_FOLLOW_UP_UPDATED',
      details: { id, status, due_date },
      status: 'ALLOWED',
      ip,
    });

    return NextResponse.json({ success: true, message: 'Status follow-up actualizat cu succes.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
