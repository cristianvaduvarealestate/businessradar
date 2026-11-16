import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/monitoring/service';
import { validateRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Allow authenticated admins OR internal cron trigger header
  const auth = await validateRequest(request);
  const cronHeader = request.headers.get('x-cron-trigger');

  if (!auth.authenticated && cronHeader !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară pentru lansarea sincronizării.' },
      { status: 401 }
    );
  }

  try {
    let batchLimit: number | undefined;
    let datasetUrl: string | undefined;

    try {
      const body = await request.json();
      if (body.batchLimit && Number.isInteger(body.batchLimit)) {
        batchLimit = body.batchLimit;
      }
      if (body.datasetUrl && typeof body.datasetUrl === 'string') {
        datasetUrl = body.datasetUrl;
      }
    } catch {
      // Body is optional
    }

    const executionType = cronHeader === 'true' ? 'SCHEDULED' : 'MANUAL_ADMIN';
    const triggeredBy = auth.user || (cronHeader === 'true' ? 'Cloudflare Cron' : 'admin');

    const result = await MonitoringService.runSync({
      batchLimit,
      datasetUrl,
      executionType,
      triggeredBy,
    });

    if (!result.success && result.error === 'CONCURRENT_SYNC_LOCKED') {
      return NextResponse.json(
        {
          success: false,
          error: 'CONCURRENT_SYNC_LOCKED',
          message: result.message,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: result.success,
      syncId: result.syncId,
      discoveredCount: result.discoveredCount,
      updatedCount: result.updatedCount,
      rejectedCount: result.rejectedCount,
      cursorLine: result.cursorLine,
      durationMs: result.durationMs,
      message: result.message,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Eroare la execuția sincronizării',
      },
      { status: 500 }
    );
  }
}
