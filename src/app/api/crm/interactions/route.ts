import { NextRequest, NextResponse } from 'next/server';
import { queryAll, executeRun } from '@/lib/db';
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
    const cui = searchParams.get('cui');

    if (!cui) {
      return NextResponse.json({ success: false, error: 'CUI obligatoriu.' }, { status: 400 });
    }

    const interactions = await queryAll(
      `SELECT * FROM crm_interactions WHERE cui = ? ORDER BY created_at DESC LIMIT 100`,
      [Number(cui)]
    );

    return NextResponse.json(
      { success: true, data: interactions },
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
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const {
      cui,
      interaction_type,
      outcome,
      notes,
      contact_person,
      contact_value,
      next_action,
      next_follow_up_date,
    } = body;

    if (!cui || !interaction_type || !outcome || !notes) {
      return NextResponse.json(
        { success: false, error: 'Câmpurile cui, interaction_type, outcome și notes sunt obligatorii.' },
        { status: 400 }
      );
    }

    const user = auth.user || 'myremaxclubcristianv@gmail.com';

    // 1. Insert interaction
    const result = await executeRun(
      `INSERT INTO crm_interactions (
        cui, interaction_type, outcome, notes, contact_person, contact_value,
        next_action, next_follow_up_date, user_responsible, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        Number(cui),
        interaction_type,
        outcome,
        notes,
        contact_person || null,
        contact_value || null,
        next_action || null,
        next_follow_up_date || null,
        user,
      ]
    );

    // 2. If next_follow_up_date is provided, create a follow-up task
    if (next_follow_up_date) {
      await executeRun(
        `INSERT INTO crm_follow_ups (
          cui, title, description, due_date, priority, status, created_by, created_at
        ) VALUES (?, ?, ?, ?, 'MEDIUM', 'PENDING', ?, datetime('now'))`,
        [
          Number(cui),
          next_action || `Follow-up în urma interacțiunii (${interaction_type})`,
          notes,
          next_follow_up_date,
          user,
        ]
      );

      // Update prospect_pipeline next_follow_up_date
      await executeRun(
        `UPDATE prospect_pipeline 
         SET next_follow_up_date = ?, updated_at = datetime('now')
         WHERE cui = ?`,
        [next_follow_up_date, Number(cui)]
      );
    }

    logAuditEvent({
      user,
      action: 'CRM_INTERACTION_CREATED',
      details: { cui, interaction_type, outcome, next_follow_up_date },
      status: 'ALLOWED',
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Interacțiune înregistrată cu succes.',
      data: { id: result.lastInsertRowid },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
