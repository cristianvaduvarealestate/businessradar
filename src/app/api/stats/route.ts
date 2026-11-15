import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { validateRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Defense-in-depth auth check
  const auth = validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate' } }
    );
  }

  try {
    const db = getDatabase();

    const totalCompanies = (db.prepare('SELECT COUNT(*) as count FROM companies').get() as any).count;
    const activeCompanies = (db.prepare("SELECT COUNT(*) as count FROM companies WHERE status = 'ACTIVE'").get() as any).count;
    
    // Recent discovery windows
    const newToday = (db.prepare("SELECT COUNT(*) as count FROM companies WHERE date(first_observed_at) = date('now')").get() as any).count;
    const newThisWeek = (db.prepare("SELECT COUNT(*) as count FROM companies WHERE datetime(first_observed_at, '+7 days') >= datetime('now')").get() as any).count;
    const newLast90Days = (db.prepare("SELECT COUNT(*) as count FROM companies WHERE datetime(first_observed_at, '+90 days') >= datetime('now')").get() as any).count;
    
    // Intelligence metrics
    const withWebsite = (db.prepare("SELECT COUNT(*) as count FROM companies WHERE website IS NOT NULL AND website != ''").get() as any).count;
    const withContacts = (db.prepare("SELECT COUNT(DISTINCT cui) as count FROM contact_records").get() as any).count;
    const withFinancials = (db.prepare("SELECT COUNT(DISTINCT cui) as count FROM financial_records").get() as any).count;
    const withOpportunities = (db.prepare("SELECT COUNT(DISTINCT cui) as count FROM insurance_opportunities").get() as any).count;
    const highPriority = (db.prepare("SELECT COUNT(*) as count FROM companies WHERE prospect_priority IN ('HIGH', 'URGENT')").get() as any).count;

    // Top counties
    const topCounties = db.prepare(`
      SELECT county, COUNT(*) as count 
      FROM companies 
      WHERE county IS NOT NULL AND county != '' 
      GROUP BY county 
      ORDER BY count DESC 
      LIMIT 6
    `).all() as any[];

    // Top CAEN industries
    const topCaens = db.prepare(`
      SELECT primary_caen, caen_description, COUNT(*) as count
      FROM companies
      WHERE primary_caen IS NOT NULL
      GROUP BY primary_caen
      ORDER BY count DESC
      LIMIT 6
    `).all() as any[];

    // Recent Ingestion Jobs
    const recentJobs = db.prepare(`
      SELECT id, job_id, provider, scheduled_at, started_at, ended_at, status, 
             records_processed, new_records, updated_records, duplicate_records, 
             error_count, checkpoint, duration_ms, error_log
      FROM ingestion_jobs
      ORDER BY id DESC
      LIMIT 5
    `).all() as any[];

    const lastSuccessfulJob = db.prepare(`
      SELECT ended_at 
      FROM ingestion_jobs 
      WHERE status = 'SUCCESS' 
      ORDER BY id DESC 
      LIMIT 1
    `).get() as any;

    return NextResponse.json(
      {
        success: true,
        data: {
          totalCompanies,
          activeCompanies,
          newToday,
          newThisWeek,
          newLast90Days,
          withWebsite,
          withContacts,
          withFinancials,
          withOpportunities,
          highPriority,
          topCounties,
          topCaens,
          recentJobs,
          lastSuccessfulSync: lastSuccessfulJob?.ended_at || null,
          nextScheduledSync: 'Astăzi, 20:00 EET (Automated Cron)',
        },
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
