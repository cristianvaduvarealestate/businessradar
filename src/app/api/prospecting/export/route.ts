import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { validateRequest } from '@/lib/auth';
import { COMMERCIAL_STATUSES, PortfolioType } from '@/lib/prospecting-types';

export const dynamic = 'force-dynamic';

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(request: NextRequest) {
  const auth = await validateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Autentificare necesară pentru exportul de date.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate' } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    let portfolio = (searchParams.get('portfolio') || 'GENERAL').toUpperCase();
    if (portfolio === 'TOURISM' || portfolio === 'TOURISM_UNITS') {
      portfolio = 'TOURISM_UNITS';
    } else if (portfolio === 'NICHE' || portfolio === 'NICHE_HORECA_AUTO_CONSTRUCT') {
      portfolio = 'NICHE_HORECA_AUTO_CONSTRUCT';
    } else {
      portfolio = 'GENERAL';
    }

    const records = await queryAll<any>(
      `
      SELECT 
        pr.*,
        (SELECT count(*) FROM prospect_discussions pd WHERE pd.prospect_id = pr.id) as discussions_count,
        (SELECT max(pd.interaction_date) FROM prospect_discussions pd WHERE pd.prospect_id = pr.id) as last_discussion_date
      FROM prospect_records pr
      WHERE pr.portfolio_type = ?
      ORDER BY pr.source_row_index ASC, pr.id ASC
      `,
      [portfolio]
    );

    const isTourism = portfolio === 'TOURISM_UNITS';

    const headers = isTourism ? [
      'Nr Crt',
      'Tip unitate',
      'Nume unitate',
      'Tip categorie',
      'Număr spații',
      'Număr locuri',
      'Alte detalii adresă',
      'Tip localitate',
      'Localitate componentă',
      'Localitate',
      'Județ',
      'Email',
      'Web',
      'Tip Operator Economic',
      'Operator Economic',
      'Număr Înregistrare',
      'Cod Unic Înregistrare (CUI)',
      'Statut Comercial',
      'Revenire Programată',
      'Număr Discuții',
      'Ultima Discuție',
      'Notițe Operative',
    ] : [
      'Nr',
      'Denumire Companie',
      'Statut Comercial',
      'CUI',
      'Nr Reg Com',
      'Domeniu',
      'Județ',
      'Localitate',
      'Adresă',
      'Telefoane',
      'Emailuri',
      'Website',
      'Persoane Contact / Decident',
      'Sugestii Asigurare Inițiale',
      'Produse Asigurare de Interes',
      'Revenire Programată',
      'Următorul Pas Agreat',
      'Număr Discuții',
      'Ultima Discuție',
      'Notițe Operative',
      'Date Incomplete',
      'Sursă Originală',
    ];

    const rows: string[] = [];
    rows.push(headers.map(escapeCsv).join(','));

    for (const r of records) {
      let emailsStr = '';
      try {
        const e = r.emails ? JSON.parse(r.emails) : [];
        emailsStr = Array.isArray(e) ? e.join(', ') : String(r.emails);
      } catch {
        emailsStr = r.emails || '';
      }

      const statusDef = COMMERCIAL_STATUSES[r.commercial_status as any];
      const statusLabel = statusDef ? statusDef.label : r.commercial_status;

      if (isTourism) {
        rows.push([
          escapeCsv(r.source_row_index || ''),
          escapeCsv(r.unit_type || ''),
          escapeCsv(r.unit_name || r.company_name || ''),
          escapeCsv(r.unit_classification || ''),
          escapeCsv(r.rooms_count || ''),
          escapeCsv(r.beds_count || ''),
          escapeCsv(r.address || ''),
          escapeCsv(r.locality_type || ''),
          escapeCsv(r.locality_subdivision || ''),
          escapeCsv(r.city || ''),
          escapeCsv(r.county || ''),
          escapeCsv(emailsStr),
          escapeCsv(r.website || ''),
          escapeCsv(r.operator_type || ''),
          escapeCsv(r.operator_name || ''),
          escapeCsv(r.reg_com || ''),
          escapeCsv(r.cui || ''),
          escapeCsv(statusLabel),
          escapeCsv(r.next_callback_date || ''),
          escapeCsv(r.discussions_count || 0),
          escapeCsv(r.last_discussion_date || ''),
          escapeCsv(r.operational_notes || ''),
        ].join(','));
      } else {
        let phonesStr = '';
        try {
          const p = r.phones ? JSON.parse(r.phones) : [];
          phonesStr = Array.isArray(p) ? p.join(', ') : String(r.phones);
        } catch {
          phonesStr = r.phones || '';
        }

        let productsStr = '';
        try {
          const prod = r.confirmed_interested_products ? JSON.parse(r.confirmed_interested_products) : [];
          productsStr = Array.isArray(prod) ? prod.join(', ') : '';
        } catch {
          productsStr = '';
        }

        rows.push([
          escapeCsv(r.source_row_index || ''),
          escapeCsv(r.company_name || ''),
          escapeCsv(statusLabel),
          escapeCsv(r.cui || ''),
          escapeCsv(r.reg_com || ''),
          escapeCsv(r.domain || ''),
          escapeCsv(r.county || ''),
          escapeCsv(r.city || ''),
          escapeCsv(r.address || ''),
          escapeCsv(phonesStr),
          escapeCsv(emailsStr),
          escapeCsv(r.website || ''),
          escapeCsv(r.decision_maker || r.contact_persons || ''),
          escapeCsv(r.insurance_suggestions || ''),
          escapeCsv(productsStr),
          escapeCsv(r.next_callback_date || ''),
          escapeCsv(r.next_action || ''),
          escapeCsv(r.discussions_count || 0),
          escapeCsv(r.last_discussion_date || ''),
          escapeCsv(r.operational_notes || r.initial_notes || ''),
          escapeCsv(r.is_incomplete ? 'DA (Date incomplete)' : 'NU'),
          escapeCsv(r.source_file || ''),
        ].join(','));
      }
    }

    const csvContent = '\uFEFF' + rows.join('\r\n');
    let filename = 'prospectare_generala_business_radar.csv';
    if (isTourism) {
      filename = 'unitati_turistice_clasificate_romania.csv';
    } else if (portfolio === 'NICHE_HORECA_AUTO_CONSTRUCT') {
      filename = 'prospectare_horeca_constructii_business_radar.csv';
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
