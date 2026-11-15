import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll } from '@/lib/db';
import { validateRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate' } }
    );
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    // 1. Core Company Totals
    const compStats = (await queryOne(`
      SELECT 
        COUNT(*) as total_companies,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_companies,
        COUNT(CASE WHEN website IS NOT NULL AND website != '' THEN 1 END) as with_website,
        COUNT(CASE WHEN prospect_priority IN ('HIGH', 'URGENT') THEN 1 END) as high_priority,
        COUNT(CASE WHEN date(first_observed_at) = date('now') THEN 1 END) as new_today,
        COUNT(CASE WHEN datetime(first_observed_at, '+90 days') >= datetime('now') THEN 1 END) as new_last_90_days
      FROM companies
    `)) || {};

    // 2. Contact Verification Coverage
    const contactStats = (await queryOne(`
      SELECT 
        COUNT(DISTINCT cui) as companies_with_any_contact,
        COUNT(DISTINCT CASE WHEN contact_type LIKE '%PHONE%' THEN cui END) as with_phones,
        COUNT(DISTINCT CASE WHEN contact_type = 'MOBILE' OR (contact_type LIKE '%PHONE%' AND (contact_value LIKE '+407%' OR contact_value LIKE '07%')) THEN cui END) as with_mobile,
        COUNT(DISTINCT CASE WHEN contact_type = 'LANDLINE' OR (contact_type LIKE '%PHONE%' AND (contact_value LIKE '+402%' OR contact_value LIKE '02%' OR contact_value LIKE '+403%' OR contact_value LIKE '03%')) THEN cui END) as with_landline,
        COUNT(DISTINCT CASE WHEN contact_type LIKE '%EMAIL%' THEN cui END) as with_emails,
        COUNT(DISTINCT CASE WHEN verification_status = 'VERIFIED_OFFICIAL' OR verification_status = 'MANUALLY_CONFIRMED' THEN cui END) as verified_contacts
      FROM contact_records
    `)) || {};

    // 3. Sales CRM Pipeline Metrics
    const crmStats = (await queryOne(`
      SELECT 
        COUNT(CASE WHEN status IN ('NEW', 'NEW_DISCOVERED') THEN 1 END) as not_yet_contacted,
        COUNT(CASE WHEN status IN ('CONTACTED', 'IN_DISCUSSION', 'INTERESTED', 'OFFER_REQUESTED', 'OFFER_SENT', 'NEGOTIATION') THEN 1 END) as in_contact,
        COUNT(CASE WHEN status IN ('IN_DISCUSSION', 'INTERESTED', 'NEEDS_ANALYSIS') THEN 1 END) as in_discussion,
        COUNT(CASE WHEN status IN ('OFFER_REQUESTED', 'OFFER_SENT') THEN 1 END) as offers_sent,
        COUNT(CASE WHEN status = 'CLIENT_WON' THEN 1 END) as clients_won,
        COUNT(CASE WHEN status IN ('LOST', 'NOT_INTERESTED') THEN 1 END) as lost_opportunities,
        COUNT(CASE WHEN status = 'DO_NOT_CONTACT' THEN 1 END) as do_not_contact
      FROM prospect_pipeline
    `)) || {};

    // 4. Follow-Up Metrics
    const followUpStats = (await queryOne(`
      SELECT 
        COUNT(CASE WHEN due_date = ? AND status = 'PENDING' THEN 1 END) as followups_today,
        COUNT(CASE WHEN due_date < ? AND status = 'PENDING' THEN 1 END) as followups_overdue,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as followups_completed
      FROM crm_follow_ups
    `, [today, today])) || {};

    // Conversion rate calculation
    const totalEngaged = (crmStats.in_contact || 0) + (crmStats.clients_won || 0) + (crmStats.lost_opportunities || 0);
    const conversionRate = totalEngaged > 0 ? Number(((crmStats.clients_won || 0) / totalEngaged * 100).toFixed(1)) : 0;

    // Opportunities summary
    const oppSummary = (await queryOne(`
      SELECT 
        COUNT(*) as total_opportunities,
        COUNT(DISTINCT cui) as companies_with_opportunities
      FROM insurance_opportunities
    `)) || {};

    // Opportunities by Category
    const oppsByCategory = await queryAll(`
      SELECT product_category, COUNT(*) as count 
      FROM insurance_opportunities 
      GROUP BY product_category 
      ORDER BY count DESC
    `);

    // Top Counties
    const topCounties = await queryAll(`
      SELECT county, COUNT(*) as count 
      FROM companies 
      WHERE county IS NOT NULL AND county != '' 
      GROUP BY county 
      ORDER BY count DESC 
      LIMIT 6
    `);

    // Pipeline status distribution
    const pipelineStages = await queryAll(`
      SELECT status, COUNT(*) as count 
      FROM prospect_pipeline 
      GROUP BY status
    `);

    // Recent CRM activity count
    const recentActivityCount = (await queryOne(`
      SELECT COUNT(*) as count FROM crm_interactions WHERE datetime(created_at, '+7 days') >= datetime('now')
    `))?.count || 0;

    return NextResponse.json(
      {
        success: true,
        data: {
          companies: compStats,
          contacts: contactStats,
          crm: {
            ...crmStats,
            conversion_rate: conversionRate,
            recent_activity_count: recentActivityCount,
          },
          followups: followUpStats,
          opportunities: {
            ...oppSummary,
            by_category: oppsByCategory,
          },
          topCounties,
          pipelineStages,
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
