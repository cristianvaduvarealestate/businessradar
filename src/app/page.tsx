import Link from 'next/link';
import {
  Compass,
  Building2,
  ShieldCheck,
  TrendingUp,
  Globe,
  PhoneCall,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Activity,
  Layers,
} from 'lucide-react';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const db = getDatabase();

  const totalCompanies = (db.prepare('SELECT COUNT(*) as count FROM companies').get() as any).count;
  const activeCompanies = (db.prepare("SELECT COUNT(*) as count FROM companies WHERE status = 'ACTIVE'").get() as any).count;
  const newToday = (db.prepare("SELECT COUNT(*) as count FROM companies WHERE date(first_observed_at) = date('now')").get() as any).count;
  const newLast90Days = (db.prepare("SELECT COUNT(*) as count FROM companies WHERE datetime(first_observed_at, '+90 days') >= datetime('now')").get() as any).count;

  const withWebsite = (db.prepare("SELECT COUNT(*) as count FROM companies WHERE website IS NOT NULL AND website != ''").get() as any).count;
  const withContacts = (db.prepare("SELECT COUNT(DISTINCT cui) as count FROM contact_records").get() as any).count;
  const withOpportunities = (db.prepare("SELECT COUNT(DISTINCT cui) as count FROM insurance_opportunities").get() as any).count;
  const highPriority = (db.prepare("SELECT COUNT(*) as count FROM companies WHERE prospect_priority IN ('HIGH', 'URGENT')").get() as any).count;

  const topOpportunities = db.prepare(`
    SELECT c.cui, c.name, c.county, c.city, c.primary_caen, c.caen_description,
           c.opportunity_score, c.prospect_priority, c.website,
           (SELECT COUNT(*) FROM insurance_opportunities io WHERE io.cui = c.cui) as opp_count
    FROM companies c
    ORDER BY c.opportunity_score DESC, c.first_observed_at DESC
    LIMIT 6
  `).all() as any[];

  const topCounties = db.prepare(`
    SELECT county, COUNT(*) as count 
    FROM companies 
    WHERE county IS NOT NULL AND county != '' 
    GROUP BY county 
    ORDER BY count DESC 
    LIMIT 5
  `).all() as any[];

  const lastJob = db.prepare(`
    SELECT job_id, provider, started_at, ended_at, status, records_processed, new_records, duration_ms
    FROM ingestion_jobs
    ORDER BY id DESC
    LIMIT 1
  `).get() as any;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-titanium-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-radar-green uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-radar-green radar-pulse"></span>
            Intelligence Platform Live
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-titanium-100 tracking-tight">
            RADAR BUSINESS ROMÂNIA
          </h1>
          <p className="text-sm text-titanium-400 mt-1">
            Descoperire autonomă, monitorizare fiscală și generare oportunități de asigurare pentru companii românești.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/radar"
            className="px-4 py-2 bg-radar-green text-titanium-950 font-semibold text-xs rounded-lg hover:bg-emerald-400 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Compass className="w-4 h-4" />
            Radar Firme Noi
          </Link>
          <Link
            href="/insurance"
            className="px-4 py-2 bg-titanium-800 border border-titanium-700 text-titanium-200 font-semibold text-xs rounded-lg hover:bg-titanium-700 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-radar-green" />
            Oportunități Asigurare
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-titanium-400 text-xs font-medium mb-2">
            <span>Total Companii Înregistrate</span>
            <Building2 className="w-4 h-4 text-titanium-500" />
          </div>
          <div className="text-2xl font-bold text-titanium-100 font-mono">
            {totalCompanies.toLocaleString('ro-RO')}
          </div>
          <div className="text-[11px] text-titanium-500 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-radar-green" />
            {activeCompanies.toLocaleString('ro-RO')} în funcțiune
          </div>
        </div>

        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-titanium-400 text-xs font-medium mb-2">
            <span>Radar Firme Noi (90 Zile)</span>
            <Compass className="w-4 h-4 text-radar-green" />
          </div>
          <div className="text-2xl font-bold text-radar-green font-mono">
            {newLast90Days.toLocaleString('ro-RO')}
          </div>
          <div className="text-[11px] text-titanium-400 mt-1">
            +{newToday} identificate astăzi
          </div>
        </div>

        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-titanium-400 text-xs font-medium mb-2">
            <span>Cu Oportunități Asigurare</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400 font-mono">
            {withOpportunities.toLocaleString('ro-RO')}
          </div>
          <div className="text-[11px] text-titanium-400 mt-1">
            Polițe recomandate determinist
          </div>
        </div>

        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-titanium-400 text-xs font-medium mb-2">
            <span>Prospecte Prioritate Ridicată</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {highPriority.toLocaleString('ro-RO')}
          </div>
          <div className="text-[11px] text-titanium-400 mt-1">
            Scor oportunitate &gt;= 70%
          </div>
        </div>
      </div>

      {/* Ingestion & Provenance Status Banner */}
      <div className="bg-titanium-900/60 border border-titanium-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-radar-emerald/10 border border-radar-emerald/30 flex items-center justify-center text-radar-green">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-titanium-200">
              Ultimul Job Ingestie: {lastJob ? lastJob.provider : 'N/A'}
            </div>
            <div className="text-titanium-500 text-[11px]">
              Finalizat: {lastJob?.ended_at || 'Recent'} • Durată: {lastJob?.duration_ms || 0} ms • {lastJob?.new_records || 0} companii noi adăugate
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-titanium-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-radar-green"></span>
            ONRC Open Data (04.11.2026)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-radar-green"></span>
            ANAF PlatitorTvaRest
          </span>
          <Link href="/health" className="text-radar-green hover:underline flex items-center gap-1 font-medium">
            Detalii Watchdog <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Priority Lead Opportunities */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-titanium-200 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-radar-green" />
              Companii cu Scor Ridicat de Oportunitate
            </h2>
            <Link href="/companies" className="text-xs text-titanium-400 hover:text-radar-green flex items-center gap-1">
              Vezi toate companiile <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-titanium-900 border border-titanium-800 rounded-xl overflow-hidden divide-y divide-titanium-800">
            {topOpportunities.map((c) => (
              <div key={c.cui} className="p-4 hover:bg-titanium-850 transition-colors flex items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/companies/${c.cui}`}
                      className="font-bold text-sm text-titanium-100 hover:text-radar-green truncate"
                    >
                      {c.name}
                    </Link>
                    <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-titanium-800 border border-titanium-700 text-titanium-300">
                      CUI {c.cui}
                    </span>
                    {c.prospect_priority === 'URGENT' && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        URGENT
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-titanium-400 truncate">
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
                  <div className="text-xs font-semibold text-titanium-300 font-mono">
                    Scor: <span className="text-radar-green font-bold">{c.opportunity_score}%</span>
                  </div>
                  <div className="text-[11px] text-titanium-500">
                    {c.opp_count} polițe identificate
                  </div>
                  <Link
                    href={`/companies/${c.cui}`}
                    className="inline-block mt-2 px-2.5 py-1 bg-titanium-800 border border-titanium-700 text-titanium-200 hover:bg-radar-green hover:text-titanium-950 rounded text-[11px] font-medium transition-colors"
                  >
                    Deschide Profil
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar: Geographic & Category Distribution */}
        <div className="space-y-6">
          <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-titanium-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-titanium-400" />
              Distribuție Top Județe
            </h3>
            <div className="space-y-2.5">
              {topCounties.map((item) => (
                <div key={item.county} className="flex items-center justify-between text-xs">
                  <span className="text-titanium-300">{item.county}</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-titanium-100 font-bold">{item.count}</span>
                    <span className="text-titanium-500 text-[10px]">firme</span>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/companies"
              className="block text-center py-2 text-xs font-medium text-radar-green border border-titanium-700 rounded-lg hover:bg-titanium-800 transition-colors"
            >
              Filtrează după Județ
            </Link>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-titanium-200 uppercase tracking-wider">
              Sectoare Economice Cheie
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link href="/industries/CONSTRUCTION" className="p-2.5 rounded bg-titanium-850 hover:bg-titanium-800 border border-titanium-800 text-titanium-300 hover:text-white">
                🏗️ Construcții
              </Link>
              <Link href="/industries/TRANSPORT" className="p-2.5 rounded bg-titanium-850 hover:bg-titanium-800 border border-titanium-800 text-titanium-300 hover:text-white">
                🚛 Transport (CMR)
              </Link>
              <Link href="/industries/IT_TECH" className="p-2.5 rounded bg-titanium-850 hover:bg-titanium-800 border border-titanium-800 text-titanium-300 hover:text-white">
                💻 Software & IT
              </Link>
              <Link href="/industries/HOSPITALITY" className="p-2.5 rounded bg-titanium-850 hover:bg-titanium-800 border border-titanium-800 text-titanium-300 hover:text-white">
                🏨 HORECA
              </Link>
              <Link href="/industries/HEALTHCARE" className="p-2.5 rounded bg-titanium-850 hover:bg-titanium-800 border border-titanium-800 text-titanium-300 hover:text-white">
                🩺 Sănătate
              </Link>
              <Link href="/industries/REAL_ESTATE" className="p-2.5 rounded bg-titanium-850 hover:bg-titanium-800 border border-titanium-800 text-titanium-300 hover:text-white">
                🏢 Imobiliare
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
