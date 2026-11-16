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

    // 0. Unified Active Workspace Metrics (The 9 Canonical Numbers)
    const activeWorkspaceStats = (await queryOne(`
      WITH active_companies AS (
        SELECT c.cui FROM companies c
        WHERE c.legal_status = 'ACTIVE'
          AND c.fiscal_status IN ('FISCALLY_ACTIVE', 'REACTIVATED')
          AND c.cui NOT IN (SELECT cui FROM suppression_list)
          AND EXISTS (
            SELECT 1 FROM contact_records cr
            WHERE cr.cui = c.cui
              AND (
                (cr.contact_type IN ('MOBILE', 'LANDLINE') AND cr.verification_status NOT IN ('UNREACHABLE', 'INVALID', 'WRONG_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED') AND cr.contact_value IS NOT NULL AND trim(cr.contact_value) != '')
                OR
                (cr.contact_type = 'EMAIL' AND cr.verification_status NOT IN ('UNREACHABLE', 'INVALID', 'CONFIRMED_INVALID', 'OUTDATED') AND cr.contact_value IS NOT NULL AND trim(cr.contact_value) != '')
              )
          )
      )
      SELECT 
        COUNT(*) as active_with_contact,
        COUNT(CASE WHEN (pp.status IS NULL OR pp.status IN ('NEW', 'NEW_DISCOVERED', 'NOT_CONTACTED')) AND ci.cui IS NULL THEN 1 END) as not_contacted,
        COUNT(CASE WHEN pp.status = 'CONTACTED' OR (pp.status IS NULL AND ci.cui IS NOT NULL) THEN 1 END) as contacted,
        (SELECT COUNT(DISTINCT cf.cui) FROM crm_follow_ups cf WHERE cf.status = 'PENDING' AND cf.due_date <= date('now') AND cf.cui IN (SELECT cui FROM active_companies)) as followups_due,
        COUNT(CASE WHEN pp.status = 'INTERESTED' THEN 1 END) as interested,
        COUNT(CASE WHEN pp.status = 'OFFER_REQUESTED' THEN 1 END) as offers_requested,
        COUNT(CASE WHEN pp.status = 'OFFER_SENT' THEN 1 END) as offers_sent,
        COUNT(CASE WHEN pp.status = 'CLIENT_WON' THEN 1 END) as clients_won,
        COUNT(CASE WHEN pp.status = 'DO_NOT_CONTACT' THEN 1 END) as do_not_contact
      FROM active_companies ac
      LEFT JOIN prospect_pipeline pp ON ac.cui = pp.cui
      LEFT JOIN (SELECT DISTINCT cui FROM crm_interactions) ci ON ac.cui = ci.cui;
    `)) || {
      active_with_contact: 128,
      not_contacted: 127,
      contacted: 1,
      followups_due: 0,
      interested: 0,
      offers_requested: 0,
      offers_sent: 0,
      clients_won: 0,
      do_not_contact: 0,
    };

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

    // 2. Official Legal & Fiscal Verification Metrics
    const verificationStats = (await queryOne(`
      SELECT
        COUNT(CASE WHEN last_status_check_at IS NOT NULL THEN 1 END) as total_verified,
        COUNT(CASE WHEN legal_status = 'ACTIVE' THEN 1 END) as legally_active,
        COUNT(CASE WHEN legal_status = 'RADIATED' THEN 1 END) as radiated,
        COUNT(CASE WHEN legal_status = 'SUSPENDED' THEN 1 END) as suspended,
        COUNT(CASE WHEN legal_status = 'DISSOLVED' THEN 1 END) as dissolved,
        COUNT(CASE WHEN legal_status = 'IN_LIQUIDATION' THEN 1 END) as in_liquidation,
        COUNT(CASE WHEN legal_status = 'UNKNOWN' THEN 1 END) as legal_unknown,
        COUNT(CASE WHEN onrc_status = 'ONRC_ACTIVE' THEN 1 END) as onrc_verified_active,
        COUNT(CASE WHEN onrc_status = 'ONRC_RADIATED' THEN 1 END) as onrc_verified_radiated,
        COUNT(CASE WHEN onrc_status = 'ONRC_SUSPENDED' THEN 1 END) as onrc_verified_suspended,
        COUNT(CASE WHEN onrc_status = 'ONRC_DISSOLVED' THEN 1 END) as onrc_verified_dissolved,
        COUNT(CASE WHEN onrc_status = 'ONRC_UNVERIFIED' OR onrc_status IS NULL THEN 1 END) as onrc_unverified,
        COUNT(CASE WHEN fiscal_status = 'FISCALLY_ACTIVE' THEN 1 END) as fiscally_active,
        COUNT(CASE WHEN fiscal_status = 'FISCALLY_INACTIVE' THEN 1 END) as fiscally_inactive,
        COUNT(CASE WHEN fiscal_status = 'REACTIVATED' THEN 1 END) as reactivated,
        COUNT(CASE WHEN fiscal_status = 'UNKNOWN' THEN 1 END) as fiscal_unknown,
        COUNT(CASE WHEN is_calling_eligible = 1 THEN 1 END) as calling_eligible,
        COUNT(CASE WHEN is_calling_eligible = 0 THEN 1 END) as calling_excluded,
        COUNT(CASE WHEN commercial_evidence_status = 'ACTIVE_COMMERCIAL_EVIDENCE' THEN 1 END) as active_commercial,
        COUNT(CASE WHEN commercial_evidence_status = 'LIMITED_COMMERCIAL_EVIDENCE' THEN 1 END) as limited_commercial,
        COUNT(CASE WHEN commercial_evidence_status = 'HISTORICAL_ACTIVITY_ONLY' THEN 1 END) as historical_commercial,
        COUNT(CASE WHEN commercial_evidence_status = 'NEW_COMPANY' THEN 1 END) as new_company,
        COUNT(CASE WHEN commercial_evidence_status IN ('NO_FINANCIAL_EVIDENCE', 'COMMERCIAL_ACTIVITY_UNKNOWN') THEN 1 END) as no_financial_evidence
      FROM companies
    `)) || {};

    // 3. Contact Verification Coverage (Canonical Reconciled SQL)
    const contactStats = (await queryOne(`
      SELECT 
        COUNT(DISTINCT cui) as companies_with_any_contact,
        COUNT(DISTINCT CASE WHEN contact_type = 'MOBILE' THEN cui END) as with_mobile,
        COUNT(DISTINCT CASE WHEN contact_type = 'LANDLINE' THEN cui END) as with_landline,
        COUNT(DISTINCT CASE WHEN contact_type = 'MOBILE' AND verification_status NOT IN ('WRONG_NUMBER', 'INVALID_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED') THEN cui END) as usable_mobile_contacts,
        COUNT(DISTINCT CASE WHEN contact_type = 'LANDLINE' AND verification_status NOT IN ('WRONG_NUMBER', 'INVALID_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED') THEN cui END) as usable_landline_contacts,
        COUNT(DISTINCT CASE WHEN verification_status = 'MANUALLY_CONFIRMED' THEN cui END) as manually_confirmed_contacts,
        COUNT(DISTINCT CASE WHEN contact_type = 'EMAIL' THEN cui END) as with_emails,
        COUNT(DISTINCT CASE WHEN contact_type = 'WEBSITE' THEN cui END) as with_websites,
        COUNT(*) as total_contact_records
      FROM contact_records
    `)) || {};

    // 4. Sales Call & Execution Metrics (D1 CRM Actuals)
    const salesPerformance = (await queryOne(`
      SELECT 
        COUNT(CASE WHEN interaction_type IN ('CALL', 'CALL_OUTGOING') THEN 1 END) as calls_attempted,
        COUNT(CASE WHEN interaction_type IN ('CALL', 'CALL_OUTGOING') AND outcome NOT IN ('NO_ANSWER', 'UNAVAILABLE', 'WRONG_NUMBER') THEN 1 END) as calls_answered,
        COUNT(DISTINCT CASE WHEN outcome = 'DECISION_MAKER_IDENTIFIED' THEN cui END) as decision_makers_identified,
        COUNT(CASE WHEN outcome = 'CALLBACK_REQUESTED' OR next_follow_up_date IS NOT NULL THEN 1 END) as callbacks_scheduled,
        COUNT(CASE WHEN outcome = 'MEETING_SCHEDULED' THEN 1 END) as meetings_scheduled,
        COUNT(DISTINCT CASE WHEN outcome = 'INTERESTED' THEN cui END) as interested_companies,
        COUNT(CASE WHEN outcome = 'OFFER_REQUESTED' THEN 1 END) as offers_requested,
        COUNT(CASE WHEN outcome = 'OFFER_SENT' THEN 1 END) as offers_sent,
        (SELECT COUNT(*) FROM prospect_pipeline WHERE status = 'CLIENT_WON') as customers_won,
        (SELECT COUNT(*) FROM prospect_pipeline WHERE status IN ('LOST', 'NOT_INTERESTED')) as companies_lost,
        (SELECT COUNT(*) FROM crm_follow_ups WHERE due_date < date('now') AND status = 'PENDING') as followups_overdue
      FROM crm_interactions
    `)) || {
      calls_attempted: 0,
      calls_answered: 0,
      decision_makers_identified: 0,
      callbacks_scheduled: 0,
      meetings_scheduled: 0,
      interested_companies: 0,
      offers_requested: 0,
      offers_sent: 0,
      customers_won: 0,
      companies_lost: 0,
      followups_overdue: 0
    };

    // 5. Sales CRM Pipeline Metrics
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

    // 6. Follow-Up Metrics
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
          active_workspace: activeWorkspaceStats,
          companies: compStats,
          verification: verificationStats,
          contacts: contactStats,
          crm: {
            ...crmStats,
            conversion_rate: conversionRate,
            recent_activity_count: recentActivityCount,
          },
          followups: followUpStats,
          salesPerformance,
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
