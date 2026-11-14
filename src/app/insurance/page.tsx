import { getDatabase } from '@/lib/db';
import Link from 'next/link';
import {
  ShieldCheck,
  Building2,
  Truck,
  Cpu,
  Hotel,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function InsuranceOpportunitiesPage() {
  const db = getDatabase();

  // Summary by Category
  const categoryCounts = db.prepare(`
    SELECT product_category, COUNT(*) as opp_count, COUNT(DISTINCT cui) as companies_count
    FROM insurance_opportunities
    GROUP BY product_category
    ORDER BY opp_count DESC
  `).all() as any[];

  // Top Opportunities with Company Details
  const topLeads = db.prepare(`
    SELECT 
      io.id, io.cui, io.product_category, io.product_name, io.rationale,
      io.estimated_priority, io.confidence_level, io.trigger_event,
      c.name as company_name, c.county, c.city, c.primary_caen, c.website
    FROM insurance_opportunities io
    JOIN companies c ON c.cui = io.cui
    ORDER BY io.confidence_level DESC, io.id DESC
    LIMIT 30
  `).all() as any[];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="border-b border-titanium-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-radar-green uppercase tracking-wider mb-1">
          <ShieldCheck className="w-4 h-4" />
          Lead Generation & Underwriting Engine
        </div>
        <h1 className="text-2xl font-extrabold text-titanium-100 tracking-tight">
          Hub Oportunități Asigurare
        </h1>
        <p className="text-xs text-titanium-400 mt-1">
          Algoritm de recomandare determinist bazat pe activități autorizate (CAEN), indicatori financiari, risc sectorial și obligații legale conform legislației românești.
        </p>
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categoryCounts.map((cat) => (
          <div key={cat.product_category} className="bg-titanium-900 border border-titanium-800 rounded-xl p-4 space-y-2">
            <div className="text-xs font-semibold text-titanium-400 uppercase tracking-wider truncate">
              {cat.product_category}
            </div>
            <div className="text-2xl font-bold text-titanium-100 font-mono">
              {cat.opp_count}
            </div>
            <div className="text-[11px] text-radar-green flex items-center justify-between">
              <span>{cat.companies_count} companii vizate</span>
            </div>
          </div>
        ))}
      </div>

      {/* Leads List */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-titanium-850 border-b border-titanium-800 flex items-center justify-between">
          <h2 className="text-xs font-bold text-titanium-200 uppercase tracking-wider">
            Oportunități de Brokeraj Recente ({topLeads.length})
          </h2>
          <span className="text-[11px] text-titanium-400">Sortat după nivelul de încredere al algoritmului</span>
        </div>

        <div className="divide-y divide-titanium-800">
          {topLeads.map((opp) => (
            <div key={opp.id} className="p-5 hover:bg-titanium-850/60 transition-colors space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-radar-green font-mono uppercase tracking-wider">
                      [{opp.product_category}]
                    </span>
                    <h3 className="font-extrabold text-sm text-titanium-100">
                      {opp.product_name}
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      opp.estimated_priority === 'URGENT' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                      opp.estimated_priority === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-titanium-800 text-titanium-400'
                    }`}>
                      {opp.estimated_priority}
                    </span>
                  </div>

                  <div className="text-xs text-titanium-400 flex items-center gap-2">
                    <span>Companie:</span>
                    <Link
                      href={`/companies/${opp.cui}`}
                      className="font-bold text-titanium-200 hover:text-radar-green underline"
                    >
                      {opp.company_name}
                    </Link>
                    <span className="font-mono text-titanium-500">(CUI {opp.cui})</span>
                    <span>• 📍 {opp.county || 'România'}, {opp.city || ''}</span>
                  </div>
                </div>

                <Link
                  href={`/companies/${opp.cui}`}
                  className="px-3 py-1.5 bg-titanium-800 hover:bg-radar-green hover:text-titanium-950 text-titanium-200 rounded text-xs font-semibold border border-titanium-700 transition-colors self-start md:self-auto flex items-center gap-1.5"
                >
                  Deschide Dosar Prospect <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="p-3 bg-titanium-950/70 rounded-lg border border-titanium-800/80 text-xs text-titanium-300">
                <span className="text-titanium-500 font-semibold mr-1.5">Argumentație Vânzare:</span>
                {opp.rationale}
              </div>

              <div className="flex flex-wrap items-center justify-between text-[11px] text-titanium-500 font-mono pt-1">
                <span>Trigger identificat: {opp.trigger_event}</span>
                <span>Grad de încredere model: {(opp.confidence_level * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
