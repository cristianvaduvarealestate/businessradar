import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, executeRun } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { COMMERCIAL_STATUSES } from '@/lib/prospecting-types';

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

    const prospect = await queryOne<any>(
      `SELECT * FROM prospect_records WHERE id = ?`,
      [id]
    );

    if (!prospect) {
      return NextResponse.json({ success: false, error: 'Dosarul nu a fost găsit.' }, { status: 404 });
    }

    let phones: string[] = [];
    let emails: string[] = [];
    let confirmedProducts: string[] = [];

    try {
      phones = prospect.phones ? JSON.parse(prospect.phones) : [];
    } catch {
      phones = prospect.phones ? [prospect.phones] : [];
    }

    try {
      emails = prospect.emails ? JSON.parse(prospect.emails) : [];
    } catch {
      emails = prospect.emails ? [prospect.emails] : [];
    }

    try {
      confirmedProducts = prospect.confirmed_interested_products ? JSON.parse(prospect.confirmed_interested_products) : [];
    } catch {
      confirmedProducts = [];
    }

    const discussions = await queryAll(
      `SELECT * FROM prospect_discussions WHERE prospect_id = ? ORDER BY interaction_date DESC, created_at DESC`,
      [id]
    );

    return NextResponse.json({
      success: true,
      data: {
        ...prospect,
        phones,
        emails,
        confirmed_interested_products: confirmedProducts,
        discussions,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
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

    const body = await request.json();
    const allowedFields = [
      'commercial_status',
      'decision_maker',
      'operational_notes',
      'next_callback_date',
      'next_action',
      'confirmed_interested_products',
      'company_name',
      'phones',
      'emails',
      'website',
      'address',
      'city',
      'county',
      'domain',
      'cui',
      'is_incomplete',
    ];

    const updates: string[] = [];
    const updateParams: any[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        if (key === 'commercial_status') {
          if (!COMMERCIAL_STATUSES[value as any]) {
            return NextResponse.json({ success: false, error: `Statut invalid: ${value}` }, { status: 400 });
          }
          updates.push(`${key} = ?`);
          updateParams.push(value);
        } else if (key === 'confirmed_interested_products' || key === 'phones' || key === 'emails') {
          updates.push(`${key} = ?`);
          updateParams.push(Array.isArray(value) ? JSON.stringify(value) : value);
        } else {
          updates.push(`${key} = ?`);
          updateParams.push(value);
        }
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'Nu au fost furnizate câmpuri pentru actualizare.' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    updateParams.push(id);

    const result = await executeRun(
      `UPDATE prospect_records SET ${updates.join(', ')} WHERE id = ?`,
      updateParams
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Eroare la actualizarea dosarului.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Dosar actualizat cu succes.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
