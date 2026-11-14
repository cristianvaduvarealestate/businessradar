import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getCategoriesForCaen } from '@/lib/caen';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { cui: string } }) {
  try {
    const cui = parseInt(params.cui, 10);
    if (!cui || isNaN(cui)) {
      return NextResponse.json({ success: false, error: 'CUI invalid' }, { status: 400 });
    }

    const db = getDatabase();

    // 1. Master Company
    const company = db.prepare('SELECT * FROM companies WHERE cui = ?').get(cui);
    if (!company) {
      return NextResponse.json({ success: false, error: 'Compania nu a fost găsită' }, { status: 404 });
    }

    // 2. Tax Records (ANAF)
    const taxRecord = db.prepare('SELECT * FROM tax_records WHERE cui = ?').get(cui);

    // 3. Financial Statements
    const financials = db.prepare('SELECT * FROM financial_records WHERE cui = ? ORDER BY fiscal_year DESC').all(cui);

    // 4. Contact Records
    const contacts = db.prepare('SELECT * FROM contact_records WHERE cui = ? ORDER BY confidence_score DESC').all(cui);

    // 5. Insurance Opportunities
    const opportunities = db.prepare('SELECT * FROM insurance_opportunities WHERE cui = ? ORDER BY confidence_level DESC').all(cui);

    // 6. Prospect Pipeline
    const pipeline = db.prepare('SELECT * FROM prospect_pipeline WHERE cui = ?').get(cui);

    // 7. Secondary CAENs
    const secondaryCaens = db.prepare('SELECT * FROM company_secondary_caen WHERE cui = ?').all(cui);

    // 8. Categories
    const categories = getCategoriesForCaen((company as any).primary_caen || '');

    return NextResponse.json({
      success: true,
      data: {
        company,
        taxRecord: taxRecord || null,
        financials,
        contacts,
        opportunities,
        pipeline: pipeline || null,
        secondaryCaens,
        categories,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
