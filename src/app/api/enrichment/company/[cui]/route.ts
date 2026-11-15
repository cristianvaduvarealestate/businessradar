import { NextRequest, NextResponse } from 'next/server';
import { CompanyEnrichmentService } from '@/lib/enrichment/service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { cui: string } }
) {
  try {
    const cui = parseInt(params.cui, 10);
    if (isNaN(cui) || cui <= 0) {
      return NextResponse.json({ success: false, error: 'CUI invalid' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const result = await CompanyEnrichmentService.enrichCompany(cui, {
      forceRefresh: Boolean(body.forceRefresh),
    });

    return NextResponse.json({
      success: result.success,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Eroare la îmbogățirea profilului companiei' },
      { status: 500 }
    );
  }
}
