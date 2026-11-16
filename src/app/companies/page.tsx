'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Filter,
  Download,
  Building2,
  Globe,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  Smartphone,
  PhoneCall,
  RefreshCw,
  ExternalLink,
  X,
  Copy,
  Check,
  Calendar,
  Clock,
  User,
  FileText,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Send,
  Sparkles,
  CheckCircle2,
  PhoneOutgoing,
} from 'lucide-react';
import CompanyProfileDrawer from '@/components/CompanyProfileDrawer';

interface CompanyItem {
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
  commercial_evidence_status?: string;
  latest_financial_year?: number;
  turnover?: number;
  employees_avg?: number;
  net_profit?: number;
  crm_status?: string;
  next_follow_up_date?: string;
  contact_count?: number;
  mobile_phone?: string;
  mobile_source?: string;
  mobile_status?: string;
  landline_phone?: string;
  landline_source?: string;
  landline_status?: string;
  email_contact?: string;
  email_source?: string;
  email_status?: string;
  website?: string;
  sample_phone?: string;
  sample_email?: string;
  last_interaction_outcome?: string;
  last_interaction_at?: string;
}

interface StatsData {
  active_with_contact: number;
  not_contacted: number;
  contacted: number;
  followups_due: number;
  interested: number;
  offers_requested: number;
  offers_sent: number;
  clients_won: number;
  do_not_contact: number;
}

function CompaniesContent() {
  const searchParams = useSearchParams();

  // Primary list & pagination
  const [items, setItems] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Top KPI Stats
  const [stats, setStats] = useState<StatsData>({
    active_with_contact: 128,
    not_contacted: 127,
    contacted: 1,
    followups_due: 0,
    interested: 0,
    offers_requested: 0,
    offers_sent: 0,
    clients_won: 0,
    do_not_contact: 0,
  });

  // Filters
  const [view, setView] = useState<'active' | 'all' | 'excluded' | 'unverified'>('active');
  const [query, setQuery] = useState(searchParams?.get('q') || '');
  const [county, setCounty] = useState(searchParams?.get('county') || '');
  const [crmStatus, setCrmStatus] = useState(searchParams?.get('crmStatus') || '');
  const [contactFilter, setContactFilter] = useState('');
  const [activeKpiFilter, setActiveKpiFilter] = useState<string>('all_active');

  // Selected CUI for unified drawer
  const [selectedCui, setSelectedCui] = useState<number | null>(null);

  // Fetch KPI Stats
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const json = await res.json();
      if (json.success && json.data?.active_workspace) {
        setStats(json.data.active_workspace);
      }
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  };

  // Fetch Companies List
  const fetchCompanies = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        scope: 'historical',
        view,
      });

      if (query) params.set('q', query);
      if (county) params.set('county', county);
      if (crmStatus) params.set('crmStatus', crmStatus);

      if (contactFilter === 'mobile') params.set('hasMobile', 'true');
      if (contactFilter === 'landline') params.set('hasLandline', 'true');
      if (contactFilter === 'email') params.set('hasEmail', 'true');
      if (contactFilter === 'website') params.set('hasWebsite', 'true');

      const res = await fetch(`/api/companies?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.data) {
        setItems(data.data.items || []);
        const pag = data.data.pagination || {};
        setPagination({
          page: pag.page || 1,
          limit: pag.limit || 25,
          total: typeof pag.total === 'number' ? pag.total : pag.totalItems || 0,
          totalPages: pag.totalPages || 1,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchCompanies(1);
  }, [view, county, crmStatus, contactFilter]);

  const handleKpiClick = (filterKey: string, targetCrmStatus: string, targetView: 'active' | 'all' = 'active') => {
    setActiveKpiFilter(filterKey);
    setView(targetView);
    setCrmStatus(targetCrmStatus);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCompanies(1);
  };

  const handleResetFilters = () => {
    setQuery('');
    setCounty('');
    setCrmStatus('');
    setContactFilter('');
    setView('active');
    setActiveKpiFilter('all_active');
  };

  const handleExport = () => {
    const params = new URLSearchParams({ view });
    if (query) params.set('q', query);
    if (county) params.set('county', county);
    if (crmStatus) params.set('crmStatus', crmStatus);
    window.open(`/api/export?${params.toString()}`, '_blank');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-titanium-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              FIRME EXISTENTE
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-titanium-800 text-titanium-300 border border-titanium-700">
              Baza Istorică (2.908)
            </span>
          </div>
          <p className="text-xs text-titanium-400 mt-1">
            Baza istorică de companii din România. Perspectivele active eligibile pentru prospectare sunt filtrate automat.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-titanium-800 hover:bg-titanium-700 text-titanium-200 text-xs font-medium border border-titanium-700 transition-colors"
            title="Descarcă selecția curentă în format CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* TOP KPI BAR — THE 9 CANONICAL NUMBERS */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        {/* 1. Firme Active cu Contact */}
        <button
          onClick={() => handleKpiClick('all_active', '', 'active')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeKpiFilter === 'all_active'
              ? 'bg-radar-green/10 border-radar-green shadow-sm shadow-radar-green/20'
              : 'bg-titanium-900 border-titanium-800 hover:border-titanium-700'
          }`}
        >
          <div className="text-[10px] font-semibold text-titanium-400 truncate">Firme Active</div>
          <div className="text-lg font-black text-white mt-0.5">{stats.active_with_contact}</div>
          <div className="text-[9px] text-radar-green font-medium flex items-center gap-0.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-radar-green"></span>
            Cu contact
          </div>
        </button>

        {/* 2. Necontactate */}
        <button
          onClick={() => handleKpiClick('not_contacted', 'NOT_CONTACTED', 'active')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeKpiFilter === 'not_contacted'
              ? 'bg-blue-500/10 border-blue-500 shadow-sm shadow-blue-500/20'
              : 'bg-titanium-900 border-titanium-800 hover:border-titanium-700'
          }`}
        >
          <div className="text-[10px] font-semibold text-titanium-400 truncate">Necontactate</div>
          <div className="text-lg font-black text-blue-400 mt-0.5">{stats.not_contacted}</div>
          <div className="text-[9px] text-titanium-500 mt-0.5">De sunat</div>
        </button>

        {/* 3. Contactate */}
        <button
          onClick={() => handleKpiClick('contacted', 'CONTACTED', 'active')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeKpiFilter === 'contacted'
              ? 'bg-cyan-500/10 border-cyan-500 shadow-sm shadow-cyan-500/20'
              : 'bg-titanium-900 border-titanium-800 hover:border-titanium-700'
          }`}
        >
          <div className="text-[10px] font-semibold text-titanium-400 truncate">Contactate</div>
          <div className="text-lg font-black text-cyan-400 mt-0.5">{stats.contacted}</div>
          <div className="text-[9px] text-titanium-500 mt-0.5">Apel efectuat</div>
        </button>

        {/* 4. Follow-up de făcut */}
        <button
          onClick={() => handleKpiClick('followups_due', 'FOLLOWUP_DUE', 'active')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeKpiFilter === 'followups_due'
              ? 'bg-amber-500/10 border-amber-500 shadow-sm shadow-amber-500/20'
              : 'bg-titanium-900 border-titanium-800 hover:border-titanium-700'
          }`}
        >
          <div className="text-[10px] font-semibold text-titanium-400 truncate">Follow-up scadent</div>
          <div className="text-lg font-black text-amber-400 mt-0.5">{stats.followups_due}</div>
          <div className="text-[9px] text-titanium-500 mt-0.5">Scadență azi</div>
        </button>

        {/* 5. Interesate */}
        <button
          onClick={() => handleKpiClick('interested', 'INTERESTED', 'active')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeKpiFilter === 'interested'
              ? 'bg-emerald-500/10 border-emerald-500 shadow-sm shadow-emerald-500/20'
              : 'bg-titanium-900 border-titanium-800 hover:border-titanium-700'
          }`}
        >
          <div className="text-[10px] font-semibold text-titanium-400 truncate">Interesate</div>
          <div className="text-lg font-black text-emerald-400 mt-0.5">{stats.interested}</div>
          <div className="text-[9px] text-titanium-500 mt-0.5">Interes confirmat</div>
        </button>

        {/* 6. Ofertă Solicitată */}
        <button
          onClick={() => handleKpiClick('offers_requested', 'OFFER_REQUESTED', 'active')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeKpiFilter === 'offers_requested'
              ? 'bg-purple-500/10 border-purple-500 shadow-sm shadow-purple-500/20'
              : 'bg-titanium-900 border-titanium-800 hover:border-titanium-700'
          }`}
        >
          <div className="text-[10px] font-semibold text-titanium-400 truncate">Ofertă Cerută</div>
          <div className="text-lg font-black text-purple-400 mt-0.5">{stats.offers_requested}</div>
          <div className="text-[9px] text-titanium-500 mt-0.5">Cotație în lucru</div>
        </button>

        {/* 7. Ofertă Trimisă */}
        <button
          onClick={() => handleKpiClick('offers_sent', 'OFFER_SENT', 'active')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeKpiFilter === 'offers_sent'
              ? 'bg-indigo-500/10 border-indigo-500 shadow-sm shadow-indigo-500/20'
              : 'bg-titanium-900 border-titanium-800 hover:border-titanium-700'
          }`}
        >
          <div className="text-[10px] font-semibold text-titanium-400 truncate">Ofertă Trimisă</div>
          <div className="text-lg font-black text-indigo-400 mt-0.5">{stats.offers_sent}</div>
          <div className="text-[9px] text-titanium-500 mt-0.5">În negociere</div>
        </button>

        {/* 8. Clienți Câștigați */}
        <button
          onClick={() => handleKpiClick('clients_won', 'CLIENT_WON', 'active')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeKpiFilter === 'clients_won'
              ? 'bg-emerald-400/20 border-emerald-400 shadow-sm shadow-emerald-400/30'
              : 'bg-titanium-900 border-titanium-800 hover:border-titanium-700'
          }`}
        >
          <div className="text-[10px] font-semibold text-emerald-400 truncate">Clienți Câștigați</div>
          <div className="text-lg font-black text-radar-green mt-0.5">{stats.clients_won}</div>
          <div className="text-[9px] text-titanium-500 mt-0.5">Polițe emise</div>
        </button>

        {/* 9. Nu Contacta */}
        <button
          onClick={() => handleKpiClick('do_not_contact', 'DO_NOT_CONTACT', 'active')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeKpiFilter === 'do_not_contact'
              ? 'bg-rose-500/10 border-rose-500 shadow-sm shadow-rose-500/20'
              : 'bg-titanium-900 border-titanium-800 hover:border-titanium-700'
          }`}
        >
          <div className="text-[10px] font-semibold text-titanium-400 truncate">Nu Contacta</div>
          <div className="text-lg font-black text-rose-400 mt-0.5">{stats.do_not_contact}</div>
          <div className="text-[9px] text-titanium-500 mt-0.5">Supresie / Refuz</div>
        </button>
      </div>

      {/* FILTER & SEARCH PANEL */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-4 space-y-3">
        {/* Row 1: Workspace View Segments */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-titanium-800/80 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => {
                setView('active');
                setActiveKpiFilter('all_active');
                setCrmStatus('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                view === 'active'
                  ? 'bg-radar-green text-black shadow-sm font-bold'
                  : 'bg-titanium-800 hover:bg-titanium-700 text-titanium-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Perspective Active ({stats.active_with_contact})</span>
            </button>

            <button
              onClick={() => {
                setView('all');
                setActiveKpiFilter('all_history');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                view === 'all'
                  ? 'bg-titanium-100 text-black shadow-sm font-bold'
                  : 'bg-titanium-800 hover:bg-titanium-700 text-titanium-300'
              }`}
            >
              <span>Toate Istorice (2.908)</span>
            </button>

            <button
              onClick={() => {
                setView('excluded');
                setActiveKpiFilter('excluded');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                view === 'excluded'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                  : 'bg-titanium-800 hover:bg-titanium-700 text-titanium-300'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Excluse / Radiate (2.780)</span>
            </button>

            <button
              onClick={() => {
                setView('unverified');
                setActiveKpiFilter('unverified');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                view === 'unverified'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'bg-titanium-800 hover:bg-titanium-700 text-titanium-300'
              }`}
            >
              <span>Neclasificate Legal (2.390)</span>
            </button>
          </div>

          <div className="text-xs text-titanium-400 font-mono">
            Rezultate: <strong className="text-white">{pagination.total}</strong> companii
          </div>
        </div>

        {/* Row 2: Search Input & Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search by Name / CUI */}
          <form onSubmit={handleSearchSubmit} className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-titanium-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Caută după nume firmă, CUI, localitate, reg com..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-titanium-950 border border-titanium-700 rounded-lg text-xs text-white placeholder-titanium-500 focus:outline-none focus:border-radar-green"
            />
          </form>

          {/* County Filter */}
          <select
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="bg-titanium-950 border border-titanium-700 text-titanium-200 rounded-lg px-2.5 py-2 text-xs focus:border-radar-green focus:outline-none"
          >
            <option value="">Toate Județele</option>
            {['Bucureşti', 'Ilfov', 'Cluj', 'Timiş', 'Braşov', 'Constanţa', 'Iaşi', 'Prahova', 'Bihor', 'Dolj', 'Argeş', 'Sibiu'].map((jud) => (
              <option key={jud} value={jud}>{jud}</option>
            ))}
          </select>

          {/* CRM Status Filter */}
          <select
            value={crmStatus}
            onChange={(e) => setCrmStatus(e.target.value)}
            className="bg-titanium-950 border border-titanium-700 text-titanium-200 rounded-lg px-2.5 py-2 text-xs focus:border-radar-green focus:outline-none"
          >
            <option value="">Toate Etapele CRM</option>
            <option value="NOT_CONTACTED">Necontactat (De sunat)</option>
            <option value="CONTACTED">Contactat</option>
            <option value="FOLLOWUP_DUE">Follow-up Scadent</option>
            <option value="INTERESTED">Interesat</option>
            <option value="OFFER_REQUESTED">Ofertă Solicitată</option>
            <option value="OFFER_SENT">Ofertă Trimisă</option>
            <option value="CLIENT_WON">Client Câștigat</option>
            <option value="DO_NOT_CONTACT">Nu Contacta</option>
          </select>

          {/* Contact Channel Filter */}
          <select
            value={contactFilter}
            onChange={(e) => setContactFilter(e.target.value)}
            className="bg-titanium-950 border border-titanium-700 text-titanium-200 rounded-lg px-2.5 py-2 text-xs focus:border-radar-green focus:outline-none"
          >
            <option value="">Canale de Contact</option>
            <option value="mobile">Are Telefon Mobil</option>
            <option value="landline">Are Telefon Fix</option>
            <option value="email">Are Email</option>
            <option value="website">Are Website</option>
          </select>
        </div>

        {/* Row 3: Action Buttons */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-xs text-titanium-400">
            <span>Filtru activ:</span>
            <span className="font-semibold text-white">
              {view === 'active'
                ? 'Perspective Active cu contact direct valid'
                : view === 'excluded'
                ? 'Companii excluse (radiate/inactive/lipsă contact)'
                : view === 'unverified'
                ? 'Companii neclasificate legal'
                : 'Toate companiile istorice'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1 text-xs text-titanium-400 hover:text-white transition-colors"
            >
              Resetează Filtrele
            </button>
            <button
              onClick={() => fetchCompanies(1)}
              className="px-3 py-1.5 rounded-lg bg-titanium-800 hover:bg-titanium-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-titanium-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-radar-green' : ''}`} />
              <span>Actualizează</span>
            </button>
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-titanium-950 text-titanium-400 font-mono border-b border-titanium-800 uppercase text-[10px]">
              <tr>
                <th className="p-3.5">Companie &amp; CUI</th>
                <th className="p-3.5">Sediu &amp; Reg. Com</th>
                <th className="p-3.5">CAEN Principal</th>
                <th className="p-3.5">Stare Juridică &amp; Fiscală</th>
                <th className="p-3.5">Bilanț Financiar</th>
                <th className="p-3.5">Contact Direct &amp; Proveniență</th>
                <th className="p-3.5">Status CRM</th>
                <th className="p-3.5 text-right">Acțiune</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-titanium-400 font-mono">
                    Se încarcă companiile din baza de date...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center space-y-2">
                    <div className="text-titanium-400 font-medium">
                      Nicio companie găsită conform criteriilor selectate.
                    </div>
                    <button
                      onClick={handleResetFilters}
                      className="text-xs text-radar-green hover:underline"
                    >
                      Resetează filtrele și revino la perspectivele active
                    </button>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.cui}
                    onClick={() => setSelectedCui(item.cui)}
                    className="hover:bg-titanium-850/60 transition-colors cursor-pointer group"
                  >
                    {/* Companie & CUI */}
                    <td className="p-3.5">
                      <div className="font-bold text-white group-hover:text-radar-green transition-colors">
                        {item.name}
                      </div>
                      <div className="text-[11px] font-mono text-titanium-400 flex items-center gap-1.5 mt-0.5">
                        <span>CUI: <strong className="text-titanium-200">{item.cui}</strong></span>
                        <span>•</span>
                        <span>{item.legal_form || 'SRL'}</span>
                      </div>
                    </td>

                    {/* Sediu */}
                    <td className="p-3.5">
                      <div className="text-titanium-200 font-medium">{item.county || 'România'}</div>
                      <div className="text-[11px] text-titanium-400 truncate max-w-[150px]" title={item.city}>
                        {item.city || '—'}
                      </div>
                    </td>

                    {/* CAEN */}
                    <td className="p-3.5">
                      <div className="font-mono text-radar-green font-bold text-[11px]">
                        CAEN {item.primary_caen || '—'}
                      </div>
                      <div className="text-[11px] text-titanium-400 truncate max-w-[180px]" title={item.caen_description}>
                        {item.caen_description || '—'}
                      </div>
                    </td>

                    {/* Stare Juridică & Fiscală */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.legal_status === 'ACTIVE'
                              ? 'bg-emerald-400'
                              : item.legal_status === 'RADIATED'
                              ? 'bg-rose-500'
                              : 'bg-amber-400'
                          }`}
                        ></span>
                        <span className="text-xs font-semibold text-white">
                          {item.legal_status || 'ACTIV'}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-cyan-400 mt-0.5">
                        {item.fiscal_status === 'FISCALLY_ACTIVE'
                          ? 'Activ Fiscal'
                          : item.fiscal_status === 'REACTIVATED'
                          ? 'Reactivat'
                          : item.fiscal_status === 'FISCALLY_INACTIVE'
                          ? 'Inactiv Fiscal'
                          : 'Neverificat'}
                      </div>
                    </td>

                    {/* Bilanț Financiar */}
                    <td className="p-3.5">
                      {item.turnover ? (
                        <div>
                          <div className="text-white font-mono font-semibold">
                            {(item.turnover / 1000).toLocaleString('ro-RO')} mii RON
                          </div>
                          <div className="text-[10px] text-titanium-400 font-mono">
                            {item.employees_avg ?? '—'} angajați • {item.latest_financial_year || ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-titanium-500 italic">Fără bilanț</span>
                      )}
                    </td>

                    {/* Contact Direct */}
                    <td className="p-3.5">
                      {item.mobile_phone || item.landline_phone || item.sample_phone ? (
                        <div className="space-y-0.5">
                          <div className="font-mono text-emerald-400 font-bold flex items-center gap-1">
                            <Phone className="w-3 h-3 shrink-0" />
                            <span>{item.mobile_phone || item.landline_phone || item.sample_phone}</span>
                          </div>
                          <div className="text-[10px] text-titanium-500">
                            {item.mobile_status === 'MANUALLY_CONFIRMED' ? (
                              <span className="text-emerald-400 font-semibold">Confirmat CRM</span>
                            ) : item.mobile_source === 'ANAF_OPEN_DATA' ? (
                              'Declarat ANAF'
                            ) : (
                              'Public'
                            )}
                          </div>
                        </div>
                      ) : item.email_contact || item.sample_email ? (
                        <div className="font-mono text-purple-400 flex items-center gap-1">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[140px]">{item.email_contact || item.sample_email}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-titanium-500 italic">Fără contact</span>
                      )}
                    </td>

                    {/* Status CRM */}
                    <td className="p-3.5">
                      {item.crm_status === 'CONTACTED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Contactat
                        </span>
                      ) : item.crm_status === 'INTERESTED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Interesat
                        </span>
                      ) : item.crm_status === 'DO_NOT_CONTACT' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Nu Contacta
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-titanium-800 text-titanium-300">
                          Necontactat
                        </span>
                      )}
                    </td>

                    {/* Acțiune */}
                    <td className="p-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCui(item.cui);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-titanium-800 hover:bg-radar-green hover:text-black text-titanium-200 text-xs font-semibold transition-colors"
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

        {/* PAGINATION CONTROLS */}
        <div className="p-3.5 border-t border-titanium-800 bg-titanium-950 flex items-center justify-between text-xs">
          <button
            onClick={() => fetchCompanies(Math.max(1, pagination.page - 1))}
            disabled={pagination.page <= 1}
            className="px-3 py-1.5 rounded-lg bg-titanium-900 hover:bg-titanium-800 text-titanium-300 disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          <span className="font-mono text-titanium-400">
            Pagina <strong>{pagination.page}</strong> din <strong>{pagination.totalPages}</strong>
          </span>

          <button
            onClick={() => fetchCompanies(Math.min(pagination.totalPages, pagination.page + 1))}
            disabled={pagination.page >= pagination.totalPages}
            className="px-3 py-1.5 rounded-lg bg-titanium-900 hover:bg-titanium-800 text-titanium-300 disabled:opacity-40 flex items-center gap-1"
          >
            <span>Următor</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* UNIFIED COMPANY DETAIL DRAWER (SECTIONS A - F) */}
      <CompanyProfileDrawer
        cui={selectedCui}
        onClose={() => setSelectedCui(null)}
        onRecordUpdated={() => {
          fetchCompanies(pagination.page);
          fetchStats();
        }}
      />
    </div>
  );
}

export default function CompaniesPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-titanium-400 font-mono">Încărcare Firme...</div>}>
      <CompaniesContent />
    </Suspense>
  );
}
