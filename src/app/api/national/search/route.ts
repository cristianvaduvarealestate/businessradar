import { NextRequest, NextResponse } from 'next/server';
import { NationalSearchEngine } from '@/lib/national/search-engine';
import { AdaptiveNationalStorage } from '@/lib/national/storage';
import { validateRequest } from '@/lib/auth';

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

    const q = searchParams.get('q')?.trim() || '';
    const county = searchParams.get('county')?.trim() || '';
    const city = searchParams.get('city')?.trim() || '';
    const legalForm = searchParams.get('legalForm')?.trim() || '';
    const legalStatus = searchParams.get('legalStatus')?.trim() || '';
    const caen = searchParams.get('caen')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get('limit') || '25', 10)));

    const cuiParam = searchParams.get('cui');
    const cui = cuiParam && /^\d+$/.test(cuiParam) ? parseInt(cuiParam, 10) : undefined;

    const storage = AdaptiveNationalStorage.getDriver();
    const manifest = await storage.getManifest();

    if (!manifest) {
      return NextResponse.json({
        success: true,
        connected: false,
        status: 'STORAGE_PENDING_R2_CONFIGURATION',
        message: 'Baza Națională R2 nu este încă conectată în producție.',
        data: {
          items: [],
          pagination: { page, limit, total: 0, totalPages: 1 },
          metrics: { searchLatencyMs: 0, dataSource: 'NOT_CONFIGURED' },
        },
      });
    }

    const results = await NationalSearchEngine.search(
      {
        q,
        cui,
        county,
        city,
        legalForm,
        legalStatus,
        caen,
        page,
        limit,
      },
      storage
    );

    return NextResponse.json({
      success: true,
      connected: true,
      status: 'OPERATIONAL',
      manifest: {
        version: manifest.version,
        publication_date: manifest.publication_date,
        total_records: manifest.total_valid_records,
        is_synthetic: manifest.is_synthetic,
        is_complete: manifest.is_complete,
        storage_driver: storage.getDriverName(),
      },
      data: results,
    });
  } catch (err: any) {
    console.error('National Search API Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'SEARCH_ERROR',
        message: err.message || 'Eroare la interogarea bazei naționale.',
      },
      { status: 500 }
    );
  }
}
