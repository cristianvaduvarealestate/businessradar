import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate' } }
    );
  }

  try {
    const db = getDatabase();

    const pipelineItems = db.prepare(`
      SELECT 
        p.id, p.cui, p.status, p.priority, p.assigned_to, p.next_follow_up_date,
        p.products_discussed, p.quotation_amount, p.notes, p.updated_at,
        c.name as company_name, c.county, c.city, c.primary_caen, c.caen_description,
        c.website, c.opportunity_score
      FROM prospect_pipeline p
      JOIN companies c ON c.cui = p.cui
      ORDER BY p.updated_at DESC
      LIMIT 100
    `).all();

    // Group counts by status
    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM prospect_pipeline 
      GROUP BY status
    `).all();

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
  const auth = validateRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { cui, status, priority, notes, next_follow_up_date, products_discussed, quotation_amount } = body;

    if (!cui) {
      return NextResponse.json({ success: false, error: 'CUI obligatoriu' }, { status: 400 });
    }

    const db = getDatabase();

    db.prepare(`
      INSERT INTO prospect_pipeline (
        cui, status, priority, notes, next_follow_up_date, products_discussed, quotation_amount, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(cui) DO UPDATE SET
        status = COALESCE(excluded.status, prospect_pipeline.status),
        priority = COALESCE(excluded.priority, prospect_pipeline.priority),
        notes = COALESCE(excluded.notes, prospect_pipeline.notes),
        next_follow_up_date = COALESCE(excluded.next_follow_up_date, prospect_pipeline.next_follow_up_date),
        products_discussed = COALESCE(excluded.products_discussed, prospect_pipeline.products_discussed),
        quotation_amount = COALESCE(excluded.quotation_amount, prospect_pipeline.quotation_amount),
        updated_at = datetime('now')
    `).run(
      cui,
      status || 'NEW_DISCOVERED',
      priority || 'STANDARD',
      notes || null,
      next_follow_up_date || null,
      products_discussed || null,
      quotation_amount || null
    );

    logAuditEvent({
      user: auth.user || 'admin',
      action: 'PIPELINE_UPDATE',
      resource: String(cui),
      details: { status, priority },
      status: 'SUCCESS',
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Status actualizat cu succes în pipeline',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
