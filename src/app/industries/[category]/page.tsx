import { notFound } from 'next/navigation';
import Link from 'next/link';
import { INDUSTRY_CATEGORIES } from '@/lib/caen';
import { getDatabase } from '@/lib/db';
import {
  Layers,
  Building2,
  ShieldCheck,
  Globe,
  ArrowLeft,
  ChevronRight,
  Download,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function IndustryCategoryPage({ params }: { params: { category: string } }) {
  const catId = params.category.toUpperCase();
  const cat = INDUSTRY_CATEGORIES[catId];
  if (!cat) notFound();

  const db = getDatabase();

  const orPrefixes = cat.caenPrefixes.map(() => 'primary_caen LIKE ?').join(' OR ');
  const sqlParams = cat.caenPrefixes.map((p) => `${p}%`);

  const companies = db.prepare(`
    SELECT 
      c.cui, c.name, c.reg_com, c.legal_form, c.county, c.city, c.primary_caen, c.caen_description,
      c.website, c.opportunity_score, c.prospect_priority,
      (SELECT COUNT(*) FROM insurance_opportunities io WHERE io.cui = c.cui) as opp_count
    FROM companies c
    WHERE ${orPrefixes}
    ORDER BY c.opportunity_score DESC
    LIMIT 50
  `).all(...sqlParams) as any[];

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/industries"
          className="text-xs text-titanium-400 hover:text-radar-green flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Toate Sectoarele
        </Link>
        <button
          onClick={() => window.open(`/api/export?category=${cat.id}`, '_blank')}
          className="px-3 py-1.5 bg-titanium-800 hover:bg-titanium-700 text-titanium-200 text-xs font-semibold rounded-lg border border-titanium-700 flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-radar-green" />
          Exportă Sectorul (CSV)
        </button>
      </div>

      <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-radar-green font-mono uppercase tracking-wider">
          <Layers className="w-4 h-4" />
          Sector Economic
        </div>
        <h1 className="text-2xl font-black text-titanium-100 tracking-tight">
          {cat.nameRo} ({cat.name})
        </h1>
        <p className="text-xs text-titanium-300 max-w-3xl">
          {cat.description}
        </p>
        <div className="pt-2 flex flex-wrap gap-1.5 text-xs">
          <span className="text-titanium-500">Coduri CAEN incluse:</span>
          {cat.caenPrefixes.map((p) => (
            <span key={p} className="px-1.5 py-0.5 rounded bg-titanium-800 text-titanium-300 font-mono text-[11px]">
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Companies List */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-titanium-850 border-b border-titanium-800 flex items-center justify-between text-xs font-bold text-titanium-300 uppercase tracking-wider">
          <span>Companii în Sectorul {cat.nameRo} ({companies.length})</span>
          <span>Scor Oportunitate & Acțiuni</span>
        </div>

        <div className="divide-y divide-titanium-800">
          {companies.length === 0 ? (
            <div className="py-12 text-center text-xs text-titanium-500">
              Nicio companie clasificată în acest sector în eșantionul curent.
            </div>
          ) : (
            companies.map((c) => (
              <div key={c.cui} className="p-4 hover:bg-titanium-850/60 transition-colors flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/companies/${c.cui}`}
                      className="font-bold text-sm text-titanium-100 hover:text-radar-green"
                    >
                      {c.name}
                    </Link>
                    <span className="font-mono text-xs text-titanium-400">(CUI {c.cui})</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-titanium-800 border border-titanium-700 text-titanium-300">
                      {c.legal_form || 'SRL'}
                    </span>
                  </div>

                  <div className="text-xs text-titanium-400">
                    📍 {c.county || 'România'}, {c.city || ''} • 🏷️ CAEN {c.primary_caen}: {c.caen_description}
                  </div>

                  {c.website && (
                    <div className="text-[11px] text-radar-green flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {c.website}
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono text-radar-green font-bold text-sm">
                    {c.opportunity_score}%
                  </div>
                  <div className="text-[11px] text-titanium-500">
                    {c.opp_count} polițe
                  </div>
                  <Link
                    href={`/companies/${c.cui}`}
                    className="inline-block mt-1 px-2.5 py-1 bg-titanium-800 hover:bg-radar-green hover:text-titanium-950 text-titanium-200 rounded text-[11px] font-medium border border-titanium-700 transition-colors"
                  >
                    Profil
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
