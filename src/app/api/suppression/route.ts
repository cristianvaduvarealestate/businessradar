import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, executeRun } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const list = await queryAll(`
      SELECT s.*, c.name as company_name, c.county, c.city 
      FROM suppression_list s
      LEFT JOIN companies c ON c.cui = s.cui
      ORDER BY s.added_at DESC
      LIMIT 200
    `);

    return NextResponse.json(
      { success: true, data: list },
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
    const { cui, reason, domain, email, phone } = body;

    if (!cui && !domain && !email && !phone) {
      return NextResponse.json(
        { success: false, error: 'Specificați cel puțin un CUI, domeniu, email sau telefon.' },
        { status: 400 }
      );
    }

    const user = auth.user || 'myremaxclubcristianv@gmail.com';
    const reasonText = reason || 'Solicitare excludere prospectare (DO NOT CONTACT)';

    await executeRun(
      `INSERT INTO suppression_list (cui, domain, email, phone, reason, added_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(cui) DO UPDATE SET reason = excluded.reason, added_at = datetime('now')`,
      [cui ? Number(cui) : null, domain || null, email || null, phone || null, reasonText]
    );

    // If CUI was provided, also set prospect_pipeline.status = 'DO_NOT_CONTACT'
    if (cui) {
      await executeRun(
        `UPDATE prospect_pipeline 
         SET status = 'DO_NOT_CONTACT', notes = COALESCE(notes || ' | ' || ?, ?), updated_at = datetime('now')
         WHERE cui = ?`,
        [reasonText, reasonText, Number(cui)]
      );

      // Record in status history
      await executeRun(
        `INSERT INTO crm_status_history (cui, old_status, new_status, reason, changed_by, created_at)
         VALUES (?, 'ANY', 'DO_NOT_CONTACT', ?, ?, datetime('now'))`,
        [Number(cui), reasonText, user]
      );
    }

    logAuditEvent({
      user,
      action: 'SUPPRESSION_ADDED',
      details: { cui, reason: reasonText, domain, email, phone },
      status: 'ALLOWED',
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Entitatea a fost adăugată în lista de supresie (DO NOT CONTACT).',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const auth = await validateRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const cui = searchParams.get('cui');

    if (!id && !cui) {
      return NextResponse.json({ success: false, error: 'ID sau CUI obligatoriu.' }, { status: 400 });
    }

    if (id) {
      await executeRun(`DELETE FROM suppression_list WHERE id = ?`, [Number(id)]);
    } else if (cui) {
      await executeRun(`DELETE FROM suppression_list WHERE cui = ?`, [Number(cui)]);
    }

    logAuditEvent({
      user: auth.user || 'admin',
      action: 'SUPPRESSION_REMOVED',
      details: { id, cui },
      status: 'ALLOWED',
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Entitatea a fost eliminată din lista de supresie.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
