import { NextRequest, NextResponse } from 'next/server';
import { NationalCompanyPromoter } from '@/lib/national/promoter';
import { validateRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const cui = typeof body.cui === 'number' ? body.cui : parseInt(String(body.cui), 10);
    const autoVerifyAnaf = Boolean(body.autoVerifyAnaf);

    if (!cui || isNaN(cui) || cui <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_CUI',
          message: 'Parametrul CUI este obligatoriu și trebuie să fie un număr valid pozitiv.',
        },
        { status: 400 }
      );
    }

    const result = await NationalCompanyPromoter.promoteToOperational(cui, { autoVerifyAnaf });

    return NextResponse.json({
      success: result.success,
      data: result,
    });
  } catch (err: any) {
    console.error('Promotion API Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'PROMOTION_ERROR',
        message: err.message || 'Eroare la promovarea companiei.',
      },
      { status: 500 }
    );
  }
}
