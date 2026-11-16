'use client';

import { useState, useEffect, Suspense } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Building2,
  Calendar,
  Clock,
  Phone,
  Mail,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  MapPin,
  Globe,
  SlidersHorizontal,
  X,
  Play,
  RotateCw,
  Database,
  Layers,
  Activity,
  Server,
  Info,
} from 'lucide-react';
import CompanyProfileDrawer from '@/components/CompanyProfileDrawer';

interface NewCompanyItem {
  id: number;
  cui: number;
  name: string;
  normalized_name?: string;
  reg_com?: string;
  legal_form?: string;
  incorporation_date?: string;
  registration_date?: string;
  first_detected_at?: string;
  county?: string;
  city?: string;
  primary_caen?: string;
  caen_description?: string;
  legal_status?: string;
  fiscal_status?: string;
  classification?: string;
  verification_state?: string;
  qualification_status?: string;
  qualification_notes?: string;
  insurance_relevance?: string;
  discovery_source?: string;
  mobile_phone?: string;
  mobile_source?: string;
  mobile_status?: string;
  landline_phone?: string;
  email_contact?: string;
  website?: string;
  sample_phone?: string;
  sample_email?: string;
  contact_count?: number;
  crm_status?: string;
}

interface MonitoringOverview {
  config: Record<string, string>;
  stats: {
    today: number;
    last_7_days: number;
    last_30_days: number;
    total_new: number;
    continuous_count: number;
    backfill_count: number;
    verified: number;
    awaiting: number;
    with_contacts: number;
  };
  recentSyncs: Array<{
    id: number;
    sync_id: string;
    started_at: string;
    ended_at?: string;
    status: string;
    records_discovered: number;
    records_updated: number;
    records_rejected?: number;
    checkpoint_start?: string;
    checkpoint_end?: string;
    error_message?: string;
  }>;
}

function NewCompaniesContent() {
  const [items, setItems] = useState<NewCompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Monitoring overview data
  const [monitoring, setMonitoring] = useState<MonitoringOverview | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNotification, setSyncNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<'all' | 'continuous' | 'backfill'>('all');
  const [dateRange, setDateRange] = useState('all'); // 'today', '7days', '30days', 'all'
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedLegalForm, setSelectedLegalForm] = useState('');
  const [selectedLegalStatus, setSelectedLegalStatus] = useState('');
  const [selectedFiscalStatus, setSelectedFiscalStatus] = useState('');
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [hasEmailOnly, setHasEmailOnly] = useState(false);
  const [potentialProspectOnly, setPotentialProspectOnly] = useState(false);
  const [notYetQualifiedOnly, setNotYetQualifiedOnly] = useState(false);

  // Unified Drawer state
  const [selectedCui, setSelectedCui] = useState<number | null>(null);

  const fetchMonitoringStatus = async () => {
    try {
      const res = await fetch('/api/monitoring');
      const data = await res.json();
      if (data.success) {
        setMonitoring(data);
      }
    } catch (err) {
      console.error('Failed to load monitoring overview:', err);
    }
  };

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('scope', 'new');
      params.set('page', String(pagination.page));
      params.set('limit', String(pagination.limit));
      params.set('sort', 'registration_date');
      params.set('order', 'DESC');

      if (selectedCohort === 'continuous') {
        params.set('cohort', 'continuous');
      } else if (selectedCohort === 'backfill') {
        params.set('cohort', 'backfill');
      }

      if (searchQuery) params.set('q', searchQuery);
      if (dateRange && dateRange !== 'all') params.set('dateRange', dateRange);
      if (selectedCounty) params.set('county', selectedCounty);
      if (selectedLegalForm) params.set('legalForm', selectedLegalForm);
      if (selectedLegalStatus) params.set('legalStatus', selectedLegalStatus);
      if (selectedFiscalStatus) params.set('fiscalStatus', selectedFiscalStatus);
      if (hasPhoneOnly) params.set('hasPhone', 'true');
      if (hasEmailOnly) params.set('hasEmail', 'true');
      if (potentialProspectOnly) params.set('potentialProspect', 'true');
      if (notYetQualifiedOnly) params.set('notYetQualified', 'true');

      const res = await fetch(`/api/companies?${params.toString()}`);
      const data = await res.json();

      if (data.success && data.data) {
        setItems(data.data.items || []);
        setPagination({
          page: data.data.pagination.page,
          limit: data.data.pagination.limit,
          total: data.data.pagination.total,
          totalPages: data.data.pagination.totalPages,
        });
      }
    } catch (err) {
      console.error('Failed to load new companies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringStatus();
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [
    pagination.page,
    selectedCohort,
    dateRange,
    selectedCounty,
    selectedLegalForm,
    selectedLegalStatus,
    selectedFiscalStatus,
    hasPhoneOnly,
    hasEmailOnly,
    potentialProspectOnly,
    notYetQualifiedOnly,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchCompanies();
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    setSyncNotification(null);
    try {
      const res = await fetch('/api/monitoring/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchLimit: 50 }),
      });
      const data = await res.json();

      if (data.success) {
        setSyncNotification({
          type: 'success',
          message: data.message || `Sincronizare completă: ${data.discoveredCount} companii noi descoperite.`,
        });
        await fetchMonitoringStatus();
        await fetchCompanies();
      } else {
        setSyncNotification({
          type: 'error',
          message: data.message || data.error || 'Eroare la sincronizare',
        });
      }
    } catch (err: any) {
      setSyncNotification({
        type: 'error',
        message: err.message || 'Eroare de rețea la lansarea sincronizării',
      });
    } finally {
      setSyncing(false);
    }
  };

  const cfg = monitoring?.config || {};
  const stats = monitoring?.stats || {
    today: 0,
    last_7_days: 0,
    last_30_days: 0,
    total_new: 0,
    continuous_count: 0,
    backfill_count: 0,
    verified: 0,
    awaiting: 0,
    with_contacts: 0,
  };

  const lastSync = monitoring?.recentSyncs?.[0];

  return (
    <div className="min-h-screen bg-titanium-950 text-titanium-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-titanium-800 bg-titanium-900/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-radar-emerald/10 border border-radar-emerald/30 flex items-center justify-center text-radar-green">
                <Sparkles className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                FIRME NOI
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-radar-emerald/20 text-radar-green border border-radar-emerald/30">
                  Radar Automat
                </span>
              </h1>
            </div>
            <p className="text-xs text-titanium-400 mt-1">
              Descoperire continuă ONRC &amp; verificare automată ANAF v9 pentru asigurări B2B
            </p>
          </div>

          {/* Sync Action & Header Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className={`px-3 py-2 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-colors ${
                showTechnicalDetails
                  ? 'bg-titanium-800 border-radar-green/50 text-radar-green'
                  : 'bg-titanium-900 border-titanium-750 text-titanium-300 hover:text-white'
              }`}
              title="Afișează detaliile tehnice ale executorului de sincronizare"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Diagnostic Sync</span>
            </button>

            <button
              onClick={handleTriggerSync}
              disabled={syncing}
              className="px-4 py-2 rounded-lg bg-radar-green hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-radar-green/10 disabled:opacity-50"
              title="Lansează procesul real de monitorizare și scanare ONRC"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Sincronizare în curs...' : 'Sincronizează acum'}</span>
            </button>
          </div>
        </div>

        {/* Sync Toast Notification */}
        {syncNotification && (
          <div
            className={`px-4 py-2.5 text-xs font-mono flex items-center justify-between border-t ${
              syncNotification.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
              {syncNotification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{syncNotification.message}</span>
            </div>
            <button
              onClick={() => setSyncNotification(null)}
              className="text-titanium-400 hover:text-white text-xs ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Diagnostic Technical Details Panel (Expandable) */}
        {showTechnicalDetails && (
          <div className="bg-titanium-950 border-t border-b border-titanium-800 px-4 sm:px-6 py-4">
            <div className="max-w-7xl mx-auto space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-titanium-850">
                <div className="flex items-center gap-2 text-radar-green font-bold">
                  <Server className="w-4 h-4" />
                  <span>Stare Arhitectură Executor &amp; Sursă Date</span>
                </div>
                <div className="text-[11px] text-titanium-400">
                  Activare cutoff: <strong className="text-white">{cfg.monitoring_activation_date || '2026-10-01'}</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-titanium-900/60 p-2.5 rounded-lg border border-titanium-800">
                  <div className="text-[10px] text-titanium-500 uppercase">Frecvență Sursă ONRC</div>
                  <div className="text-white font-bold mt-1">Periodică (2–4 săpt.)</div>
                  <div className="text-[10px] text-titanium-400 mt-0.5 truncate" title={cfg.active_package_title}>
                    {cfg.active_package_title || 'OD_FIRME.CSV'}
                  </div>
                  <div className="text-[10px] text-titanium-500 mt-1">
                    Modificat: {cfg.active_package_modified ? new Date(cfg.active_package_modified).toLocaleDateString('ro-RO') : '06.11.2026'}
                  </div>
                </div>

                <div className="bg-titanium-900/60 p-2.5 rounded-lg border border-titanium-800">
                  <div className="text-[10px] text-titanium-500 uppercase">Frecvență Executor GH Actions</div>
                  <div className="text-radar-green font-bold mt-1">Zilnic (06:00 UTC)</div>
                  <div className="text-[10px] text-titanium-400 mt-0.5">Programat prin Cron Trigger</div>
                  <div className="text-[10px] text-titanium-500 mt-1">
                    Următorul run: <span className="text-titanium-300">Mâine 06:00 UTC</span>
                  </div>
                </div>

                <div className="bg-titanium-900/60 p-2.5 rounded-lg border border-titanium-800">
                  <div className="text-[10px] text-titanium-500 uppercase">Ultima Ingestie Reușită</div>
                  <div className="text-white font-bold mt-1">
                    {cfg.last_successful_sync_at ? new Date(cfg.last_successful_sync_at).toLocaleString('ro-RO') : 'Nicio execuție'}
                  </div>
                  <div className="text-[10px] text-titanium-400 mt-0.5">
                    Cursor linii: <span className="text-titanium-200">{cfg.stream_cursor_line || '0'}</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-1">
                    Status: {cfg.last_sync_status || 'STANDBY'}
                  </div>
                </div>

                <div className="bg-titanium-900/60 p-2.5 rounded-lg border border-titanium-800">
                  <div className="text-[10px] text-titanium-500 uppercase">Indicatori Ultimul Job</div>
                  <div className="text-titanium-300 font-bold mt-1">
                    {lastSync ? `Sync ${lastSync.sync_id.slice(-8)}` : 'Job curent'}
                  </div>
                  <div className="text-[10px] text-titanium-400 mt-0.5 flex items-center justify-between">
                    <span>Noi: {lastSync?.records_discovered ?? stats.total_new}</span>
                    <span>Actualizate: {lastSync?.records_updated ?? 0}</span>
                  </div>
                  {lastSync?.error_message ? (
                    <div className="text-[10px] text-rose-400 mt-1 truncate" title={lastSync.error_message}>
                      Eroare: {lastSync.error_message}
                    </div>
                  ) : (
                    <div className="text-[10px] text-titanium-500 mt-1">Erori sincronizare: 0</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Monitoring KPI Bar */}
        <div className="bg-titanium-950/80 border-t border-titanium-800/80 px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
            <div className="bg-titanium-900/60 border border-titanium-800 rounded-lg p-2.5">
              <div className="text-[10px] text-titanium-500 uppercase font-mono">Descoperite Astăzi</div>
              <div className="text-lg font-black text-white mt-0.5">{stats.today}</div>
            </div>

            <div className="bg-titanium-900/60 border border-titanium-800 rounded-lg p-2.5">
              <div className="text-[10px] text-titanium-500 uppercase font-mono">Ultimele 7 Zile</div>
              <div className="text-lg font-black text-radar-green mt-0.5">{stats.last_7_days}</div>
            </div>

            <div className="bg-titanium-900/60 border border-titanium-800 rounded-lg p-2.5">
              <div className="text-[10px] text-titanium-500 uppercase font-mono">Descoperire Continuă</div>
              <div className="text-lg font-black text-emerald-400 mt-0.5">{stats.continuous_count ?? stats.total_new}</div>
            </div>

            <div className="bg-titanium-900/60 border border-titanium-800 rounded-lg p-2.5">
              <div className="text-[10px] text-titanium-500 uppercase font-mono">Backfill Inițial (2026)</div>
              <div className="text-lg font-black text-amber-400 mt-0.5">{stats.backfill_count ?? 0}</div>
            </div>

            <div className="bg-titanium-900/60 border border-titanium-800 rounded-lg p-2.5">
              <div className="text-[10px] text-titanium-500 uppercase font-mono">Verificate Fiscal</div>
              <div className="text-lg font-black text-cyan-400 mt-0.5">{stats.verified}</div>
            </div>

            <div className="bg-titanium-900/60 border border-titanium-800 rounded-lg p-2.5">
              <div className="text-[10px] text-titanium-500 uppercase font-mono">Cu Telefon / Email</div>
              <div className="text-lg font-black text-purple-400 mt-0.5">{stats.with_contacts}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-4">
        {/* Filter Controls */}
        <div className="bg-titanium-900/70 border border-titanium-800 rounded-xl p-4 space-y-3">
          {/* Cohort Tabs & Search Row */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Cohort Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-titanium-950 rounded-lg border border-titanium-800">
              <button
                onClick={() => {
                  setSelectedCohort('all');
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  selectedCohort === 'all'
                    ? 'bg-titanium-800 text-white font-bold'
                    : 'text-titanium-400 hover:text-white'
                }`}
              >
                Toate Descoperite ({stats.total_new})
              </button>
              <button
                onClick={() => {
                  setSelectedCohort('continuous');
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  selectedCohort === 'continuous'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'text-titanium-400 hover:text-white'
                }`}
              >
                <span>Descoperire Continuă</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/30 text-emerald-200">
                  {stats.continuous_count ?? stats.total_new}
                </span>
              </button>
              <button
                onClick={() => {
                  setSelectedCohort('backfill');
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  selectedCohort === 'backfill'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-titanium-400 hover:text-white'
                }`}
              >
                <span>Backfill Inițial</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/30 text-amber-200">
                  {stats.backfill_count ?? 0}
                </span>
              </button>
            </div>

            {/* Quick Date Range Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {[
                { id: 'all', label: 'Toate Datate' },
                { id: 'today', label: 'Astăzi' },
                { id: '7days', label: '7 zile' },
                { id: '30days', label: '30 zile' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => {
                    setDateRange(pill.id);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    dateRange === pill.id
                      ? 'bg-radar-green text-black shadow-sm font-bold'
                      : 'bg-titanium-800 hover:bg-titanium-700 text-titanium-300'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-titanium-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Caută după nume firmă, CUI, localitate sau CAEN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-titanium-950 border border-titanium-700 rounded-lg text-xs text-white placeholder-titanium-500 focus:outline-none focus:border-radar-green"
            />
          </form>

          {/* Secondary Filter Dropdowns & Checkboxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-2 border-t border-titanium-800/60 text-xs">
            {/* County */}
            <select
              value={selectedCounty}
              onChange={(e) => {
                setSelectedCounty(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="bg-titanium-950 border border-titanium-700 text-titanium-200 rounded-lg px-2 py-1.5 focus:border-radar-green focus:outline-none"
            >
              <option value="">Toate Județele</option>
              {['Bucureşti', 'Ilfov', 'Cluj', 'Timiş', 'Braşov', 'Constanţa', 'Iaşi', 'Prahova', 'Bihor', 'Dolj', 'Argeş', 'Sibiu'].map((jud) => (
                <option key={jud} value={jud}>{jud}</option>
              ))}
            </select>

            {/* Legal Form */}
            <select
              value={selectedLegalForm}
              onChange={(e) => {
                setSelectedLegalForm(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="bg-titanium-950 border border-titanium-700 text-titanium-200 rounded-lg px-2 py-1.5 focus:border-radar-green focus:outline-none"
            >
              <option value="">Formă Juridică</option>
              <option value="SRL">SRL</option>
              <option value="PFA">PFA</option>
              <option value="SA">SA</option>
              <option value="II">Întreprindere Individuală</option>
            </select>

            {/* Legal Status */}
            <select
              value={selectedLegalStatus}
              onChange={(e) => {
                setSelectedLegalStatus(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="bg-titanium-950 border border-titanium-700 text-titanium-200 rounded-lg px-2 py-1.5 focus:border-radar-green focus:outline-none"
            >
              <option value="">Stare Legală</option>
              <option value="ACTIVE">ACTIV</option>
              <option value="SUSPENDED">SUSPENDAT</option>
              <option value="RADIATED">RADIAT</option>
            </select>

            {/* Fiscal Status */}
            <select
              value={selectedFiscalStatus}
              onChange={(e) => {
                setSelectedFiscalStatus(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="bg-titanium-950 border border-titanium-700 text-titanium-200 rounded-lg px-2 py-1.5 focus:border-radar-green focus:outline-none"
            >
              <option value="">Stare Fiscală</option>
              <option value="FISCALLY_ACTIVE">Activ Fiscal</option>
              <option value="FISCALLY_INACTIVE">Inactiv Fiscal</option>
              <option value="REACTIVATED">Reactivat</option>
            </select>

            {/* Has Phone Checkbox */}
            <label className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-titanium-950 border border-titanium-700 cursor-pointer text-titanium-300">
              <input
                type="checkbox"
                checked={hasPhoneOnly}
                onChange={(e) => {
                  setHasPhoneOnly(e.target.checked);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="rounded border-titanium-700 text-radar-green focus:ring-0 bg-titanium-900"
              />
              <span className="text-[11px] truncate">Are Telefon</span>
            </label>

            {/* Potential Prospect Checkbox */}
            <label className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-titanium-950 border border-titanium-700 cursor-pointer text-titanium-300">
              <input
                type="checkbox"
                checked={potentialProspectOnly}
                onChange={(e) => {
                  setPotentialProspectOnly(e.target.checked);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="rounded border-titanium-700 text-radar-green focus:ring-0 bg-titanium-900"
              />
              <span className="text-[11px] truncate">Prospect Potențial</span>
            </label>
          </div>
        </div>

        {/* Results Counter & Pagination Header */}
        <div className="flex items-center justify-between text-xs text-titanium-400 font-mono px-1">
          <div>
            Afișare: <strong className="text-white">{items.length}</strong> din{' '}
            <strong className="text-radar-green">{pagination.total}</strong> companii noi descoperite
          </div>
          <div>
            Pagina {pagination.page} din {pagination.totalPages}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-titanium-950 text-titanium-400 font-mono border-b border-titanium-800 uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Companie &amp; CUI</th>
                  <th className="p-3.5">Înmatriculare &amp; Detecție</th>
                  <th className="p-3.5">Cohortă</th>
                  <th className="p-3.5">Locație</th>
                  <th className="p-3.5">CAEN &amp; Industrie</th>
                  <th className="p-3.5">Stare Juridică / Fiscală</th>
                  <th className="p-3.5">Contacte</th>
                  <th className="p-3.5">Calificare &amp; Nevoi</th>
                  <th className="p-3.5 text-right">Acțiune</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-titanium-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-titanium-400 font-mono">
                      Se încarcă firmele noi din monitorizare...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center space-y-3">
                      <div className="text-titanium-400 font-medium">
                        Nu a fost găsită nicio companie nouă conform filtrelor selectate.
                      </div>
                      <div className="text-xs text-titanium-500">
                        Apasă pe butonul <strong>„Sincronizează acum”</strong> de mai sus pentru a declanșa scanarea depozitului ONRC.
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.cui}
                      onClick={() => setSelectedCui(item.cui)}
                      className="hover:bg-titanium-850/60 transition-colors cursor-pointer group"
                    >
                      {/* Name & CUI */}
                      <td className="p-3.5">
                        <div className="font-bold text-white group-hover:text-radar-green transition-colors">
                          {item.name}
                        </div>
                        <div className="text-[11px] font-mono text-titanium-400 flex items-center gap-2 mt-0.5">
                          <span>CUI: <strong className="text-titanium-200">{item.cui}</strong></span>
                          <span>•</span>
                          <span>{item.legal_form || 'SRL'}</span>
                        </div>
                      </td>

                      {/* Registration & Detection Date */}
                      <td className="p-3.5 font-mono text-[11px]">
                        <div className="text-titanium-200 font-semibold" title="Data oficială de înmatriculare la Registrul Comerțului">
                          {item.registration_date || item.incorporation_date || '—'}
                        </div>
                        <div className="text-[10px] text-titanium-500 flex items-center gap-1 mt-0.5" title="Data primei detecții de către radar">
                          <Clock className="w-3 h-3 text-titanium-600" />
                          <span>Det: {item.first_detected_at ? item.first_detected_at.slice(0, 10) : '—'}</span>
                        </div>
                      </td>

                      {/* Cohort Badge */}
                      <td className="p-3.5">
                        {item.classification === 'BACKFILL' ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                            BACKFILL
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                            CONTINUU
                          </span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="p-3.5">
                        <div className="text-titanium-200 font-medium">{item.county || 'România'}</div>
                        <div className="text-[11px] text-titanium-400 truncate max-w-[140px]">
                          {item.city || '—'}
                        </div>
                      </td>

                      {/* CAEN & Category */}
                      <td className="p-3.5">
                        <div className="font-mono text-radar-green font-bold text-[11px]">
                          {item.primary_caen || '7022'}
                        </div>
                        <div className="text-[11px] text-titanium-300 truncate max-w-[180px]" title={item.caen_description}>
                          {item.caen_description || 'Consultanță afaceri'}
                        </div>
                      </td>

                      {/* Legal & Fiscal Status */}
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1 text-[10px] font-mono">
                          <span
                            className={`px-1.5 py-0.5 rounded border inline-block w-fit ${
                              item.legal_status === 'ACTIVE'
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                                : 'bg-titanium-800 border-titanium-700 text-titanium-400'
                            }`}
                          >
                            {item.legal_status || 'ACTIV'}
                          </span>

                          <span
                            className={`px-1.5 py-0.5 rounded border inline-block w-fit ${
                              item.fiscal_status === 'FISCALLY_ACTIVE' || item.fiscal_status === 'REACTIVATED'
                                ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                                : item.fiscal_status === 'FISCALLY_INACTIVE'
                                ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                                : 'bg-titanium-800 border-titanium-700 text-titanium-500'
                            }`}
                          >
                            {item.fiscal_status === 'FISCALLY_ACTIVE'
                              ? 'ACTIV FISCAL'
                              : item.fiscal_status === 'REACTIVATED'
                              ? 'REACTIVAT'
                              : item.fiscal_status === 'FISCALLY_INACTIVE'
                              ? 'INACTIV FISCAL'
                              : 'NEVERIFICAT'}
                          </span>
                        </div>
                      </td>

                      {/* Contacts */}
                      <td className="p-3.5 font-mono text-[11px]">
                        {item.mobile_phone || item.landline_phone || item.sample_phone ? (
                          <div className="flex items-center gap-1.5 text-radar-green">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            <span>{item.mobile_phone || item.landline_phone || item.sample_phone}</span>
                          </div>
                        ) : item.email_contact || item.sample_email ? (
                          <div className="flex items-center gap-1.5 text-cyan-400">
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[120px]">{item.email_contact || item.sample_email}</span>
                          </div>
                        ) : (
                          <span className="text-titanium-600 italic text-[10px]">Fără contacte declarate</span>
                        )}
                      </td>

                      {/* Qualification & Insurance */}
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-block ${
                            item.qualification_status === 'PROSPECT_ELIGIBLE'
                              ? 'bg-radar-emerald/20 border-radar-emerald/40 text-radar-green'
                              : item.qualification_status === 'CONTACT_AVAILABLE'
                              ? 'bg-purple-950/60 border-purple-500/40 text-purple-300'
                              : item.qualification_status === 'NOT_ELIGIBLE_YET'
                              ? 'bg-titanium-800 border-titanium-700 text-titanium-400'
                              : 'bg-titanium-800/80 border-titanium-700 text-titanium-400'
                          }`}
                        >
                          {item.qualification_status === 'PROSPECT_ELIGIBLE'
                            ? 'Prospect Calificat'
                            : item.qualification_status === 'CONTACT_AVAILABLE'
                            ? 'Contact Disponibil'
                            : item.qualification_status === 'NOT_ELIGIBLE_YET'
                            ? 'Lipsă Contact'
                            : 'În Așteptare Evaluare'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCui(item.cui);
                          }}
                          className="px-2.5 py-1 rounded bg-titanium-800 hover:bg-radar-green hover:text-black text-titanium-200 text-xs font-semibold transition-colors"
                        >
                          Profil
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-titanium-800 flex items-center justify-between text-xs bg-titanium-950">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                className="px-3 py-1.5 rounded bg-titanium-800 hover:bg-titanium-700 disabled:opacity-40 disabled:hover:bg-titanium-800 text-white flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Anterior
              </button>

              <div className="font-mono text-titanium-400">
                Pagina <strong className="text-white">{pagination.page}</strong> din{' '}
                <strong className="text-white">{pagination.totalPages}</strong>
              </div>

              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                className="px-3 py-1.5 rounded bg-titanium-800 hover:bg-titanium-700 disabled:opacity-40 disabled:hover:bg-titanium-800 text-white flex items-center gap-1"
              >
                Următor <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Unified Company Profile Drawer */}
      <CompanyProfileDrawer
        cui={selectedCui}
        onClose={() => setSelectedCui(null)}
        onRecordUpdated={() => {
          fetchCompanies();
          fetchMonitoringStatus();
        }}
      />
    </div>
  );
}

export default function NewCompaniesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-titanium-950 p-6 text-white font-mono">Se încarcă modulul...</div>}>
      <NewCompaniesContent />
    </Suspense>
  );
}
