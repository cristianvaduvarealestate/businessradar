import { NextRequest, NextResponse } from 'next/server';
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
    const storage = AdaptiveNationalStorage.getDriver();
    const manifest = await storage.getManifest();

    if (!manifest) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          status: 'STORAGE_PENDING_R2_CONFIGURATION',
          message: 'Baza Națională R2 nu este încă configurată sau încărcată în producție.',
          totalValidRecords: 0,
          publicationDate: null,
          lastSuccessfulImport: null,
          datasetVersion: null,
          storageDriver: storage.getDriverName(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        status: 'OPERATIONAL',
        totalValidRecords: manifest.total_valid_records,
        totalInvalidRecords: manifest.total_invalid_records,
        publicationDate: manifest.publication_date,
        datasetVersion: manifest.version,
        sourceSha256: manifest.source_sha256,
        lastSuccessfulImport: manifest.generated_at,
        isComplete: manifest.is_complete,
        isSynthetic: manifest.is_synthetic,
        storageDriver: storage.getDriverName(),
        shards: manifest.shards,
      },
    });
  } catch (err: any) {
    console.error('National Stats API Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'STATS_ERROR',
        message: err.message || 'Eroare la calcularea statisticilor naționale.',
      },
      { status: 500 }
    );
  }
}
