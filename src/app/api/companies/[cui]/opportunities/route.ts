import { NextRequest, NextResponse } from 'next/server';
import { executeRun } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function PATCH(
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
    const { id, status, review_notes } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'ID și status obligatorii.' }, { status: 400 });
    }

    const validStatuses = ['RECOMMENDED', 'ACCEPTED', 'REJECTED', 'ALREADY_INSURED', 'POLICY_ISSUED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: 'Status invalid.' }, { status: 400 });
    }

    await executeRun(
      `UPDATE insurance_opportunities 
       SET status = ?, manually_reviewed = 1, review_notes = COALESCE(?, review_notes)
       WHERE id = ? AND cui = ?`,
      [status, review_notes || null, Number(id), cui]
    );

    logAuditEvent({
      user: auth.user || 'admin',
      action: 'OPPORTUNITY_STATUS_UPDATE',
      details: { cui, id, status },
      status: 'ALLOWED',
      ip,
    });

    return NextResponse.json({ success: true, message: 'Status oportunitate actualizat.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
