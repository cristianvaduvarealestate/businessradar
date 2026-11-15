import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getCategoriesForCaen } from '@/lib/caen';
import { validateRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { cui: string } }
) {
  // Defense-in-depth auth check
  const auth = validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate' } }
    );
  }

  try {
    const cui = parseInt(params.cui, 10);
    if (isNaN(cui)) {
      return NextResponse.json({ success: false, error: 'CUI invalid' }, { status: 400 });
    }

    const db = getDatabase();

    const company = db.prepare('SELECT * FROM companies WHERE cui = ?').get(cui) as any;
    if (!company) {
      return NextResponse.json({ success: false, error: 'Compania nu a fost găsită' }, { status: 404 });
    }

    const taxRecord = db.prepare('SELECT * FROM tax_records WHERE cui = ?').get(cui);
    const financials = db.prepare('SELECT * FROM financial_records WHERE cui = ? ORDER BY fiscal_year DESC').all(cui);
    const contacts = db.prepare('SELECT * FROM contact_records WHERE cui = ? ORDER BY confidence_score DESC').all(cui);
    const opportunities = db.prepare('SELECT * FROM insurance_opportunities WHERE cui = ? ORDER BY confidence_level DESC').all(cui);
    const pipeline = db.prepare('SELECT * FROM prospect_pipeline WHERE cui = ?').get(cui);
    const secondaryCaens = db.prepare('SELECT * FROM company_secondary_caen WHERE cui = ?').all(cui);

    return NextResponse.json(
      {
        success: true,
        data: {
          company,
          taxRecord,
          financials,
          contacts,
          opportunities,
          pipeline,
          secondaryCaens,
          categories: getCategoriesForCaen(company.primary_caen),
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
