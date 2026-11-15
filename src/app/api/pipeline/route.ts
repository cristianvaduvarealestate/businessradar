import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, executeRun } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limit';

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
    const stage = searchParams.get('stage');
    const county = searchParams.get('county');
    const priority = searchParams.get('priority');
    const limit = Math.min(Number(searchParams.get('limit')) || 200, 500);

    let whereSql = '1=1';
    const params: any[] = [];

    if (stage && stage !== 'ALL') {
      whereSql += ' AND p.status = ?';
      params.push(stage);
    }
    if (county) {
      whereSql += ' AND c.county = ?';
      params.push(county);
    }
    if (priority) {
      whereSql += ' AND p.priority = ?';
      params.push(priority);
    }

    const sql = `
      SELECT 
        p.id, p.cui, p.status, p.priority, p.assigned_to, p.next_follow_up_date,
        p.products_discussed, p.quotation_amount, p.notes, p.updated_at,
        c.name as company_name, c.county, c.city, c.primary_caen, c.caen_description,
        c.website, c.opportunity_score, c.prospect_priority,
        (SELECT COUNT(*) FROM crm_interactions ci WHERE ci.cui = p.cui) as interaction_count,
        (SELECT COUNT(*) FROM crm_follow_ups cf WHERE cf.cui = p.cui AND cf.status = 'PENDING') as pending_followup_count,
        (SELECT contact_value FROM contact_records cr WHERE cr.cui = p.cui AND cr.contact_type LIKE '%PHONE%' LIMIT 1) as primary_phone,
        (SELECT contact_value FROM contact_records cr WHERE cr.cui = p.cui AND cr.contact_type LIKE '%EMAIL%' LIMIT 1) as primary_email
      FROM prospect_pipeline p
      JOIN companies c ON c.cui = p.cui
      WHERE ${whereSql}
      ORDER BY p.updated_at DESC
      LIMIT ${limit}
    `;

    const pipelineItems = await queryAll(sql, params);

    // Group counts by status
    const statusCounts = await queryAll(`
      SELECT status, COUNT(*) as count 
      FROM prospect_pipeline 
      GROUP BY status
    `);

    return NextResponse.json(
      {
        success: true,
        data: {
          items: pipelineItems,
          statusCounts,
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

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const auth = await validateRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { cui, status, priority, notes, next_follow_up_date, products_discussed, quotation_amount, reason } = body;

    if (!cui) {
      return NextResponse.json({ success: false, error: 'CUI obligatoriu.' }, { status: 400 });
    }

    const user = auth.user || 'myremaxclubcristianv@gmail.com';

    // 1. Fetch current status to check for status change
    const current = await queryOne<{ status: string; notes: string }>(
      'SELECT status, notes FROM prospect_pipeline WHERE cui = ?',
      [Number(cui)]
    );

    const oldStatus = current?.status || 'NEW';

    // 2. Perform idempotent upsert on prospect_pipeline
    await executeRun(
      `INSERT INTO prospect_pipeline (
        cui, status, priority, notes, next_follow_up_date, products_discussed, quotation_amount, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(cui) DO UPDATE SET
        status = COALESCE(?, prospect_pipeline.status),
        priority = COALESCE(?, prospect_pipeline.priority),
        notes = COALESCE(?, prospect_pipeline.notes),
        next_follow_up_date = COALESCE(?, prospect_pipeline.next_follow_up_date),
        products_discussed = COALESCE(?, prospect_pipeline.products_discussed),
        quotation_amount = COALESCE(?, prospect_pipeline.quotation_amount),
        updated_at = datetime('now')`,
      [
        Number(cui),
        status || 'NEW',
        priority || 'STANDARD',
        notes || null,
        next_follow_up_date || null,
        products_discussed || null,
        quotation_amount || null,
        status || null,
        priority || null,
        notes || null,
        next_follow_up_date || null,
        products_discussed || null,
        quotation_amount || null,
      ]
    );

    // 3. If status changed, record in crm_status_history
    if (status && status !== oldStatus) {
      await executeRun(
        `INSERT INTO crm_status_history (cui, old_status, new_status, reason, changed_by, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [Number(cui), oldStatus, status, reason || null, user]
      );
    }

    // 4. If next_follow_up_date was passed, create a follow-up task
    if (next_follow_up_date) {
      await executeRun(
        `INSERT INTO crm_follow_ups (cui, title, description, due_date, priority, status, created_by, created_at)
         VALUES (?, ?, ?, ?, 'MEDIUM', 'PENDING', ?, datetime('now'))`,
        [Number(cui), `Follow-up planificat etapa ${status || oldStatus}`, notes || null, next_follow_up_date, user]
      );
    }

    logAuditEvent({
      user,
      action: 'PIPELINE_STATUS_UPDATE',
      details: { cui, oldStatus, newStatus: status, priority, next_follow_up_date },
      status: 'ALLOWED',
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Pipeline actualizat cu succes.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
