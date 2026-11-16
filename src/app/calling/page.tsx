'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  PhoneCall,
  Phone,
  Smartphone,
  Mail,
  Globe,
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  User,
  MessageSquare,
  Sparkles,
  AlertOctagon,
  RefreshCw,
  Plus,
  X,
  FileSpreadsheet,
} from 'lucide-react';

const OUTCOMES = [
  { id: 'RECEPTION_ANSWERED', label: 'Recepție / Secretariat a răspuns', category: 'ANSWERED' },
  { id: 'DECISION_MAKER_IDENTIFIED', label: 'Decident identificat (Nume/Funcție)', category: 'ANSWERED' },
  { id: 'INTERESTED', label: 'Interesat de discuție / ofertă', category: 'POSITIVE' },
  { id: 'CALLBACK_REQUESTED', label: 'A solicitat să revenim (Callback)', category: 'FOLLOWUP' },
  { id: 'OFFER_REQUESTED', label: 'Ofertă solicitată', category: 'POSITIVE' },
  { id: 'OFFER_SENT', label: 'Ofertă transmisă pe email', category: 'POSITIVE' },
  { id: 'MEETING_SCHEDULED', label: 'Întâlnire stabilită', category: 'POSITIVE' },
  { id: 'EXISTING_INSURANCE', label: 'Are deja asigurător / polițe active', category: 'NEUTRAL' },
  { id: 'NO_ANSWER', label: 'Nu a răspuns / Ton ocupat', category: 'NO_ANSWER' },
  { id: 'UNAVAILABLE', label: 'Număr indisponibil / deconectat', category: 'NO_ANSWER' },
  { id: 'WRONG_NUMBER', label: 'Număr greșit / Nu mai aparține firmei', category: 'NEGATIVE' },
  { id: 'NOT_INTERESTED', label: 'Nu este interesat momentan', category: 'NEGATIVE' },
  { id: 'DO_NOT_CONTACT', label: 'Solicitare expresă: NU CONTACTAȚI', category: 'NEGATIVE' },
];

const OPPORTUNITY_LABELS: Record<string, string> = {
  TRANSPORT: 'Transport (CMR, CASCO flotă, Cargo)',
  CONSTRUCTION: 'Construcții (CAR/EAR, Garanții SEAP)',
  LIABILITY: 'Răspundere Civilă Generală & D&O',
  IT_CYBER: 'IT & Cyber Risk (E&O, Data Breach)',
  HEALTHCARE: 'Sănătate & Malpraxis Medical',
  HOSPITALITY: 'Ospitalitate & HORECA (Incendiu / Bunuri)',
  REAL_ESTATE: 'Imobiliare & Dezvoltare (Property / Răspundere)',
};

function CallingWorkspaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Filters
  const [query, setQuery] = useState(searchParams?.get('q') || '');
  const [county, setCounty] = useState(searchParams?.get('county') || '');
  const [priority, setPriority] = useState(searchParams?.get('priority') || '');
  const [stage, setStage] = useState(searchParams?.get('stage') || '');
  const [contactFilter, setContactFilter] = useState(
    searchParams?.get('hasMobile') === 'true' ? 'hasMobile' :
    searchParams?.get('hasLandline') === 'true' ? 'hasLandline' :
    searchParams?.get('hasEmail') === 'true' ? 'hasEmail' :
    searchParams?.get('hasWebsite') === 'true' ? 'hasWebsite' :
    searchParams?.get('noContact') === 'true' ? 'noContact' : 'hasAnyContact'
  );
  const [source, setSource] = useState(searchParams?.get('source') || '');
  const [opportunity, setOpportunity] = useState(searchParams?.get('opportunity') || '');
  const [requiresCallback, setRequiresCallback] = useState(searchParams?.get('requiresCallback') === 'true');

  // UI state
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [activeCallCompany, setActiveCallCompany] = useState<any | null>(null);
  const [submittingOutcome, setSubmittingOutcome] = useState(false);
  const [outcomeSuccessMsg, setOutcomeSuccessMsg] = useState<string | null>(null);

  // Call Outcome Form
  const [callForm, setCallForm] = useState({
    outcome: 'RECEPTION_ANSWERED',
    contact_value: '',
    contact_person: '',
    contact_position: '',
    notes: '',
    next_action: '',
    next_follow_up_date: '',
    verify_contact: false,
    add_to_suppression: false,
  });

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCompanies = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
      });
      if (query) params.set('q', query);
      if (county) params.set('county', county);
      if (priority) params.set('priority', priority);
      if (stage) params.set('stage', stage);
      if (source) params.set('source', source);
      if (opportunity) params.set('opportunity', opportunity);
      if (requiresCallback) params.set('requiresCallback', 'true');

      if (contactFilter === 'hasMobile') params.set('hasMobile', 'true');
      else if (contactFilter === 'hasLandline') params.set('hasLandline', 'true');
      else if (contactFilter === 'hasEmail') params.set('hasEmail', 'true');
      else if (contactFilter === 'hasWebsite') params.set('hasWebsite', 'true');
      else if (contactFilter === 'hasAnyContact') params.set('hasAnyContact', 'true');
      else if (contactFilter === 'noContact') params.set('noContact', 'true');

      const res = await fetch(`/api/companies?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setItems(json.data.items || []);
        const pag = json.data.pagination || {};
        setPagination({
          page: pag.page || 1,
          limit: pag.limit || 25,
          total: pag.total || 0,
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
  }, [county, priority, stage, contactFilter, source, opportunity, requiresCallback]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCompanies(1);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPhone(text);
    setTimeout(() => setCopiedPhone(null), 2500);
  };

  const openCallModal = (company: any, defaultPhone?: string) => {
    const phoneToUse = defaultPhone || company.mobile_phone || company.landline_phone || '';
    setActiveCallCompany(company);
    setOutcomeSuccessMsg(null);
    setCallForm({
      outcome: 'RECEPTION_ANSWERED',
      contact_value: phoneToUse,
      contact_person: '',
      contact_position: '',
      notes: '',
      next_action: '',
      next_follow_up_date: '',
      verify_contact: true,
      add_to_suppression: false,
    });
  };

  const handleOutcomeChange = (newOutcome: string) => {
    let nextDate = '';
    if (newOutcome === 'CALLBACK_REQUESTED' || newOutcome === 'MEETING_SCHEDULED') {
      const tomorrow = new Date(Date.now() + 86400000);
      nextDate = tomorrow.toISOString().slice(0, 10);
    }
    setCallForm(prev => ({
      ...prev,
      outcome: newOutcome,
      next_follow_up_date: nextDate || prev.next_follow_up_date,
      add_to_suppression: newOutcome === 'DO_NOT_CONTACT',
      verify_contact: ['RECEPTION_ANSWERED', 'DECISION_MAKER_IDENTIFIED', 'INTERESTED', 'CALLBACK_REQUESTED', 'OFFER_REQUESTED', 'EXISTING_INSURANCE'].includes(newOutcome),
    }));
  };

  const submitCallOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCallCompany) return;
    setSubmittingOutcome(true);

    try {
      const payload = {
        cui: activeCallCompany.cui,
        interaction_type: 'CALL_OUTGOING',
        outcome: callForm.outcome,
        notes: callForm.notes || `Apel înregistrat cu rezultatul: ${callForm.outcome}`,
        contact_person: callForm.contact_person ? `${callForm.contact_person}${callForm.contact_position ? ` (${callForm.contact_position})` : ''}` : null,
        contact_value: callForm.contact_value || null,
        next_action: callForm.next_action || (callForm.next_follow_up_date ? `Revenire / Follow-up (${callForm.outcome})` : null),
        next_follow_up_date: callForm.next_follow_up_date || null,
        verify_contact: callForm.verify_contact,
        add_to_suppression: callForm.add_to_suppression,
      };

      const res = await fetch('/api/crm/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setOutcomeSuccessMsg('Interacțiune salvată durabil în CRM!');
        // Update local item state in-place
        setItems(prev => prev.map(c => {
          if (c.cui === activeCallCompany.cui) {
            return {
              ...c,
              crm_status: callForm.outcome === 'DO_NOT_CONTACT' ? 'DO_NOT_CONTACT' :
                          callForm.outcome === 'INTERESTED' ? 'INTERESTED' :
                          callForm.outcome === 'OFFER_REQUESTED' ? 'OFFER_REQUESTED' :
                          callForm.outcome === 'CALLBACK_REQUESTED' ? 'CALLBACK_REQUESTED' :
                          callForm.outcome === 'NO_ANSWER' ? 'NO_ANSWER' :
                          callForm.outcome === 'NOT_INTERESTED' ? 'NOT_INTERESTED' : 'CONTACTED',
              last_interaction_outcome: callForm.outcome,
              last_interaction_at: new Date().toISOString(),
              next_follow_up_date: callForm.next_follow_up_date || c.next_follow_up_date,
              mobile_status: callForm.verify_contact && c.mobile_phone === callForm.contact_value ? 'MANUALLY_CONFIRMED' : c.mobile_status,
              landline_status: callForm.verify_contact && c.landline_phone === callForm.contact_value ? 'MANUALLY_CONFIRMED' : c.landline_status,
            };
          }
          return c;
        }));

        fetchStats();
        setTimeout(() => {
          setActiveCallCompany(null);
          setOutcomeSuccessMsg(null);
        }, 1200);
      } else {
        alert(json.error || 'Eroare la salvare.');
      }
    } catch (err: any) {
      alert(err.message || 'Eroare rețea');
    } finally {
      setSubmittingOutcome(false);
    }
  };

  const handleExport = (type: string) => {
    const params = new URLSearchParams();
    if (type === 'mobile') params.set('contactFilter', 'with_mobile');
    else if (type === 'landline') params.set('contactFilter', 'with_landline');
    else if (type === 'email') params.set('contactFilter', 'with_email');
    else if (type === 'callbacks') params.set('requiresCallback', 'true');
    else if (contactFilter === 'hasMobile') params.set('contactFilter', 'with_mobile');
    else if (contactFilter === 'hasLandline') params.set('contactFilter', 'with_landline');
    else if (contactFilter === 'hasEmail') params.set('contactFilter', 'with_email');
    else if (contactFilter === 'hasAnyContact') params.set('contactFilter', 'with_any_contact');

    if (county) params.set('county', county);
    if (priority) params.set('priority', priority);
    if (opportunity) params.set('opportunity', opportunity);

    window.open(`/api/export?${params.toString()}`, '_blank');
  };

  const getSourceBadge = (sourceName: string, status: string) => {
    if (status === 'MANUALLY_CONFIRMED') {
      return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">Confirmat Manual (1.00)</span>;
    }
    if (sourceName === 'ANAF_OPEN_DATA') {
      return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">ANAF Declarat (0.85)</span>;
    }
    if (sourceName === 'OFFICIAL_WEBSITE') {
      return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Site Oficial (0.95)</span>;
    }
    if (sourceName === 'HISTORICAL_REGISTRY') {
      return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-700/60 text-zinc-300 border border-zinc-600">Registru Istoric</span>;
    }
    return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-titanium-800 text-titanium-400">Neverificat</span>;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="border-b border-titanium-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-radar-green uppercase tracking-wider mb-1">
              <PhoneCall className="w-4 h-4" />
              Execuție Vânzări & Prospectare B2B
            </div>
            <h1 className="text-2xl font-extrabold text-titanium-100 tracking-tight flex items-center gap-2.5">
              Workspace Apeluri Telefonice
              <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-full bg-radar-emerald/20 text-radar-green border border-radar-emerald/30">
                LIVE CRM
              </span>
            </h1>
            <p className="text-xs text-titanium-400 mt-1 max-w-3xl">
              Apelează companiile românești calificate, identifică persoanele de decizie, discută temele de asigurare relevante conform CAEN și înregistrează fiecare rezultat direct în D1.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => handleExport('current')}
              className="px-3 py-2 rounded-lg bg-titanium-850 hover:bg-titanium-800 text-titanium-200 border border-titanium-700 text-xs font-medium transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <Link
              href="/pipeline"
              className="px-3 py-2 rounded-lg bg-radar-emerald/20 hover:bg-radar-emerald/30 text-radar-green border border-radar-emerald/40 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Kanban Pipeline</span>
            </Link>
          </div>
        </div>

        {/* Live CRM Top Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-5">
          <div className="bg-titanium-900 border border-titanium-800 rounded-lg p-3">
            <div className="text-[10px] text-titanium-400 font-medium flex items-center justify-between">
              <span>Companii cu Mobil</span>
              <Smartphone className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
              {stats?.contacts?.with_mobile || 1121}
            </div>
            <div className="text-[9px] text-titanium-500">Prefix +407 apelabil</div>
          </div>

          <div className="bg-titanium-900 border border-titanium-800 rounded-lg p-3">
            <div className="text-[10px] text-titanium-400 font-medium flex items-center justify-between">
              <span>Companii cu Fix</span>
              <Phone className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="text-lg font-bold font-mono text-cyan-400 mt-0.5">
              {stats?.contacts?.with_landline || 402}
            </div>
            <div className="text-[9px] text-titanium-500">Prefix +402 / +403</div>
          </div>

          <div className="bg-titanium-900 border border-titanium-800 rounded-lg p-3">
            <div className="text-[10px] text-titanium-400 font-medium flex items-center justify-between">
              <span>Apeluri Înregistrate</span>
              <PhoneCall className="w-3 h-3 text-radar-green" />
            </div>
            <div className="text-lg font-bold font-mono text-radar-green mt-0.5">
              {stats?.salesPerformance?.calls_attempted || 0}
            </div>
            <div className="text-[9px] text-titanium-500">{stats?.salesPerformance?.calls_answered || 0} cu răspuns</div>
          </div>

          <div className="bg-titanium-900 border border-titanium-800 rounded-lg p-3">
            <div className="text-[10px] text-titanium-400 font-medium flex items-center justify-between">
              <span>Decidenți Găsiți</span>
              <User className="w-3 h-3 text-purple-400" />
            </div>
            <div className="text-lg font-bold font-mono text-purple-400 mt-0.5">
              {stats?.salesPerformance?.decision_makers_identified || 0}
            </div>
            <div className="text-[9px] text-titanium-500">Contact direct administrator</div>
          </div>

          <div className="bg-titanium-900 border border-titanium-800 rounded-lg p-3">
            <div className="text-[10px] text-titanium-400 font-medium flex items-center justify-between">
              <span>Companii Interesate</span>
              <CheckCircle2 className="w-3 h-3 text-teal-400" />
            </div>
            <div className="text-lg font-bold font-mono text-teal-400 mt-0.5">
              {stats?.salesPerformance?.interested_companies || 0}
            </div>
            <div className="text-[9px] text-titanium-500">{stats?.salesPerformance?.offers_requested || 0} oferte cerute</div>
          </div>

          <div className="bg-titanium-900 border border-titanium-800 rounded-lg p-3">
            <div className="text-[10px] text-titanium-400 font-medium flex items-center justify-between">
              <span>Follow-ups Scadente</span>
              <Calendar className="w-3 h-3 text-amber-400" />
            </div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
              {stats?.followups?.followups_today || 0}
            </div>
            <div className="text-[9px] text-rose-400 font-medium">{stats?.followups?.followups_overdue || 0} depășite</div>
          </div>
        </div>
      </div>

      {/* Control Filters */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-4 space-y-3">
        {/* Contact Type Pills */}
        <div className="flex flex-wrap items-center gap-2 border-b border-titanium-800/80 pb-3">
          <span className="text-[11px] font-bold text-titanium-400 uppercase tracking-wider mr-1">
            Filtru Contact:
          </span>
          {[
            { id: 'hasAnyContact', label: 'Toate cu Contact (1.504)' },
            { id: 'hasMobile', label: 'Doar Mobil (1.121)' },
            { id: 'hasLandline', label: 'Doar Fix (402)' },
            { id: 'hasEmail', label: 'Doar Email (3)' },
            { id: 'hasWebsite', label: 'Doar Website (9)' },
            { id: 'noContact', label: 'Fără Contact (1.321)' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setContactFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                contactFilter === f.id
                  ? 'bg-radar-emerald/20 text-radar-green border border-radar-emerald/40 font-bold'
                  : 'bg-titanium-950 text-titanium-400 hover:text-titanium-200 border border-titanium-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Detailed Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5 pt-1">
          {/* Search Query */}
          <div className="md:col-span-2">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-titanium-400" />
              <input
                type="text"
                placeholder="Caută după CUI, Nume, Telefon, Oraș..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-titanium-950 border border-titanium-800 rounded-lg text-xs text-titanium-100 placeholder-titanium-500 focus:outline-none focus:border-radar-green"
              />
            </form>
          </div>

          {/* Sursa Contact */}
          <div>
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-titanium-950 border border-titanium-800 rounded-lg text-xs text-titanium-200 focus:outline-none focus:border-radar-green"
            >
              <option value="">Toate Sursele</option>
              <option value="ANAF">Declarat ANAF (1.546)</option>
              <option value="WEBSITE">Site Oficial Scraper</option>
              <option value="MANUAL">Confirmat Manual</option>
            </select>
          </div>

          {/* Oportunitate Asigurare */}
          <div>
            <select
              value={opportunity}
              onChange={e => setOpportunity(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-titanium-950 border border-titanium-800 rounded-lg text-xs text-titanium-200 focus:outline-none focus:border-radar-green"
            >
              <option value="">Oportunitate Asigurare</option>
              <option value="TRANSPORT">Transport (CMR, CASCO flotă)</option>
              <option value="CONSTRUCTION">Construcții (CAR/EAR, Garanții)</option>
              <option value="LIABILITY">Răspundere & D&O</option>
              <option value="IT_CYBER">IT & Cyber Risk</option>
              <option value="HEALTHCARE">Sănătate & Malpraxis</option>
              <option value="HOSPITALITY">HORECA & Incendiu</option>
              <option value="REAL_ESTATE">Imobiliare & Property</option>
            </select>
          </div>

          {/* Județ */}
          <div>
            <select
              value={county}
              onChange={e => setCounty(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-titanium-950 border border-titanium-800 rounded-lg text-xs text-titanium-200 focus:outline-none focus:border-radar-green"
            >
              <option value="">Toate Județele</option>
              <option value="Bucureşti">București</option>
              <option value="Timiş">Timiș</option>
              <option value="Cluj">Cluj</option>
              <option value="Constanţa">Constanța</option>
              <option value="Prahova">Prahova</option>
              <option value="Braşov">Brașov</option>
              <option value="Iaşi">Iași</option>
              <option value="Arad">Arad</option>
              <option value="Bihor">Bihor</option>
              <option value="Ilfov">Ilfov</option>
              <option value="Argeş">Argeș</option>
              <option value="Mureş">Mureș</option>
              <option value="Sibiu">Sibiu</option>
              <option value="Suceava">Suceava</option>
            </select>
          </div>

          {/* Stadiu Pipeline */}
          <div>
            <select
              value={stage}
              onChange={e => setStage(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-titanium-950 border border-titanium-800 rounded-lg text-xs text-titanium-200 focus:outline-none focus:border-radar-green"
            >
              <option value="">Stadiu CRM</option>
              <option value="NEW">Nou / De contactat</option>
              <option value="CONTACTED">Contactat</option>
              <option value="CALLBACK_REQUESTED">Revine (Callback)</option>
              <option value="IN_DISCUSSION">În discuție</option>
              <option value="INTERESTED">Interesat</option>
              <option value="OFFER_REQUESTED">Ofertă solicitată</option>
              <option value="OFFER_SENT">Ofertă transmisă</option>
              <option value="NO_ANSWER">Nu a răspuns</option>
              <option value="NOT_INTERESTED">Nu e interesat</option>
              <option value="CLIENT_WON">Client câștigat</option>
            </select>
          </div>
        </div>

        {/* Quick Callback Filter Toggle */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-titanium-300">
            <input
              type="checkbox"
              checked={requiresCallback}
              onChange={e => setRequiresCallback(e.target.checked)}
              className="rounded bg-titanium-950 border-titanium-700 text-radar-green focus:ring-0 w-3.5 h-3.5"
            />
            <span className={requiresCallback ? 'text-amber-400 font-bold' : ''}>
              Afișează doar companii cu Follow-up / Callback programat
            </span>
          </label>

          <div className="text-[11px] text-titanium-500 font-mono">
            {pagination.total.toLocaleString('ro-RO')} companii găsite
          </div>
        </div>
      </div>

      {/* Companies List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center bg-titanium-900 border border-titanium-800 rounded-xl space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-radar-green mx-auto" />
            <div className="text-xs text-titanium-400">Se încarcă prospectele pentru apelare...</div>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center bg-titanium-900 border border-titanium-800 rounded-xl space-y-2">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
            <div className="text-sm font-bold text-titanium-200">Nu au fost găsite companii conform filtrelor selectate.</div>
            <div className="text-xs text-titanium-500">Modifică criteriile de filtrare sau șterge căutarea.</div>
          </div>
        ) : (
          items.map((company) => {
            const hasPhone = !!company.mobile_phone || !!company.landline_phone;

            return (
              <div
                key={company.cui}
                className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-5 space-y-4 transition-all"
              >
                {/* Top Row: Company Name, Codes, Location, Score, Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-titanium-800/60 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Link
                        href={`/companies/${company.cui}`}
                        className="text-base font-extrabold text-titanium-100 hover:text-radar-green transition-colors flex items-center gap-1.5"
                      >
                        {company.name}
                        <ExternalLink className="w-3.5 h-3.5 text-titanium-500" />
                      </Link>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-titanium-950 text-titanium-300 border border-titanium-800">
                        CUI: {company.cui}
                      </span>
                      {company.reg_com && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-titanium-400 bg-titanium-950 border border-titanium-800">
                          {company.reg_com}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-titanium-400 flex-wrap">
                      <span>{company.county}{company.city ? `, ${company.city}` : ''}</span>
                      <span>•</span>
                      <span className="font-mono text-radar-green font-bold">CAEN {company.primary_caen}</span>
                      <span>—</span>
                      <span className="text-titanium-300 truncate max-w-md">{company.caen_description}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <div className="text-right">
                      <div className="text-[10px] text-titanium-500 uppercase tracking-wider font-semibold">Oportunitate</div>
                      <div className="text-sm font-bold font-mono text-radar-green">{company.opportunity_score}%</div>
                    </div>
                    {company.crm_status && (
                      <span className="px-2.5 py-1 rounded text-xs font-bold bg-titanium-800 text-titanium-200 border border-titanium-700">
                        {company.crm_status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle Row: PROMINENT PHONE NUMBERS & ACTIONS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-titanium-950/80 border border-titanium-800/80 rounded-lg p-3.5">
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-titanium-400 uppercase tracking-wider">
                      Coordonate de Apel Direct
                    </div>

                    <div className="flex flex-col gap-2">
                      {/* Mobile Number */}
                      {company.mobile_phone ? (
                        <div className="flex items-center justify-between bg-titanium-900 border border-emerald-500/30 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            <Smartphone className="w-4 h-4 text-emerald-400" />
                            <a
                              href={`tel:${company.mobile_phone}`}
                              className="text-sm font-bold font-mono text-emerald-400 hover:underline tracking-wide"
                            >
                              {company.mobile_phone}
                            </a>
                            {getSourceBadge(company.mobile_source, company.mobile_status)}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => copyToClipboard(company.mobile_phone)}
                              title="Copiază numărul"
                              className="p-1.5 rounded hover:bg-titanium-800 text-titanium-400 hover:text-titanium-100 transition-colors"
                            >
                              {copiedPhone === company.mobile_phone ? (
                                <Check className="w-3.5 h-3.5 text-radar-green" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <a
                              href={`tel:${company.mobile_phone}`}
                              className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1"
                            >
                              <PhoneCall className="w-3 h-3" />
                              <span>Apelează</span>
                            </a>
                          </div>
                        </div>
                      ) : null}

                      {/* Landline Number */}
                      {company.landline_phone ? (
                        <div className="flex items-center justify-between bg-titanium-900 border border-cyan-500/30 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            <Phone className="w-4 h-4 text-cyan-400" />
                            <a
                              href={`tel:${company.landline_phone}`}
                              className="text-sm font-bold font-mono text-cyan-400 hover:underline tracking-wide"
                            >
                              {company.landline_phone}
                            </a>
                            {getSourceBadge(company.landline_source, company.landline_status)}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => copyToClipboard(company.landline_phone)}
                              title="Copiază numărul"
                              className="p-1.5 rounded hover:bg-titanium-800 text-titanium-400 hover:text-titanium-100 transition-colors"
                            >
                              {copiedPhone === company.landline_phone ? (
                                <Check className="w-3.5 h-3.5 text-radar-green" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <a
                              href={`tel:${company.landline_phone}`}
                              className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold flex items-center gap-1"
                            >
                              <PhoneCall className="w-3 h-3" />
                              <span>Apelează</span>
                            </a>
                          </div>
                        </div>
                      ) : null}

                      {/* Fallback if no phone */}
                      {!company.mobile_phone && !company.landline_phone && (
                        <div className="text-xs text-titanium-500 italic py-1">
                          Niciun număr de telefon identificat în sursele publice oficiale.
                        </div>
                      )}

                      {/* Email & Website Row */}
                      <div className="flex items-center gap-3 pt-1 text-xs">
                        {company.email_contact && (
                          <a
                            href={`mailto:${company.email_contact}`}
                            className="flex items-center gap-1.5 text-violet-400 hover:underline text-xs"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>{company.email_contact}</span>
                          </a>
                        )}
                        {company.website && (
                          <a
                            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-amber-400 hover:underline text-xs"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>{company.website}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Last Call Status */}
                  <div className="space-y-3 md:border-l md:border-titanium-800/80 md:pl-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-titanium-400 uppercase tracking-wider">
                        Înregistrare Apel CRM
                      </div>
                      {company.last_interaction_outcome && (
                        <span className="text-[10px] font-mono text-titanium-400">
                          Ultimul apel: <strong className="text-titanium-200">{company.last_interaction_outcome}</strong>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => openCallModal(company)}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-radar-emerald hover:bg-radar-emerald/90 text-titanium-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <PhoneCall className="w-4 h-4" />
                        <span>Înregistrează Rezultat Apel</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/companies/${company.cui}?tab=opportunities`}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-titanium-900 hover:bg-titanium-850 text-titanium-300 border border-titanium-700 text-[11px] font-medium text-center transition-colors"
                        >
                          Dosar Asigurare
                        </Link>
                        {company.next_follow_up_date && (
                          <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Revine: {company.next_follow_up_date}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: SUGGESTED INSURANCE TOPICS */}
                {company.insurance_topics && (
                  <div className="bg-titanium-950/40 rounded-lg p-2.5 border border-titanium-800/40 flex items-start gap-2 text-xs">
                    <ShieldCheck className="w-4 h-4 text-radar-green shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-[10px] text-titanium-500 font-semibold uppercase tracking-wider">
                        Teme de discuție sugerate (conform specificului CAEN {company.primary_caen}):
                      </div>
                      <div className="text-titanium-300 font-medium">
                        {company.insurance_topics}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-titanium-800 pt-4 text-xs text-titanium-400">
          <div>
            Pagina <strong className="text-titanium-200">{pagination.page}</strong> din{' '}
            <strong className="text-titanium-200">{pagination.totalPages}</strong> (
            {pagination.total.toLocaleString('ro-RO')} companii)
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchCompanies(pagination.page - 1)}
              className="px-3 py-1.5 rounded bg-titanium-900 border border-titanium-800 hover:bg-titanium-850 disabled:opacity-40 disabled:hover:bg-titanium-900 text-titanium-200 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchCompanies(pagination.page + 1)}
              className="px-3 py-1.5 rounded bg-titanium-900 border border-titanium-800 hover:bg-titanium-850 disabled:opacity-40 disabled:hover:bg-titanium-900 text-titanium-200 transition-colors flex items-center gap-1"
            >
              <span>Următor</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER CALL OUTCOME & SALES WORKFLOW */}
      {activeCallCompany && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-titanium-900 border border-titanium-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 p-6">
            <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
              <div>
                <div className="text-xs font-bold text-radar-green uppercase tracking-wider">
                  Înregistrare Apel Comercial
                </div>
                <h3 className="text-lg font-bold text-titanium-100">
                  {activeCallCompany.name}
                </h3>
                <div className="text-xs text-titanium-400 font-mono">
                  CUI: {activeCallCompany.cui} • {activeCallCompany.county}
                </div>
              </div>
              <button
                onClick={() => setActiveCallCompany(null)}
                className="p-1 rounded-lg text-titanium-400 hover:text-titanium-100 hover:bg-titanium-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {outcomeSuccessMsg ? (
              <div className="p-6 text-center space-y-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <CheckCircle2 className="w-10 h-10 text-radar-green mx-auto" />
                <div className="text-base font-bold text-emerald-300">{outcomeSuccessMsg}</div>
                <div className="text-xs text-titanium-400">Datele au fost sincronizate durabil în D1.</div>
              </div>
            ) : (
              <form onSubmit={submitCallOutcome} className="space-y-4">
                {/* 1. Număr apelat */}
                <div>
                  <label className="block text-xs font-bold text-titanium-300 mb-1">
                    Număr de telefon apelat:
                  </label>
                  <input
                    type="text"
                    required
                    value={callForm.contact_value}
                    onChange={e => setCallForm({ ...callForm, contact_value: e.target.value })}
                    className="w-full px-3 py-2 bg-titanium-950 border border-titanium-700 rounded-lg text-sm text-titanium-100 font-mono focus:outline-none focus:border-radar-green"
                    placeholder="ex: 0722123456"
                  />
                </div>

                {/* 2. Rezultat Apel (Grid de opțiuni) */}
                <div>
                  <label className="block text-xs font-bold text-titanium-300 mb-2">
                    Rezultatul apelului:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {OUTCOMES.map(out => (
                      <button
                        type="button"
                        key={out.id}
                        onClick={() => handleOutcomeChange(out.id)}
                        className={`text-left px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                          callForm.outcome === out.id
                            ? out.category === 'POSITIVE'
                              ? 'bg-radar-emerald/20 text-radar-green border-radar-emerald font-bold'
                              : out.category === 'FOLLOWUP'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-bold'
                              : out.category === 'NEGATIVE'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500 font-bold'
                              : 'bg-titanium-800 text-titanium-100 border-titanium-600 font-bold'
                            : 'bg-titanium-950 text-titanium-400 border-titanium-800 hover:border-titanium-700'
                        }`}
                      >
                        {out.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Persoană de contact & Funcție */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-titanium-300 mb-1">
                      Persoană de contact:
                    </label>
                    <input
                      type="text"
                      value={callForm.contact_person}
                      onChange={e => setCallForm({ ...callForm, contact_person: e.target.value })}
                      placeholder="ex: Ion Popescu"
                      className="w-full px-3 py-1.5 bg-titanium-950 border border-titanium-700 rounded-lg text-xs text-titanium-100 focus:outline-none focus:border-radar-green"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-titanium-300 mb-1">
                      Funcție / Rol:
                    </label>
                    <input
                      type="text"
                      value={callForm.contact_position}
                      onChange={e => setCallForm({ ...callForm, contact_position: e.target.value })}
                      placeholder="ex: Administrator / Director"
                      className="w-full px-3 py-1.5 bg-titanium-950 border border-titanium-700 rounded-lg text-xs text-titanium-100 focus:outline-none focus:border-radar-green"
                    />
                  </div>
                </div>

                {/* 4. Notițe Discuție */}
                <div>
                  <label className="block text-xs font-bold text-titanium-300 mb-1">
                    Notițe & Teme Discutate (obligatoriu):
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={callForm.notes}
                    onChange={e => setCallForm({ ...callForm, notes: e.target.value })}
                    placeholder="Menționează ce s-a discutat, obiecțiile ridicate sau interesul exprimat..."
                    className="w-full px-3 py-2 bg-titanium-950 border border-titanium-700 rounded-lg text-xs text-titanium-100 focus:outline-none focus:border-radar-green"
                  />
                </div>

                {/* 5. Follow-up programat */}
                <div className="grid grid-cols-2 gap-3 bg-titanium-950/60 p-3 rounded-lg border border-titanium-800">
                  <div>
                    <label className="block text-xs font-bold text-titanium-300 mb-1">
                      Dată Follow-up / Revenire:
                    </label>
                    <input
                      type="date"
                      value={callForm.next_follow_up_date}
                      onChange={e => setCallForm({ ...callForm, next_follow_up_date: e.target.value })}
                      className="w-full px-3 py-1.5 bg-titanium-900 border border-titanium-700 rounded-lg text-xs text-titanium-100 focus:outline-none focus:border-radar-green"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-titanium-300 mb-1">
                      Acțiune următoare:
                    </label>
                    <input
                      type="text"
                      value={callForm.next_action}
                      onChange={e => setCallForm({ ...callForm, next_action: e.target.value })}
                      placeholder="ex: Trimis cotație CMR pe email"
                      className="w-full px-3 py-1.5 bg-titanium-900 border border-titanium-700 rounded-lg text-xs text-titanium-100 focus:outline-none focus:border-radar-green"
                    />
                  </div>
                </div>

                {/* 6. Opțiuni de Calitate & Supresie */}
                <div className="space-y-2 pt-1 border-t border-titanium-800 text-xs">
                  <label className="flex items-center gap-2 text-titanium-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={callForm.verify_contact}
                      onChange={e => setCallForm({ ...callForm, verify_contact: e.target.checked })}
                      className="rounded bg-titanium-950 border-titanium-700 text-radar-green w-4 h-4"
                    />
                    <span>
                      Confirmă acest număr ca fiind <strong>activ și verificat direct</strong> (actualizează scorul la 1.00 în baza de date)
                    </span>
                  </label>

                  {callForm.outcome === 'DO_NOT_CONTACT' && (
                    <label className="flex items-center gap-2 text-rose-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={callForm.add_to_suppression}
                        onChange={e => setCallForm({ ...callForm, add_to_suppression: e.target.checked })}
                        className="rounded bg-titanium-950 border-rose-500 text-rose-500 w-4 h-4"
                      />
                      <span>
                        Adaugă firma în <strong>Lista Oficială de Supresie</strong> (blochează exportul și reapelarea)
                      </span>
                    </label>
                  )}
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-titanium-800">
                  <button
                    type="button"
                    onClick={() => setActiveCallCompany(null)}
                    className="px-4 py-2 rounded-lg bg-titanium-800 hover:bg-titanium-750 text-titanium-300 text-xs font-medium"
                  >
                    Anulează
                  </button>
                  <button
                    type="submit"
                    disabled={submittingOutcome}
                    className="px-5 py-2 rounded-lg bg-radar-emerald hover:bg-radar-emerald/90 text-titanium-950 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {submittingOutcome && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Salvează în CRM (D1)</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CallingWorkspacePage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-xs text-titanium-400">
        Se încarcă workspace-ul de apeluri...
      </div>
    }>
      <CallingWorkspaceContent />
    </Suspense>
  );
}
