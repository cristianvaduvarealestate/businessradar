import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/monitoring/service';
import { queryAll, queryOne } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { onrcConnector } from '@/lib/providers/onrc';
import { anafConnector } from '@/lib/providers/anaf';

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
    const config = await MonitoringService.getConfig();

    // If schema is not initialized (e.g. migration 0012 not applied to D1), return transparent status
    if (config._schema_status === 'MIGRATION_REQUIRED') {
      return NextResponse.json({
        success: true,
        initialized: false,
        status: 'MIGRATION_REQUIRED',
        message: 'Tabelele de monitorizare continuă nu sunt inițializate în baza de date (Migrația 0012 necesară).',
        underlyingError: config._schema_error || 'D1_ERROR: no such table: monitoring_config: SQLITE_ERROR',
        config,
        stats: {
          today: 0,
          last_7_days: 0,
          last_30_days: 0,
          total_new: 0,
          continuous_count: 0,
          backfill_count: 0,
          verified: 0,
          awaiting: 0,
          with_contacts: 0,
        },
        recentSyncs: [],
      });
    }

    const recentSyncs = await MonitoringService.getSyncLogs(10);

    // Compute stats for FIRME NOI (both CONTINUOUS and INITIAL BACKFILL cohorts)
    const newStats = await queryOne<{
      today: number;
      last_7_days: number;
      last_30_days: number;
      total_new: number;
      continuous_count: number;
      backfill_count: number;
      verified: number;
      awaiting: number;
      with_contacts: number;
    }>(`
      SELECT 
        COUNT(CASE WHEN date(first_detected_at) >= date('now') THEN 1 END) as today,
        COUNT(CASE WHEN date(first_detected_at) >= date('now', '-7 days') THEN 1 END) as last_7_days,
        COUNT(CASE WHEN date(first_detected_at) >= date('now', '-30 days') THEN 1 END) as last_30_days,
        COUNT(*) as total_new,
        COUNT(CASE WHEN classification = 'NEW' THEN 1 END) as continuous_count,
        COUNT(CASE WHEN classification = 'BACKFILL' THEN 1 END) as backfill_count,
        COUNT(CASE WHEN verification_state IN ('FISCAL_STATUS_VERIFIED', 'CONTACT_AVAILABLE', 'QUALIFIED') THEN 1 END) as verified,
        COUNT(CASE WHEN verification_state = 'DISCOVERED' THEN 1 END) as awaiting,
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM contact_records cr 
          WHERE cr.cui = companies.cui 
            AND cr.contact_value IS NOT NULL 
            AND trim(cr.contact_value) != ''
            AND cr.verification_status NOT IN ('UNREACHABLE', 'INVALID', 'WRONG_NUMBER', 'CONFIRMED_INVALID')
        ) THEN 1 END) as with_contacts
      FROM companies
      WHERE classification IN ('NEW', 'BACKFILL')
    `);

    // Basic source health check (cached/fast or async)
    return NextResponse.json({
      success: true,
      config,
      stats: newStats || {
        today: 0,
        last_7_days: 0,
        last_30_days: 0,
        total_new: 0,
        continuous_count: 0,
        backfill_count: 0,
        verified: 0,
        awaiting: 0,
        with_contacts: 0,
      },
      recentSyncs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Eroare la obținerea datelor de monitorizare' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const allowedKeys = [
      'auto_sync_enabled',
      'cron_schedule',
      'batch_limit',
      'monitoring_activation_date',
      'active_source',
      'monitoring_status',
    ];

    for (const [key, value] of Object.entries(body)) {
      if (allowedKeys.includes(key) && typeof value === 'string') {
        await MonitoringService.updateConfigKey(key, value);
      }
    }

    const updatedConfig = await MonitoringService.getConfig();
    return NextResponse.json({ success: true, config: updatedConfig });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Eroare la actualizarea configurării' },
      { status: 500 }
    );
  }
}
