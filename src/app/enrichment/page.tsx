'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Search,
  Phone,
  Mail,
  Globe,
  Smartphone,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  Download,
  Building2,
  ShieldCheck,
  ExternalLink,
  Layers,
  ArrowRight,
  Database,
  Cpu,
  FileText,
} from 'lucide-react';

function EnrichmentContent() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enrichingCui, setEnrichingCui] = useState('');
  const [singleEnrichResult, setSingleEnrichResult] = useState<any>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [jobTriggerLoading, setJobTriggerLoading] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/enrichment');
      const data = await res.json();
      if (data.success && data.data) {
        setStats(data.data);
      }
    } catch (e) {
      console.error('Eroare fetch stats enrichment:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStartBatch = async (limit = 25) => {
    setJobTriggerLoading(true);
    try {
      await fetch('/api/enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START_BATCH', limit, batchSize: 5 }),
      });
      await fetchStats();
    } catch (e) {
      console.error(e);
    } finally {
      setJobTriggerLoading(false);
    }
  };

  const handleStopBatch = async () => {
    setJobTriggerLoading(true);
    try {
      await fetch('/api/enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'STOP' }),
      });
      await fetchStats();
    } catch (e) {
      console.error(e);
    } finally {
      setJobTriggerLoading(false);
    }
  };

  const handleSingleEnrich = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrichingCui) return;
    setSingleLoading(true);
    setSingleEnrichResult(null);

    try {
      const res = await fetch(`/api/enrichment/company/${enrichingCui}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true }),
      });
      const data = await res.json();
      setSingleEnrichResult(data);
      await fetchStats();
    } catch (err: any) {
      setSingleEnrichResult({ success: false, error: err.message });
    } finally {
      setSingleLoading(false);
    }
  };

  const currentJob = stats?.currentJob || {};
  const isJobRunning = currentJob.status === 'RUNNING';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-titanium-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-radar-emerald/10 border border-radar-green/30 text-radar-green">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-titanium-100 font-sans tracking-tight">
                Motor de Îmbogățire &amp; Descoperire Contacte B2B
              </h1>
              <p className="text-xs text-titanium-400 mt-0.5">
                Identificare automată telefoane mobile, fixe, emailuri și website-uri oficiale din surse verificate (ANAF &amp; Web Scrape)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStats()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-titanium-800 hover:bg-titanium-700 text-titanium-200 text-xs border border-titanium-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizează
          </button>

          <Link
            href="/api/export?type=contacts"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs border border-emerald-500/30 font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Contacte CSV
          </Link>
        </div>
      </div>

      {/* KPI Counters Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-4 rounded-xl bg-titanium-900/60 border border-titanium-800">
          <div className="text-[10px] text-titanium-400 font-medium uppercase tracking-wider">Total Companii</div>
          <div className="text-2xl font-bold font-mono text-titanium-100 mt-1">
            {stats?.totalCompanies?.toLocaleString('ro-RO') ?? '...'}
          </div>
          <div className="text-[10px] text-titanium-400 mt-0.5">D1 Persistent</div>
        </div>

        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30">
          <div className="flex items-center justify-between text-[10px] text-blue-400 font-medium uppercase tracking-wider">
            <span>Cu Mobil</span>
            <Smartphone className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-300 mt-1">
            {stats?.companiesWithMobile?.toLocaleString('ro-RO') ?? '0'}
          </div>
          <Link href="/companies?hasMobile=true" className="text-[10px] text-blue-400 hover:underline mt-0.5 block">
            Vezi companii &rarr;
          </Link>
        </div>

        <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30">
          <div className="flex items-center justify-between text-[10px] text-cyan-400 font-medium uppercase tracking-wider">
            <span>Cu Fix</span>
            <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">
            {stats?.companiesWithLandline?.toLocaleString('ro-RO') ?? '0'}
          </div>
          <Link href="/companies?hasLandline=true" className="text-[10px] text-cyan-400 hover:underline mt-0.5 block">
            Vezi companii &rarr;
          </Link>
        </div>

        <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30">
          <div className="flex items-center justify-between text-[10px] text-purple-400 font-medium uppercase tracking-wider">
            <span>Cu Email</span>
            <Mail className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-300 mt-1">
            {stats?.companiesWithEmail?.toLocaleString('ro-RO') ?? '0'}
          </div>
          <Link href="/companies?hasEmail=true" className="text-[10px] text-purple-400 hover:underline mt-0.5 block">
            Vezi companii &rarr;
          </Link>
        </div>

        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
          <div className="flex items-center justify-between text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
            <span>Cu Website</span>
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">
            {stats?.companiesWithWebsite?.toLocaleString('ro-RO') ?? '0'}
          </div>
          <Link href="/companies?hasWebsite=true" className="text-[10px] text-emerald-400 hover:underline mt-0.5 block">
            Vezi companii &rarr;
          </Link>
        </div>

        <div className="p-4 rounded-xl bg-radar-emerald/10 border border-radar-green/30">
          <div className="flex items-center justify-between text-[10px] text-radar-green font-medium uppercase tracking-wider">
            <span>Cu Contacte</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-radar-green" />
          </div>
          <div className="text-2xl font-bold font-mono text-radar-green mt-1">
            {stats?.companiesWithAnyContact?.toLocaleString('ro-RO') ?? '0'}
          </div>
          <Link href="/companies?hasAnyContact=true" className="text-[10px] text-radar-green hover:underline mt-0.5 block">
            Prospecte active &rarr;
          </Link>
        </div>

        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30">
          <div className="flex items-center justify-between text-[10px] text-rose-400 font-medium uppercase tracking-wider">
            <span>Fără Contact</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-300 mt-1">
            {stats?.companiesWithNoContact?.toLocaleString('ro-RO') ?? '0'}
          </div>
          <Link href="/companies?noContact=true" className="text-[10px] text-rose-400 hover:underline mt-0.5 block">
            De îmbogățit &rarr;
          </Link>
        </div>
      </div>

      {/* Main Grid: Live Controls & Job Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Batch Enrichment Job Controller */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 rounded-xl bg-titanium-900/60 border border-titanium-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-titanium-100 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  Rulare Job Automat de Îmbogățire în Masă
                </h3>
                <p className="text-xs text-titanium-400 mt-0.5">
                  Procesare în tranșe sigure pe API ANAF v9 + extragere contacte din paginile web oficiale
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isJobRunning ? (
                  <button
                    onClick={handleStopBatch}
                    disabled={jobTriggerLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    Oprește
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartBatch(25)}
                      disabled={jobTriggerLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Îmbogățește Următoarele 25
                    </button>
                    <button
                      onClick={() => handleStartBatch(100)}
                      disabled={jobTriggerLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-titanium-800 hover:bg-titanium-700 text-titanium-200 border border-titanium-700 text-xs font-medium transition-colors"
                    >
                      Lot 100
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Job Status Banner */}
            <div className="p-4 rounded-lg bg-titanium-950 border border-titanium-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isJobRunning
                        ? 'bg-emerald-400 animate-pulse'
                        : currentJob.status === 'COMPLETED'
                        ? 'bg-blue-400'
                        : 'bg-titanium-500'
                    }`}
                  />
                  <span className="font-medium text-titanium-200">
                    Stare: <span className="font-mono">{currentJob.status || 'INACTIV'}</span>
                  </span>
                </div>
                <div className="text-titanium-400 font-mono">
                  Progres: {currentJob.processed || 0} / {currentJob.total || 0}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-titanium-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{
                    width: `${
                      currentJob.total > 0
                        ? Math.min(100, Math.round(((currentJob.processed || 0) / currentJob.total) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1 text-[11px] text-titanium-400">
                <div>
                  Reușite:{' '}
                  <span className="font-mono text-emerald-400">{currentJob.successful || 0}</span>
                </div>
                <div>
                  Erori: <span className="font-mono text-rose-400">{currentJob.failed || 0}</span>
                </div>
                <div>
                  Fără contact nou:{' '}
                  <span className="font-mono text-titanium-300">{currentJob.skipped || 0}</span>
                </div>
                <div>
                  Mobil găsite:{' '}
                  <span className="font-mono text-blue-400">{currentJob.contactsFound?.mobile || 0}</span>
                </div>
              </div>
            </div>

            {/* Quick Export Filters */}
            <div className="pt-2 border-t border-titanium-800/80">
              <div className="text-xs font-semibold text-titanium-300 mb-2">Exporturi Rapide Segmentate:</div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Link
                  href="/api/export?contactFilter=with_mobile"
                  className="px-2.5 py-1 rounded bg-titanium-800 hover:bg-titanium-700 text-titanium-200 border border-titanium-700"
                >
                  Companii cu Mobil CSV
                </Link>
                <Link
                  href="/api/export?contactFilter=with_landline"
                  className="px-2.5 py-1 rounded bg-titanium-800 hover:bg-titanium-700 text-titanium-200 border border-titanium-700"
                >
                  Companii cu Fix CSV
                </Link>
                <Link
                  href="/api/export?contactFilter=with_email"
                  className="px-2.5 py-1 rounded bg-titanium-800 hover:bg-titanium-700 text-titanium-200 border border-titanium-700"
                >
                  Companii cu Email CSV
                </Link>
                <Link
                  href="/api/export?contactFilter=with_website"
                  className="px-2.5 py-1 rounded bg-titanium-800 hover:bg-titanium-700 text-titanium-200 border border-titanium-700"
                >
                  Companii cu Website CSV
                </Link>
                <Link
                  href="/api/export?contactFilter=no_contacts"
                  className="px-2.5 py-1 rounded bg-titanium-800 hover:bg-titanium-700 text-rose-300 border border-rose-900/40"
                >
                  Companii fără Contact CSV
                </Link>
              </div>
            </div>
          </div>

          {/* Breakdown by Source & Verification Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By Source */}
            <div className="p-4 rounded-xl bg-titanium-900/60 border border-titanium-800 space-y-3">
              <h4 className="text-xs font-semibold text-titanium-200 flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                Contacte după Sursă de Proveniență
              </h4>
              <div className="space-y-2">
                {stats?.contactsBySource?.length > 0 ? (
                  stats.contactsBySource.map((s: any) => (
                    <div key={s.source_name} className="flex items-center justify-between text-xs py-1 border-b border-titanium-800/50">
                      <span className="font-mono text-titanium-300">{s.source_name}</span>
                      <span className="font-mono font-semibold text-titanium-100">{s.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-titanium-500 py-2">Nu există date încă</div>
                )}
              </div>
            </div>

            {/* By Verification Status */}
            <div className="p-4 rounded-xl bg-titanium-900/60 border border-titanium-800 space-y-3">
              <h4 className="text-xs font-semibold text-titanium-200 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Contacte după Nivel de Verificare
              </h4>
              <div className="space-y-2">
                {stats?.contactsByStatus?.length > 0 ? (
                  stats.contactsByStatus.map((st: any) => (
                    <div key={st.verification_status} className="flex items-center justify-between text-xs py-1 border-b border-titanium-800/50">
                      <span className="font-mono text-titanium-300">{st.verification_status}</span>
                      <span className="font-mono font-semibold text-titanium-100">{st.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-titanium-500 py-2">Nu există date încă</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Single CUI On-Demand Enrichment */}
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-titanium-900/60 border border-titanium-800 space-y-4">
            <h3 className="text-sm font-semibold text-titanium-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-400" />
              Interogare &amp; Îmbogățire CUI Individual
            </h3>
            <p className="text-xs text-titanium-400">
              Execută interogare în timp real pe ANAF v9 și extragere website pentru o companie anume
            </p>

            <form onSubmit={handleSingleEnrich} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-titanium-300 block mb-1">
                  Introduceți CUI-ul companiei:
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={enrichingCui}
                    onChange={(e) => setEnrichingCui(e.target.value)}
                    placeholder="ex: 15433290, 412052, 28094374"
                    className="flex-1 bg-titanium-950 border border-titanium-700 text-titanium-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-radar-green"
                  />
                  <button
                    type="submit"
                    disabled={singleLoading || !enrichingCui}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    {singleLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Verifică'}
                  </button>
                </div>
              </div>
            </form>

            {/* Single Enrich Output */}
            {singleEnrichResult && (
              <div className="p-3 rounded-lg bg-titanium-950 border border-titanium-800 space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold">
                  <span className={singleEnrichResult.success ? 'text-emerald-400' : 'text-rose-400'}>
                    {singleEnrichResult.success ? 'Îmbogățire Reușită' : 'Eroare Îmbogățire'}
                  </span>
                  {singleEnrichResult.data?.companyName && (
                    <Link
                      href={`/companies/${singleEnrichResult.data.cui}`}
                      className="text-blue-400 hover:underline flex items-center gap-1"
                    >
                      Vezi Dosar <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>

                {singleEnrichResult.data && (
                  <div className="space-y-1.5 text-titanium-300 pt-1">
                    <div>
                      Companie:{' '}
                      <span className="font-semibold text-titanium-100">{singleEnrichResult.data.companyName}</span>
                    </div>

                    {singleEnrichResult.data.taxStatus && (
                      <div className="p-2 rounded bg-titanium-900 border border-titanium-800 space-y-1 text-[11px]">
                        <div>
                          Stare:{' '}
                          <span className="font-mono text-emerald-300">
                            {singleEnrichResult.data.taxStatus.registrationState || 'Activ'}
                          </span>
                        </div>
                        <div>
                          Plătitor TVA:{' '}
                          <span className="font-mono">
                            {singleEnrichResult.data.taxStatus.vatRegistered ? 'DA' : 'NU'}
                          </span>
                        </div>
                        <div>
                          RO e-Factura:{' '}
                          <span className="font-mono">
                            {singleEnrichResult.data.taxStatus.eFacturaReady ? 'DA' : 'NU'}
                          </span>
                        </div>
                        {singleEnrichResult.data.taxStatus.fiscalAddress && (
                          <div className="text-titanium-400">
                            Adresă: {singleEnrichResult.data.taxStatus.fiscalAddress}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="font-semibold text-titanium-200 pt-1">
                      Contacte descoperite ({singleEnrichResult.data.contactsDiscovered?.length || 0}):
                    </div>

                    {singleEnrichResult.data.contactsDiscovered?.length > 0 ? (
                      <div className="space-y-1">
                        {singleEnrichResult.data.contactsDiscovered.map((c: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-1.5 rounded bg-titanium-900 border border-titanium-800 text-[11px] flex items-center justify-between"
                          >
                            <span className="font-mono text-emerald-300">{c.normalizedValue}</span>
                            <span className="text-titanium-400 uppercase text-[10px]">{c.contactType}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-titanium-500 italic text-[11px]">
                        Nu s-au identificat date de contact în sursele verificate.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Provider Status Card */}
          <div className="p-5 rounded-xl bg-titanium-900/60 border border-titanium-800 space-y-3">
            <h3 className="text-sm font-semibold text-titanium-100">Furnizori Activi de Date</h3>
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-lg bg-titanium-950 border border-titanium-800 flex items-center justify-between">
                <div>
                  <div className="font-medium text-titanium-200">ANAF PlatitorTvaRest v9</div>
                  <div className="text-[10px] text-titanium-400">Date fiscale, adrese &amp; telefoane declarate</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Activ
                </span>
              </div>

              <div className="p-3 rounded-lg bg-titanium-950 border border-titanium-800 flex items-center justify-between">
                <div>
                  <div className="font-medium text-titanium-200">Official Website Scraper</div>
                  <div className="text-[10px] text-titanium-400">Extragere telefoane, emailuri &amp; formulare</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Activ
                </span>
              </div>

              <div className="p-3 rounded-lg bg-titanium-950 border border-titanium-800 flex items-center justify-between">
                <div>
                  <div className="font-medium text-titanium-200">ONRC / Registrul Comerțului</div>
                  <div className="text-[10px] text-titanium-400">Date juridice, asociați, CAEN (Open Data)</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Importat
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default function EnrichmentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      }
    >
      <EnrichmentContent />
    </Suspense>
  );
}
