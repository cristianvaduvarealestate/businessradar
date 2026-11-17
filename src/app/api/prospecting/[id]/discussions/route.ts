import { NextRequest, NextResponse } from 'next/server';
import { queryAll, executeRun } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { COMMERCIAL_STATUSES } from '@/lib/prospecting-types';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate' } }
    );
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID lipsă.' }, { status: 400 });
    }

    const discussions = await queryAll(
      `SELECT * FROM prospect_discussions WHERE prospect_id = ? ORDER BY interaction_date DESC, created_at DESC`,
      [id]
    );

    return NextResponse.json({ success: true, data: discussions });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate' } }
    );
  }

  try {
    const { id: prospectId } = await params;
    if (!prospectId) {
      return NextResponse.json({ success: false, error: 'ID lipsă.' }, { status: 400 });
    }

    const body = await request.json();
    const {
      interaction_date,
      interaction_type,
      contact_person,
      discussion_summary,
      interested_products,
      requested_documents,
      offer_to_prepare,
      outcome,
      next_step,
      next_callback_date,
      update_status, // optional status transition
    } = body;

    if (!discussion_summary || !discussion_summary.trim()) {
      return NextResponse.json({ success: false, error: 'Rezumatul discuției este obligatoriu.' }, { status: 400 });
    }

    const discussionId = `disc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const dateToRecord = interaction_date || new Date().toISOString();
    const typeToRecord = interaction_type || 'CALL';

    // 1. Insert discussion into prospect_discussions
    const insertRes = await executeRun(
      `
      INSERT INTO prospect_discussions (
        id, prospect_id, interaction_date, interaction_type,
        contact_person, discussion_summary, interested_products,
        requested_documents, offer_to_prepare, outcome,
        next_step, next_callback_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
      [
        discussionId,
        prospectId,
        dateToRecord,
        typeToRecord,
        contact_person || null,
        discussion_summary.trim(),
        interested_products || null,
        requested_documents || null,
        offer_to_prepare || null,
        outcome || null,
        next_step || null,
        next_callback_date || null,
      ]
    );

    if (!insertRes.success) {
      return NextResponse.json({ success: false, error: 'Eroare la salvarea discuției.' }, { status: 500 });
    }

    // 2. Update prospect record with next callback / next step / status
    const updateClauses: string[] = ["updated_at = datetime('now')"];
    const updateParams: any[] = [];

    if (next_callback_date) {
      updateClauses.push('next_callback_date = ?');
      updateParams.push(next_callback_date);
    }
    if (next_step) {
      updateClauses.push('next_action = ?');
      updateParams.push(next_step);
    }
    if (update_status && COMMERCIAL_STATUSES[update_status as any]) {
      updateClauses.push('commercial_status = ?');
      updateParams.push(update_status);
    }
    if (contact_person) {
      updateClauses.push('decision_maker = COALESCE(decision_maker, ?)');
      updateParams.push(contact_person);
    }

    updateParams.push(prospectId);

    await executeRun(
      `UPDATE prospect_records SET ${updateClauses.join(', ')} WHERE id = ?`,
      updateParams
    );

    return NextResponse.json({
      success: true,
      message: 'Discuție adăugată cu succes.',
      data: { id: discussionId },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
