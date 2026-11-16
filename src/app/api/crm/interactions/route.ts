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
      verify_contact,
      add_to_suppression,
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

    // 2. Map outcome to CRM Pipeline stage
    let newPipelineStatus: string | null = null;
    if (outcome === 'DO_NOT_CONTACT') newPipelineStatus = 'DO_NOT_CONTACT';
    else if (outcome === 'INTERESTED') newPipelineStatus = 'INTERESTED';
    else if (outcome === 'OFFER_REQUESTED') newPipelineStatus = 'OFFER_REQUESTED';
    else if (outcome === 'OFFER_SENT') newPipelineStatus = 'OFFER_SENT';
    else if (outcome === 'MEETING_SCHEDULED') newPipelineStatus = 'IN_DISCUSSION';
    else if (outcome === 'CALLBACK_REQUESTED') newPipelineStatus = 'CALLBACK_REQUESTED';
    else if (outcome === 'NOT_INTERESTED' || outcome === 'EXISTING_INSURANCE') newPipelineStatus = 'NOT_INTERESTED';
    else if (outcome === 'NO_ANSWER' || outcome === 'UNAVAILABLE' || outcome === 'WRONG_NUMBER') newPipelineStatus = 'NO_ANSWER';
    else if (outcome === 'RECEPTION_ANSWERED' || outcome === 'DECISION_MAKER_IDENTIFIED') newPipelineStatus = 'CONTACTED';

    if (newPipelineStatus) {
      await executeRun(
        `UPDATE prospect_pipeline 
         SET status = ?, updated_at = datetime('now')
         WHERE cui = ?`,
        [newPipelineStatus, Number(cui)]
      );

      await executeRun(
        `INSERT INTO crm_status_history (cui, old_status, new_status, reason, changed_by, created_at)
         VALUES (?, (SELECT status FROM prospect_pipeline WHERE cui = ?), ?, ?, ?, datetime('now'))`,
        [Number(cui), Number(cui), newPipelineStatus, `Actualizat în urma apelului: ${outcome}`, user]
      );
    }

    // 3. If next_follow_up_date is provided, create a follow-up task
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

    // 4. Manual verification action: preserve original source, update verification status
    if (verify_contact && contact_value) {
      await executeRun(
        `UPDATE contact_records 
         SET verification_status = 'MANUALLY_CONFIRMED',
             confidence_score = 1.0,
             last_checked_at = datetime('now'),
             notes = COALESCE(notes || '; ', '') || 'Confirmat activ prin apel de ' || ?
         WHERE cui = ? AND (contact_value = ? OR normalized_value = ?)`,
        [user, Number(cui), contact_value, contact_value]
      );
    }

    // 5. If DO_NOT_CONTACT requested and marked for suppression
    if (outcome === 'DO_NOT_CONTACT' || add_to_suppression) {
      await executeRun(
        `INSERT OR IGNORE INTO suppression_list (cui, phone, reason, added_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [Number(cui), contact_value || null, 'Cerere expresă client: NU CONTACTA']
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
