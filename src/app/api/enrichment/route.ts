import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne } from '@/lib/db';
import { CompanyEnrichmentService } from '@/lib/enrichment/service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Total companies
    const totalRow = await queryOne<{ total: number }>('SELECT count(*) as total FROM companies');
    const totalCompanies = totalRow?.total || 0;

    // 2. Metrics across contact_records
    const metricsRow = await queryOne<{
      mobile_count: number;
      landline_count: number;
      email_count: number;
      website_count: number;
      distinct_companies_with_contacts: number;
    }>(`
      SELECT 
        COUNT(DISTINCT CASE WHEN contact_type = 'MOBILE' THEN cui END) as mobile_count,
        COUNT(DISTINCT CASE WHEN contact_type = 'LANDLINE' THEN cui END) as landline_count,
        COUNT(DISTINCT CASE WHEN contact_type = 'EMAIL' THEN cui END) as email_count,
        COUNT(DISTINCT CASE WHEN contact_type = 'WEBSITE' THEN cui END) as website_count,
        COUNT(DISTINCT cui) as distinct_companies_with_contacts
      FROM contact_records
    `);

    const withAnyContact = metricsRow?.distinct_companies_with_contacts || 0;
    const withNoContact = Math.max(0, totalCompanies - withAnyContact);

    // 3. Contacts by source
    const bySource = await queryAll<{ source_name: string; count: number }>(`
      SELECT COALESCE(source_name, 'HISTORICAL_REGISTRY') as source_name, count(*) as count
      FROM contact_records
      GROUP BY source_name
      ORDER BY count DESC
    `);

    // 4. Contacts by verification status
    const byStatus = await queryAll<{ verification_status: string; count: number }>(`
      SELECT COALESCE(verification_status, 'UNVERIFIED') as verification_status, count(*) as count
      FROM contact_records
      GROUP BY verification_status
      ORDER BY count DESC
    `);

    // 5. Total contact records count
    const totalContactsRow = await queryOne<{ total: number }>('SELECT count(*) as total FROM contact_records');

    // 6. Durable job state from D1
    const durableJob = await queryOne<any>(`
      SELECT * FROM enrichment_job_state WHERE id = 'BULK_ENRICHMENT_JOB'
    `).catch(() => null);

    const checkStats = await queryOne<{ checked_count: number; no_contact_count: number }>(`
      SELECT 
        COUNT(CASE WHEN contact_checked_at IS NOT NULL THEN 1 END) as checked_count,
        COUNT(CASE WHEN contact_check_status = 'NO_PUBLIC_CONTACT' THEN 1 END) as no_contact_count
      FROM companies
    `).catch(() => null);

    // 7. Current background job status (combining durable state + in-memory)
    const currentJob = CompanyEnrichmentService.getProgress();

    const checkedTotal = checkStats?.checked_count ?? durableJob?.companies_checked ?? 0;
    const noContactTotal = checkStats?.no_contact_count ?? durableJob?.companies_without_contact ?? Math.max(0, totalCompanies - withAnyContact);

    return NextResponse.json({
      success: true,
      data: {
        totalCompanies,
        totalContactRecords: totalContactsRow?.total || 0,
        companiesWithAnyContact: withAnyContact,
        companiesWithNoContact: noContactTotal,
        companiesChecked: checkedTotal,
        companiesRemaining: Math.max(0, totalCompanies - checkedTotal),
        companiesWithMobile: metricsRow?.mobile_count || 0,
        companiesWithLandline: metricsRow?.landline_count || 0,
        companiesWithEmail: metricsRow?.email_count || 0,
        companiesWithWebsite: metricsRow?.website_count || 0,
        contactsBySource: bySource,
        contactsByStatus: byStatus,
        currentJob: {
          ...currentJob,
          status: durableJob?.status || currentJob.status,
          total: totalCompanies,
          processed: checkedTotal,
          lastBatchAt: durableJob?.last_batch_at || null,
          failedRequests: durableJob?.failed_requests || 0,
          rateLimitedRequests: durableJob?.rate_limited_requests || 0,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Eroare la preluarea statisticilor de îmbogățire' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, cuis, limit, batchSize } = body;

    if (action === 'START_BATCH') {
      const progress = await CompanyEnrichmentService.startBatch(cuis, {
        limit: limit ? parseInt(limit, 10) : 50,
        batchSize: batchSize ? parseInt(batchSize, 10) : 5,
      });

      return NextResponse.json({
        success: true,
        message: 'Operațiunea de îmbogățire a fost inițiată.',
        data: progress,
      });
    }

    if (action === 'STOP') {
      CompanyEnrichmentService.stopJob();
      return NextResponse.json({
        success: true,
        message: 'Operațiunea de îmbogățire a fost oprită.',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Acțiune invalidă. Utilizați START_BATCH sau STOP.' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Eroare procesare acțiune îmbogățire' },
      { status: 500 }
    );
  }
}
