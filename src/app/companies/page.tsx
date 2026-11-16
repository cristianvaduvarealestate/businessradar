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
  Layers,
  Sparkles,
  CheckCircle2,
  PhoneOutgoing,
} from 'lucide-react';

interface CompanyItem {
  id: number;
  cui: number;
  name: string;
  normalized_name?: string;
  reg_com?: string;
  legal_form?: string;
  incorporation_date?: string;
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

  // Drawer / Modal Detail State
  const [selectedCui, setSelectedCui] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Quick CRM Logging form inside Drawer
  const [interactionOutcome, setInteractionOutcome] = useState('REACHED_DECISION_MAKER');
  const [interactionNotes, setInteractionNotes] = useState('');
  const [interactionContactPerson, setInteractionContactPerson] = useState('');
  const [interactionContactValue, setInteractionContactValue] = useState('');
  const [interactionVerifyContact, setInteractionVerifyContact] = useState(false);
  const [interactionFollowUpDate, setInteractionFollowUpDate] = useState('');
  const [interactionFollowUpTitle, setInteractionFollowUpTitle] = useState('');
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [interactionSuccess, setInteractionSuccess] = useState(false);

  // Live ANAF Check State
  const [verifyingLive, setVerifyingLive] = useState(false);
  const [liveCheckResult, setLiveCheckResult] = useState<{ success: boolean; message: string } | null>(null);

  // Handle Live ANAF check
  const handleLiveAnafCheck = async (cui: number) => {
    setVerifyingLive(true);
    setLiveCheckResult(null);
    try {
      const res = await fetch(`/api/companies/${cui}/verify`, { method: 'POST' });
      const json = await res.json();
      if (json.success && json.data) {
        setLiveCheckResult({
          success: true,
          message: `Verificare live ANAF v9 reușită: Stare fiscală ${json.data.fiscal_status || 'ACTIVĂ'}, TVA ${json.data.ro_e_factura ? 'e-Factura DA' : 'Standard'}`,
        });
        // Refresh detail view
        const refreshed = await fetch(`/api/companies/${cui}`);
        const refJson = await refreshed.json();
        if (refJson.success && refJson.data) {
          setDetailData(refJson.data);
        }
        fetchCompanies(pagination.page);
        fetchStats();
      } else {
        setLiveCheckResult({
          success: false,
          message: `Eroare verificare live ANAF: ${json.error || 'Serviciu temporar indisponibil'}`,
        });
      }
    } catch (err: any) {
      setLiveCheckResult({
        success: false,
        message: `Eroare rețea verificare live ANAF: ${err.message}`,
      });
    } finally {
      setVerifyingLive(false);
    }
  };

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
          total: typeof pag.total === 'number' ? pag.total : (pag.totalItems || 0),
          totalPages: pag.totalPages || 1,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and filter reaction
  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchCompanies(1);
  }, [view, county, crmStatus, contactFilter]);

  // Handle KPI Click Filter
  const handleKpiClick = (filterKey: string, targetCrmStatus: string, targetView: 'active' | 'all' = 'active') => {
    setActiveKpiFilter(filterKey);
    setView(targetView);
    setCrmStatus(targetCrmStatus);
  };

  // Handle Search Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCompanies(1);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setQuery('');
    setCounty('');
    setCrmStatus('');
    setContactFilter('');
    setView('active');
    setActiveKpiFilter('all_active');
  };

  // Open Company Drawer
  const handleOpenDrawer = async (cui: number) => {
    setSelectedCui(cui);
    setDetailLoading(true);
    setInteractionSuccess(false);
    setInteractionNotes('');
    setInteractionFollowUpDate('');
    setInteractionFollowUpTitle('');
    setInteractionContactPerson('Administrator');
    setInteractionVerifyContact(false);
    try {
      const res = await fetch(`/api/companies/${cui}`);
      const json = await res.json();
      if (json.success && json.data) {
        setDetailData(json.data);
        const firstPhone = json.data.contacts?.find((c: any) => c.contact_type === 'MOBILE' || c.contact_type === 'LANDLINE')?.contact_value || '';
        setInteractionContactValue(firstPhone);
      }
    } catch (err) {
      console.error('Error fetching company details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Close Drawer
  const handleCloseDrawer = () => {
    setSelectedCui(null);
    setDetailData(null);
  };

  // Copy to clipboard helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Quick Save CRM Interaction
  const handleSaveInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCui) return;
    setSavingInteraction(true);
    try {
      const payload: any = {
        cui: selectedCui,
        interaction_type: 'CALL_OUTGOING',
        outcome: interactionOutcome,
        notes: interactionNotes,
        contact_person: interactionContactPerson || 'Decident',
        contact_value: interactionContactValue || null,
        verify_contact: interactionVerifyContact,
      };
      if (interactionFollowUpDate) {
        payload.next_follow_up_date = interactionFollowUpDate;
        payload.next_action = interactionFollowUpTitle || 'Follow-up telefonic';
      }

      const res = await fetch('/api/crm/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resData = await res.json();
      if (resData.success) {
        setInteractionSuccess(true);
        // Refresh detail view
        const refreshedRes = await fetch(`/api/companies/${selectedCui}`);
        const refreshedJson = await refreshedRes.json();
        if (refreshedJson.success && refreshedJson.data) {
          setDetailData(refreshedJson.data);
        }
        // Refresh list and stats in background
        fetchCompanies(pagination.page);
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to log interaction:', err);
    } finally {
      setSavingInteraction(false);
    }
  };

  // Handle Export CSV
  const handleExport = () => {
    const params = new URLSearchParams();
    params.set('view', view);
    if (county) params.set('county', county);
    if (crmStatus) params.set('status', crmStatus);
    window.location.href = `/api/export?${params.toString()}`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-titanium-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-radar-green" />
              FIRME
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-radar-green/10 text-radar-green border border-radar-green/30">
              Workspace Unificat
            </span>
            {view === 'active' && (
              <span className="text-xs text-titanium-400 font-medium">
                ({stats.active_with_contact} companii active cu contact)
              </span>
            )}
          </div>
          <p className="text-xs text-titanium-400 mt-1">
            Workspace unic de prospectare, verificare și calificare vânzări asigurări pentru firme active din România.
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
          <div className="text-[9px] text-titanium-500 mt-0.5">Calificate</div>
        </button>

        {/* 6. Oferte solicitate */}
        <button
          onClick={() => handleKpiClick('offers_requested', 'OFFER_REQUESTED', 'active')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeKpiFilter === 'offers_requested'
              ? 'bg-purple-500/10 border-purple-500 shadow-sm shadow-purple-500/20'
              : 'bg-titanium-900 border-titanium-800 hover:border-titanium-700'
          }`}
        >
          <div className="text-[10px] font-semibold text-titanium-400 truncate">Oferte cerute</div>
          <div className="text-lg font-black text-purple-400 mt-0.5">{stats.offers_requested}</div>
          <div className="text-[9px] text-titanium-500 mt-0.5">În calculare</div>
        </button>

        {/* 7. Oferte trimise */}
        <button
          onClick={() => handleKpiClick('offers_sent', 'OFFER_SENT', 'active')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeKpiFilter === 'offers_sent'
              ? 'bg-violet-500/10 border-violet-500 shadow-sm shadow-violet-500/20'
              : 'bg-titanium-900 border-titanium-800 hover:border-titanium-700'
          }`}
        >
          <div className="text-[10px] font-semibold text-titanium-400 truncate">Oferte trimise</div>
          <div className="text-lg font-black text-violet-400 mt-0.5">{stats.offers_sent}</div>
          <div className="text-[9px] text-titanium-500 mt-0.5">În negociere</div>
        </button>

        {/* 8. Clienți câștigați */}
        <button
          onClick={() => handleKpiClick('clients_won', 'CLIENT_WON', 'active')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeKpiFilter === 'clients_won'
              ? 'bg-emerald-500/20 border-emerald-400 shadow-sm shadow-emerald-400/20'
              : 'bg-titanium-900 border-titanium-800 hover:border-titanium-700'
          }`}
        >
          <div className="text-[10px] font-semibold text-titanium-400 truncate">Clienți</div>
          <div className="text-lg font-black text-emerald-300 mt-0.5">{stats.clients_won}</div>
          <div className="text-[9px] text-titanium-500 mt-0.5">Contractat</div>
        </button>

        {/* 9. Nu contacta / Suprimate */}
        <button
          onClick={() => handleKpiClick('do_not_contact', 'DO_NOT_CONTACT', 'active')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeKpiFilter === 'do_not_contact'
              ? 'bg-rose-500/10 border-rose-500 shadow-sm shadow-rose-500/20'
              : 'bg-titanium-900 border-titanium-800 hover:border-titanium-700'
          }`}
        >
          <div className="text-[10px] font-semibold text-titanium-400 truncate">Nu contacta</div>
          <div className="text-lg font-black text-rose-400 mt-0.5">{stats.do_not_contact}</div>
          <div className="text-[9px] text-titanium-500 mt-0.5">Suprimate</div>
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-3 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-titanium-400" />
            <input
              type="text"
              placeholder="Caută după nume firmă, CUI (ex: 412052) sau Reg. Com..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-titanium-950 border border-titanium-800 rounded-lg pl-9 pr-4 py-2 text-xs text-titanium-100 placeholder-titanium-500 focus:outline-none focus:border-radar-green transition-colors"
            />
          </form>

          {/* View Mode Selector */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-titanium-400 font-medium">Bază:</span>
            <select
              value={view}
              onChange={(e) => {
                setView(e.target.value as any);
                setActiveKpiFilter('custom');
              }}
              className="bg-titanium-950 border border-titanium-800 text-titanium-200 px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none focus:border-radar-green"
            >
              <option value="active">Firme Active cu Contact (128)</option>
              <option value="all">Toată Baza Istorică (2.908)</option>
              <option value="excluded">Excluse / Inactive (376)</option>
              <option value="unverified">Neverificate ONRC (2.390)</option>
            </select>
          </div>
        </div>

        {/* Secondary filters row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-titanium-800/60 text-xs">
          {/* County */}
          <select
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="bg-titanium-950 border border-titanium-800 text-titanium-300 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-radar-green"
          >
            <option value="">Toate Județele</option>
            <option value="Bucuresti">București</option>
            <option value="Ilfov">Ilfov</option>
            <option value="Cluj">Cluj</option>
            <option value="Timis">Timiș</option>
            <option value="Iasi">Iași</option>
            <option value="Brasov">Brașov</option>
            <option value="Constanta">Constanța</option>
            <option value="Prahova">Prahova</option>
            <option value="Arges">Argeș</option>
            <option value="Bihor">Bihor</option>
          </select>

          {/* CRM Status */}
          <select
            value={crmStatus}
            onChange={(e) => {
              setCrmStatus(e.target.value);
              setActiveKpiFilter('custom');
            }}
            className="bg-titanium-950 border border-titanium-800 text-titanium-300 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-radar-green"
          >
            <option value="">Toate Etapele CRM</option>
            <option value="NOT_CONTACTED">Necontactate (127)</option>
            <option value="CONTACTED">Contactate (1)</option>
            <option value="FOLLOWUP_DUE">Follow-up scadent</option>
            <option value="INTERESTED">Interesate</option>
            <option value="OFFER_REQUESTED">Ofertă solicitată</option>
            <option value="OFFER_SENT">Ofertă trimisă</option>
            <option value="CLIENT_WON">Client câștigat</option>
            <option value="DO_NOT_CONTACT">Nu contacta</option>
          </select>

          {/* Contact Type Filter */}
          <select
            value={contactFilter}
            onChange={(e) => setContactFilter(e.target.value)}
            className="bg-titanium-950 border border-titanium-800 text-titanium-300 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-radar-green"
          >
            <option value="">Toate Contactele</option>
            <option value="mobile">Doar cu Telefon Mobil</option>
            <option value="landline">Doar cu Telefon Fix</option>
            <option value="email">Doar cu Email</option>
            <option value="website">Doar cu Website</option>
          </select>

          {/* Active filters indicators & Reset */}
          {(county || crmStatus || contactFilter || query || view !== 'active') && (
            <button
              onClick={handleResetFilters}
              className="text-titanium-400 hover:text-white flex items-center gap-1 ml-auto text-xs font-medium px-2 py-1 rounded bg-titanium-800 hover:bg-titanium-700 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Resetează la Firme Active (128)
            </button>
          )}
        </div>
      </div>

      {/* FIRME DATA TABLE */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-titanium-800 bg-titanium-950/70 text-titanium-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="p-3.5">Companie & CUI</th>
                <th className="p-3.5">Activitate (CAEN)</th>
                <th className="p-3.5">Contacte Verificate</th>
                <th className="p-3.5">Calificare Comercială</th>
                <th className="p-3.5">Stare CRM & Follow-up</th>
                <th className="p-3.5 text-center">Acțiune</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-titanium-500 font-mono">
                    Se încarcă lista companiilor...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-titanium-400">
                    <p className="font-semibold text-sm text-titanium-300">Nicio companie găsită.</p>
                    <p className="text-xs text-titanium-500 mt-1">
                      Ajustează filtrele sau revino la selecția implicită de firme active.
                    </p>
                    <button
                      onClick={handleResetFilters}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-titanium-800 text-radar-green border border-titanium-700 text-xs font-semibold"
                    >
                      Resetează filtrele
                    </button>
                  </td>
                </tr>
              ) : (
                items.map((company) => {
                  const isLegallyActive = company.legal_status === 'ACTIVE';
                  const isFiscallyActive = company.fiscal_status === 'FISCALLY_ACTIVE' || company.fiscal_status === 'REACTIVATED';
                  const crmStageLabel = company.crm_status || (company.last_interaction_outcome ? 'CONTACTAT' : 'NECONTACTAT');

                  return (
                    <tr
                      key={company.id}
                      onClick={() => handleOpenDrawer(company.cui)}
                      className="hover:bg-titanium-850/80 transition-colors cursor-pointer group"
                    >
                      {/* 1. Companie & CUI */}
                      <td className="p-3.5">
                        <div className="font-bold text-sm text-titanium-100 group-hover:text-radar-green transition-colors flex items-center gap-1.5">
                          {company.name}
                        </div>
                        <div className="text-titanium-400 text-xs mt-0.5 flex items-center gap-2 font-mono">
                          <span>CUI: <strong className="text-titanium-200">{company.cui}</strong></span>
                          <span>•</span>
                          <span className="text-titanium-400">{company.county || 'România'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                              isLegallyActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {company.legal_status || 'ACTIV'}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                              isFiscallyActive
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {isFiscallyActive ? 'ANAF ACTIV' : company.fiscal_status || 'INACTIV'}
                          </span>
                        </div>
                      </td>

                      {/* 2. CAEN & Activitate */}
                      <td className="p-3.5 max-w-xs">
                        <div className="font-mono text-radar-green font-bold text-xs flex items-center gap-1">
                          CAEN {company.primary_caen || '—'}
                        </div>
                        <div className="text-titanium-300 truncate text-[11px] mt-0.5" title={company.caen_description}>
                          {company.caen_description || 'Descriere nespecificată'}
                        </div>
                      </td>

                      {/* 3. Contacte Verificate */}
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1">
                          {company.mobile_phone || company.sample_phone ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-emerald-400 flex items-center gap-1 font-mono font-medium text-xs">
                                <Phone className="w-3 h-3 text-emerald-400" />
                                {company.mobile_phone || company.sample_phone}
                              </span>
                              <span className="text-[9px] px-1 py-0.2 rounded bg-titanium-800 text-titanium-400 font-mono">
                                {company.mobile_source === 'ANAF_OPEN_DATA' ? 'ANAF' : company.mobile_source || 'PUBLIC'}
                              </span>
                            </div>
                          ) : null}

                          {company.email_contact || company.sample_email ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-purple-400 flex items-center gap-1 font-mono text-[11px]">
                                <Mail className="w-3 h-3 text-purple-400" />
                                {company.email_contact || company.sample_email}
                              </span>
                            </div>
                          ) : null}

                          {company.website ? (
                            <div className="flex items-center gap-1">
                              <Globe className="w-3 h-3 text-blue-400" />
                              <span className="text-blue-400 text-[11px] truncate max-w-[150px]">
                                {company.website.replace(/^https?:\/\//, '')}
                              </span>
                            </div>
                          ) : null}

                          {!company.sample_phone && !company.mobile_phone && !company.sample_email && !company.website && (
                            <span className="text-titanium-600 text-[11px] italic">Inexistent în datele disponibile</span>
                          )}
                        </div>
                      </td>

                      {/* 4. Calificare Comercială */}
                      <td className="p-3.5">
                        {company.turnover || company.latest_financial_year ? (
                          <div>
                            <div className="font-mono text-titanium-100 font-bold text-xs">
                              {company.turnover ? `${(company.turnover / 1000).toLocaleString('ro-RO')} mii RON` : 'Declarat 0'}
                            </div>
                            <div className="text-[10px] text-titanium-400 mt-0.5">
                              <span>Bilanț {company.latest_financial_year || '—'}</span>
                              {company.employees_avg !== undefined && (
                                <span> • {company.employees_avg} angajați</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-titanium-500 italic">
                            Inexistent în datele disponibile
                          </div>
                        )}
                      </td>

                      {/* 5. Stare CRM & Follow-up */}
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border w-fit ${
                              crmStageLabel === 'CLIENT_WON'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : crmStageLabel === 'INTERESTED'
                                ? 'bg-radar-green/20 text-radar-green border-radar-green/30'
                                : crmStageLabel === 'CONTACTED'
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                                : 'bg-titanium-800 text-titanium-400 border-titanium-700'
                            }`}
                          >
                            {crmStageLabel}
                          </span>

                          {company.next_follow_up_date ? (
                            <div className="flex items-center gap-1 text-[10px] text-amber-400 font-mono mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>{company.next_follow_up_date}</span>
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* 6. Acțiune */}
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenDrawer(company.cui)}
                          className="px-2.5 py-1.5 rounded-lg bg-titanium-800 hover:bg-radar-green/20 hover:text-radar-green text-titanium-300 text-xs font-semibold border border-titanium-700 transition-all flex items-center gap-1 mx-auto"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Deschide</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-titanium-800 bg-titanium-950/60 flex items-center justify-between text-xs text-titanium-400">
          <div>
            Afișate <strong>{items.length}</strong> din <strong>{pagination.total}</strong> companii
            {view === 'active' && ' active eligibile'}
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchCompanies(pagination.page - 1)}
              className="p-1.5 rounded-md bg-titanium-800 hover:bg-titanium-700 disabled:opacity-30 disabled:cursor-not-allowed text-titanium-200"
              title="Pagina precedentă"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchCompanies(pagination.page + 1)}
              className="p-1.5 rounded-md bg-titanium-800 hover:bg-titanium-700 disabled:opacity-30 disabled:cursor-not-allowed text-titanium-200"
              title="Pagina următoare"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* UNIFIED COMPANY DETAIL DRAWER (SECTIONS A - F) */}
      {selectedCui !== null && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex justify-end">
          <div
            className="w-full max-w-2xl bg-titanium-900 border-l border-titanium-700 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-titanium-800 flex items-start justify-between bg-titanium-950/80">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white">
                    {detailData?.company?.name || `CUI ${selectedCui}`}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-titanium-400 mt-1 font-mono">
                  <span>CUI: <strong className="text-white">{selectedCui}</strong></span>
                  <span>•</span>
                  <span>{detailData?.company?.legal_form || 'SRL'}</span>
                  <span>•</span>
                  <span>{detailData?.company?.county}, {detailData?.company?.city}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/companies/${selectedCui}`}
                  className="p-1.5 rounded-lg bg-titanium-800 hover:bg-titanium-700 text-titanium-300 hover:text-white text-xs flex items-center gap-1 border border-titanium-700 transition-colors"
                  title="Deschide în pagină completă separată"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">Pagină completă</span>
                </Link>
                <button
                  onClick={handleCloseDrawer}
                  className="p-1.5 rounded-lg bg-titanium-800 hover:bg-rose-500/20 hover:text-rose-400 text-titanium-400 transition-colors"
                  title="Închide"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {detailLoading ? (
                <div className="p-12 text-center text-titanium-400 font-mono">
                  Se încarcă datele firmei...
                </div>
              ) : !detailData?.company ? (
                <div className="p-12 text-center text-rose-400">
                  Nu s-au putut încărca detaliile companiei.
                </div>
              ) : (
                <>
                  {/* QUICK ACTION BAR */}
                  <div className="bg-titanium-950 border border-titanium-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {detailData.contacts?.find((c: any) => c.contact_type === 'MOBILE' || c.contact_type === 'LANDLINE') ? (
                        (() => {
                          const mainPhone = detailData.contacts.find((c: any) => c.contact_type === 'MOBILE' || c.contact_type === 'LANDLINE').contact_value;
                          return (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`tel:${mainPhone}`}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                                <span>Sună {mainPhone}</span>
                              </a>
                              <button
                                onClick={() => handleCopy(mainPhone, 'phone')}
                                className="p-1.5 rounded-lg bg-titanium-800 hover:bg-titanium-700 text-titanium-400 hover:text-white text-xs border border-titanium-700"
                                title="Copiază numărul de telefon"
                              >
                                {copiedKey === 'phone' ? <Check className="w-3.5 h-3.5 text-radar-green" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-xs text-titanium-500 italic">Fără telefon înregistrat</span>
                      )}

                      {detailData.contacts?.find((c: any) => c.contact_type === 'EMAIL') && (
                        (() => {
                          const mainEmail = detailData.contacts.find((c: any) => c.contact_type === 'EMAIL').contact_value;
                          return (
                            <a
                              href={`mailto:${mainEmail}`}
                              className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Email</span>
                            </a>
                          );
                        })()
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-[11px] text-titanium-300 font-mono bg-titanium-900 px-2.5 py-1 rounded-lg border border-titanium-800 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>Ultima verificare:</span>
                        <strong className="text-white">
                          {detailData.company.last_status_check_at ? new Date(detailData.company.last_status_check_at).toLocaleDateString('ro-RO') : 'Evidență stocată'}
                        </strong>
                      </div>
                      <button
                        onClick={() => handleLiveAnafCheck(detailData.company.cui)}
                        disabled={verifyingLive}
                        className="px-2.5 py-1 rounded-lg bg-titanium-800 hover:bg-radar-green/20 hover:text-radar-green text-titanium-300 text-[11px] font-semibold border border-titanium-700 transition-colors flex items-center gap-1.5"
                        title="Interoghează în timp real serverul REST ANAF v9"
                      >
                        <RefreshCw className={`w-3 h-3 ${verifyingLive ? 'animate-spin text-radar-green' : ''}`} />
                        <span>{verifyingLive ? 'Interogare live...' : 'Verifică live ANAF'}</span>
                      </button>
                    </div>
                  </div>

                  {liveCheckResult && (
                    <div
                      className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
                        liveCheckResult.success
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      <span>{liveCheckResult.message}</span>
                      <button
                        onClick={() => setLiveCheckResult(null)}
                        className="text-titanium-400 hover:text-white text-xs ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* SECȚIUNEA A — DATE DE BAZĂ ALE FIRMEI */}
                  <div className="bg-titanium-950/60 border border-titanium-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-titanium-800/80 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-titanium-300 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-radar-green" />
                        Secțiunea A — Date de Bază ale Firmei
                      </h3>
                      <span className="text-[10px] text-titanium-500 font-mono">
                        {detailData.company.incorporation_date ? `Înființată: ${detailData.company.incorporation_date}` : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-[10px] text-titanium-500">Stare Legală ONRC (Evidență)</div>
                        <div className="font-bold text-emerald-400 mt-0.5">
                          {detailData.company.legal_status || 'ACTIV'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-titanium-500">Stare Fiscală ANAF (Evidență)</div>
                        <div className="font-bold text-cyan-400 mt-0.5">
                          {detailData.company.fiscal_status || 'FISCALLY_ACTIVE'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-titanium-500">Număr Reg. Comerțului</div>
                        <div className="font-mono text-titanium-200 mt-0.5">
                          {detailData.company.reg_com || 'Nespecificat'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-titanium-500">Sediu Social</div>
                        <div className="text-titanium-200 mt-0.5">
                          {detailData.company.city}, {detailData.company.county}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-titanium-800/60">
                      <div className="text-[10px] text-titanium-500">Activitate Principală (CAEN)</div>
                      <div className="text-xs font-semibold text-radar-green mt-0.5 font-mono">
                        CAEN {detailData.company.primary_caen}: {detailData.company.caen_description}
                      </div>
                    </div>
                  </div>

                  {/* SECȚIUNEA B — CANALE DE CONTACT & PROVENIENȚĂ */}
                  <div className="bg-titanium-950/60 border border-titanium-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-titanium-800/80 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-titanium-300 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-emerald-400" />
                        Secțiunea B — Canale de Contact &amp; Proveniență
                      </h3>
                      <span className="text-[10px] text-titanium-400 font-mono">
                        {detailData.contacts?.length || 0} canale
                      </span>
                    </div>

                    {detailData.contacts && detailData.contacts.length > 0 ? (
                      <div className="space-y-2">
                        {detailData.contacts.map((c: any) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-titanium-900 border border-titanium-800 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              {c.contact_type === 'MOBILE' ? (
                                <Smartphone className="w-4 h-4 text-emerald-400" />
                              ) : c.contact_type === 'EMAIL' ? (
                                <Mail className="w-4 h-4 text-purple-400" />
                              ) : c.contact_type === 'WEBSITE' ? (
                                <Globe className="w-4 h-4 text-blue-400" />
                              ) : (
                                <Phone className="w-4 h-4 text-cyan-400" />
                              )}
                              <div>
                                <div className="font-mono font-bold text-white flex items-center gap-2">
                                  <span>{c.contact_value}</span>
                                  <button
                                    onClick={() => handleCopy(c.contact_value, `c-${c.id}`)}
                                    className="text-titanium-500 hover:text-white"
                                  >
                                    {copiedKey === `c-${c.id}` ? (
                                      <Check className="w-3 h-3 text-radar-green" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                                <div className="text-[10px] text-titanium-400 flex items-center gap-2 mt-0.5">
                                  <span>Sursă: <strong>{c.source_name === 'ANAF_OPEN_DATA' ? 'ANAF Open Data' : c.source_name === 'OFFICIAL_WEBSITE' ? 'Website Oficial' : c.source_name || 'Public'}</strong></span>
                                  <span>•</span>
                                  {c.verification_status === 'MANUALLY_CONFIRMED' ? (
                                    <span className="text-emerald-400 font-semibold">Confirmat manual (Apel CRM)</span>
                                  ) : c.verification_status === 'DECLARED_BY_COMPANY' ? (
                                    <span className="text-cyan-400 font-medium">Declarat de companie (Nediscutat)</span>
                                  ) : c.verification_status === 'OFFICIAL_WEBSITE' ? (
                                    <span className="text-purple-400 font-medium">Publicat pe website oficial</span>
                                  ) : (
                                    <span className="text-titanium-400">{c.verification_status || 'Format valid'}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div>
                              {c.contact_type === 'MOBILE' || c.contact_type === 'LANDLINE' ? (
                                <a
                                  href={`tel:${c.contact_value}`}
                                  className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[11px] font-semibold border border-emerald-500/30"
                                >
                                  Apelează
                                </a>
                              ) : c.contact_type === 'EMAIL' ? (
                                <a
                                  href={`mailto:${c.contact_value}`}
                                  className="px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[11px] font-semibold border border-purple-500/30"
                                >
                                  Trimite
                                </a>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-titanium-500 italic p-3 text-center">
                        Niciun contact găsit în datele publice disponibile.
                      </div>
                    )}
                  </div>

                  {/* SECȚIUNEA C — CALIFICARE COMERCIALĂ */}
                  <div className="bg-titanium-950/60 border border-titanium-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-titanium-800/80 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-titanium-300 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                        Secțiunea C — Calificare Comercială &amp; Bilanț
                      </h3>
                      <span className="text-[10px] text-titanium-400 font-mono">
                        {detailData.company.latest_financial_year ? `An raportare: ${detailData.company.latest_financial_year}` : 'Fără bilanț depus'}
                      </span>
                    </div>

                    {detailData.company.latest_financial_year || detailData.company.turnover ? (
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="p-2.5 rounded-lg bg-titanium-900 border border-titanium-800">
                          <div className="text-[10px] text-titanium-500">Cifră de Afaceri</div>
                          <div className="text-sm font-black font-mono text-white mt-0.5">
                            {detailData.company.turnover ? `${(detailData.company.turnover / 1000).toLocaleString('ro-RO')} mii RON` : '0'}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-titanium-900 border border-titanium-800">
                          <div className="text-[10px] text-titanium-500">Angajați Medii</div>
                          <div className="text-sm font-black font-mono text-cyan-400 mt-0.5">
                            {detailData.company.employees_avg ?? '—'}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-titanium-900 border border-titanium-800">
                          <div className="text-[10px] text-titanium-500">Profit Net</div>
                          <div className="text-sm font-black font-mono text-emerald-400 mt-0.5">
                            {detailData.company.net_profit ? `${(detailData.company.net_profit / 1000).toLocaleString('ro-RO')} mii RON` : '—'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-titanium-900/50 border border-titanium-800 text-xs text-titanium-400 italic">
                        Inexistent în datele disponibile (firmă nouă sau fără bilanț public depus la Ministerul Finanțelor).
                      </div>
                    )}
                  </div>

                  {/* SECȚIUNEA D — CALIFICARE ASIGURARE (CRISTIAN INTEL) */}
                  <div className="bg-titanium-950/60 border border-titanium-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-titanium-800/80 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-titanium-300 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-radar-green" />
                        Secțiunea D — Calificare Asigurare (Ghid Apel)
                      </h3>
                      <span className="text-[10px] text-radar-green font-mono">
                        CAEN {detailData.company.primary_caen}
                      </span>
                    </div>

                    {/* Întrebări de calificare telefonică */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-titanium-300">
                        Întrebări cheie pentru apelul cu decidentul:
                      </div>
                      <div className="space-y-1.5 text-xs text-titanium-300">
                        <div className="p-2 rounded bg-titanium-900 border border-titanium-800 flex items-start gap-2">
                          <span className="text-radar-green font-bold">1.</span>
                          <span>Dețineți o flotă de vehicule sau echipamente speciale utilizate în activitatea curentă?</span>
                        </div>
                        <div className="p-2 rounded bg-titanium-900 border border-titanium-800 flex items-start gap-2">
                          <span className="text-radar-green font-bold">2.</span>
                          <span>Spațiul de lucru/depozitul este în proprietate sau în chirie, și aveți acoperire pentru bunuri și răspundere civilă față de terți?</span>
                        </div>
                        <div className="p-2 rounded bg-titanium-900 border border-titanium-800 flex items-start gap-2">
                          <span className="text-radar-green font-bold">3.</span>
                          <span>Când aveți scadența polițelor existente pentru a vă pregăti o ofertă comparativă optimizată?</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECȚIUNEA E — ISTORIC CRM */}
                  <div className="bg-titanium-950/60 border border-titanium-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-titanium-800/80 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-titanium-300 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400" />
                        Secțiunea E — Istoric CRM &amp; Notițe
                      </h3>
                      <span className="text-[10px] text-titanium-400 font-mono">
                        {detailData.interactions?.length || 0} interacțiuni
                      </span>
                    </div>

                    {detailData.interactions && detailData.interactions.length > 0 ? (
                      <div className="space-y-2">
                        {detailData.interactions.map((it: any) => (
                          <div
                            key={it.id}
                            className="p-3 rounded-lg bg-titanium-900 border border-titanium-800 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-xs">
                                {it.outcome || it.interaction_type}
                              </span>
                              <span className="text-[10px] text-titanium-500 font-mono">
                                {new Date(it.created_at).toLocaleString('ro-RO')}
                              </span>
                            </div>
                            {it.notes && (
                              <p className="text-titanium-300 text-xs mt-1">
                                {it.notes}
                              </p>
                            )}
                            <div className="text-[10px] text-titanium-500 flex items-center gap-2 pt-1">
                              <span>Agent: {it.agent_id || 'Cristian'}</span>
                              {it.next_follow_up_date && (
                                <span className="text-amber-400">
                                  • Follow-up: {it.next_follow_up_date}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-titanium-500 italic p-3 text-center">
                        Nicio interacțiune înregistrată încă. Înregistrează primul apel mai jos.
                      </div>
                    )}
                  </div>

                  {/* SECȚIUNEA F — ÎNREGISTRARE INTERACȚIUNE & FOLLOW-UP */}
                  <form
                    onSubmit={handleSaveInteraction}
                    className="bg-titanium-950 border border-radar-green/30 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-titanium-800 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-radar-green flex items-center gap-2">
                        <PhoneOutgoing className="w-4 h-4" />
                        Secțiunea F — Înregistrează Apel &amp; Programează Follow-up
                      </h3>
                      {interactionSuccess && (
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Salvat cu succes!
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                          Rezultat Apel
                        </label>
                        <select
                          value={interactionOutcome}
                          onChange={(e) => setInteractionOutcome(e.target.value)}
                          className="w-full bg-titanium-900 border border-titanium-700 text-white rounded-lg p-2 focus:border-radar-green focus:outline-none"
                        >
                          <option value="REACHED_DECISION_MAKER">Contactat Decident (Discuție utilă)</option>
                          <option value="INTERESTED">Interesat (Dorește discuție/ofertă)</option>
                          <option value="OFFER_REQUESTED">A solicitat Ofertă</option>
                          <option value="CALLBACK_REQUESTED">A cerut să revenim</option>
                          <option value="NO_ANSWER">Nu a răspuns</option>
                          <option value="NOT_INTERESTED">Nu este interesat</option>
                          <option value="WRONG_NUMBER">Număr greșit / Eronat</option>
                          <option value="DO_NOT_CONTACT">Nu contacta (Adaugă la supresie)</option>
                          <option value="CLIENT_WON">Client Câștigat</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                            Persoană Discutată
                          </label>
                          <input
                            type="text"
                            placeholder="ex: Andrei M. (Administrator)"
                            value={interactionContactPerson}
                            onChange={(e) => setInteractionContactPerson(e.target.value)}
                            className="w-full bg-titanium-900 border border-titanium-700 text-white rounded-lg p-1.5 text-xs focus:border-radar-green focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                            Canal Utilizat
                          </label>
                          <input
                            type="text"
                            placeholder="ex: +40744270546"
                            value={interactionContactValue}
                            onChange={(e) => setInteractionContactValue(e.target.value)}
                            className="w-full bg-titanium-900 border border-titanium-700 text-white rounded-lg p-1.5 text-xs focus:border-radar-green focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-0.5">
                        <input
                          type="checkbox"
                          id="verifyContactCheck"
                          checked={interactionVerifyContact}
                          onChange={(e) => setInteractionVerifyContact(e.target.checked)}
                          className="rounded border-titanium-700 text-radar-green focus:ring-0 focus:outline-none bg-titanium-900"
                        />
                        <label htmlFor="verifyContactCheck" className="text-[11px] text-titanium-300 cursor-pointer">
                          Confirmă acest număr ca <strong>validat manual</strong> prin apelul efectuat
                        </label>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                          Notițe Apel
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Notează detalii despre discuție, parcul auto, nevoile de asigurare..."
                          value={interactionNotes}
                          onChange={(e) => setInteractionNotes(e.target.value)}
                          className="w-full bg-titanium-900 border border-titanium-700 text-white rounded-lg p-2 text-xs focus:border-radar-green focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                            Dată Următor Follow-up
                          </label>
                          <input
                            type="date"
                            value={interactionFollowUpDate}
                            onChange={(e) => setInteractionFollowUpDate(e.target.value)}
                            className="w-full bg-titanium-900 border border-titanium-700 text-white rounded-lg p-1.5 text-xs focus:border-radar-green focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                            Acțiune Planificată
                          </label>
                          <input
                            type="text"
                            placeholder="ex: Trimitere cotație CASCO"
                            value={interactionFollowUpTitle}
                            onChange={(e) => setInteractionFollowUpTitle(e.target.value)}
                            className="w-full bg-titanium-900 border border-titanium-700 text-white rounded-lg p-1.5 text-xs focus:border-radar-green focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={savingInteraction}
                        className="w-full py-2.5 rounded-lg bg-radar-green hover:bg-radar-emerald text-titanium-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{savingInteraction ? 'Se salvează...' : 'Salvează Interacțiunea & Actualizează'}</span>
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompaniesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-titanium-500 font-mono text-center">Se încarcă workspace FIRME...</div>}>
      <CompaniesContent />
    </Suspense>
  );
}
