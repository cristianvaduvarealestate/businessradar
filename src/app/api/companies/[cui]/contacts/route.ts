import { NextRequest, NextResponse } from 'next/server';
import { queryAll, executeRun } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { cui: string } }
) {
  const auth = await validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cui = Number(params.cui);
    if (!cui || isNaN(cui)) {
      return NextResponse.json({ success: false, error: 'CUI invalid' }, { status: 400 });
    }

    const contacts = await queryAll(
      `SELECT * FROM contact_records WHERE cui = ? ORDER BY confidence_score DESC, discovered_at DESC`,
      [cui]
    );

    return NextResponse.json({ success: true, data: contacts });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { cui: string } }
) {
  const ip = getClientIp(request.headers);
  const auth = await validateRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cui = Number(params.cui);
    if (!cui || isNaN(cui)) {
      return NextResponse.json({ success: false, error: 'CUI invalid' }, { status: 400 });
    }

    const body = await request.json();
    const {
      contact_type,
      contact_value,
      normalized_value,
      label,
      source_name,
      provenance_url,
      verification_method,
      verification_status,
      confidence_score,
      contact_person,
      contact_person_position,
      notes,
    } = body;

    if (!contact_type || !contact_value) {
      return NextResponse.json(
        { success: false, error: 'contact_type și contact_value sunt obligatorii.' },
        { status: 400 }
      );
    }

    const user = auth.user || 'myremaxclubcristianv@gmail.com';

    await executeRun(
      `INSERT INTO contact_records (
        cui, contact_type, contact_value, normalized_value, label,
        source_name, provenance_url, verification_method, verification_status,
        confidence_score, contact_person, contact_person_position, notes,
        discovered_at, last_checked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
        normalized_value = excluded.normalized_value,
        label = excluded.label,
        source_name = excluded.source_name,
        provenance_url = excluded.provenance_url,
        verification_method = excluded.verification_method,
        verification_status = excluded.verification_status,
        confidence_score = excluded.confidence_score,
        contact_person = excluded.contact_person,
        contact_person_position = excluded.contact_person_position,
        notes = excluded.notes,
        last_checked_at = datetime('now')`,
      [
        cui,
        contact_type,
        contact_value,
        normalized_value || contact_value,
        label || 'OFFICE',
        source_name || 'MANUAL_ENTRY',
        provenance_url || null,
        verification_method || 'MANUAL_CONFIRMATION',
        verification_status || 'MANUALLY_CONFIRMED',
        confidence_score ?? 0.9,
        contact_person || null,
        contact_person_position || null,
        notes || null,
      ]
    );

    // If website, also update companies.website if empty
    if (contact_type === 'WEBSITE') {
      await executeRun(
        `UPDATE companies SET website = COALESCE(website, ?), updated_at = datetime('now') WHERE cui = ? AND (website IS NULL OR website = '')`,
        [contact_value, cui]
      );
    }

    logAuditEvent({
      user,
      action: 'CONTACT_RECORD_UPSERT',
      details: { cui, contact_type, verification_status, source_name },
      status: 'ALLOWED',
      ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Coordonată de contact înregistrată cu succes.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { cui: string } }
) {
  const ip = getClientIp(request.headers);
  const auth = await validateRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cui = Number(params.cui);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID contact obligatoriu.' }, { status: 400 });
    }

    await executeRun(`DELETE FROM contact_records WHERE id = ? AND cui = ?`, [Number(id), cui]);

    logAuditEvent({
      user: auth.user || 'admin',
      action: 'CONTACT_RECORD_DELETED',
      details: { cui, id },
      status: 'ALLOWED',
      ip,
    });

    return NextResponse.json({ success: true, message: 'Contact șters cu succes.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
