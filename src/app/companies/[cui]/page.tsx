'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Building2,
  ShieldCheck,
  Globe,
  MapPin,
  Calendar,
  Phone,
  Mail,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Clock,
  Layers,
  History,
  TrendingUp,
  User,
  Plus,
  Trash2,
  Copy,
  Check,
  XCircle,
  FileText,
  PhoneCall,
  Send,
  MessageSquare,
  Users,
  Award,
  AlertOctagon,
  ChevronRight,
  Filter,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

const CRM_STATUSES = [
  { id: 'NEW', label: 'Nou', color: 'bg-titanium-800 text-titanium-200 border-titanium-700' },
  { id: 'TO_CONTACT', label: 'De contactat', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { id: 'CONTACTED', label: 'Contactat', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  { id: 'NO_ANSWER', label: 'Nu a răspuns', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { id: 'CALLBACK_REQUESTED', label: 'Revine', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  { id: 'FOLLOW_UP_SCHEDULED', label: 'Follow-up programat', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  { id: 'IN_DISCUSSION', label: 'În discuție', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { id: 'INTERESTED', label: 'Interesat', color: 'bg-radar-green/10 text-radar-green border-radar-green/30' },
  { id: 'OFFER_REQUESTED', label: 'Ofertă solicitată', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
  { id: 'OFFER_SENT', label: 'Ofertă transmisă', color: 'bg-violet-500/10 text-violet-400 border-violet-500/30' },
  { id: 'NEGOTIATION', label: 'Negociere', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  { id: 'CLIENT_WON', label: 'Client câștigat', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold' },
  { id: 'LOST', label: 'Pierdut', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  { id: 'NOT_INTERESTED', label: 'Nu este interesat', color: 'bg-zinc-700/50 text-zinc-400 border-zinc-600' },
  { id: 'DO_NOT_CONTACT', label: 'Nu contacta', color: 'bg-red-500/20 text-red-400 border-red-500/50 font-bold' },
];

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cui = params?.cui as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'opportunities' | 'timeline' | 'tasks' | 'legal'>('overview');

  // Modals / Action drawers
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Forms
  const [interactionForm, setInteractionForm] = useState({
    interaction_type: 'CALL_OUTGOING',
    outcome: 'REACHED_DECISION_MAKER',
    notes: '',
    contact_person: '',
    contact_value: '',
    next_action: '',
    next_follow_up_date: '',
  });

  const [followUpForm, setFollowUpForm] = useState({
    title: '',
    description: '',
    due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    priority: 'MEDIUM',
  });

  const [contactForm, setContactForm] = useState({
    contact_type: 'MOBILE',
    contact_value: '',
    label: 'OFFICE',
    source_name: 'DECLARATIE_CLIENT',
    verification_status: 'MANUALLY_CONFIRMED',
    contact_person: '',
    contact_person_position: '',
    notes: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/companies/${cui}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.error || 'Compania nu a putut fi încărcată.');
      }
    } catch (err: any) {
      setError(err.message || 'Eroare de rețea.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cui) loadData();
  }, [cui]);

  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichResultMsg, setEnrichResultMsg] = useState<string | null>(null);

  const handleEnrich = async () => {
    setEnrichLoading(true);
    setEnrichResultMsg(null);
    try {
      const res = await fetch(`/api/enrichment/company/${cui}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true }),
      });
      const json = await res.json();
      if (json.success) {
        const foundCount = json.data?.contactsDiscovered?.length || 0;
        setEnrichResultMsg(`Îmbogățire finalizată: ${foundCount} coordonate identificate.`);
        loadData();
      } else {
        setEnrichResultMsg(`Eroare: ${json.error || 'Indisponibil'}`);
      }
    } catch (err: any) {
      setEnrichResultMsg(`Eroare: ${err.message}`);
    } finally {
      setEnrichLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cui: Number(cui), status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleInteractionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/crm/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...interactionForm, cui: Number(cui) }),
      });
      const json = await res.json();
      if (json.success) {
        setShowInteractionModal(false);
        setInteractionForm({
          interaction_type: 'CALL_OUTGOING',
          outcome: 'REACHED_DECISION_MAKER',
          notes: '',
          contact_person: '',
          contact_value: '',
          next_action: '',
          next_follow_up_date: '',
        });
        loadData();
      } else {
        alert(json.error || 'Eroare la salvare.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/crm/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...followUpForm, cui: Number(cui) }),
      });
      const json = await res.json();
      if (json.success) {
        setShowFollowUpModal(false);
        setFollowUpForm({
          title: '',
          description: '',
          due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          priority: 'MEDIUM',
        });
        loadData();
      } else {
        alert(json.error || 'Eroare la salvare.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/companies/${cui}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      const json = await res.json();
      if (json.success) {
        setShowContactModal(false);
        setContactForm({
          contact_type: 'MOBILE',
          contact_value: '',
          label: 'OFFICE',
          source_name: 'DECLARATIE_CLIENT',
          verification_status: 'MANUALLY_CONFIRMED',
          contact_person: '',
          contact_person_position: '',
          notes: '',
        });
        loadData();
      } else {
        alert(json.error || 'Eroare la salvare.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      await fetch('/api/crm/follow-ups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: 'COMPLETED' }),
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSuppress = async () => {
    if (!confirm('Ești sigur că vrei să adaugi această companie în lista de supresie (DO NOT CONTACT)?')) return;
    try {
      const res = await fetch('/api/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cui: Number(cui), reason: 'Exclus manual din profil' }),
      });
      const json = await res.json();
      if (json.success) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateOpportunityStatus = async (oppId: number, status: string) => {
    try {
      await fetch(`/api/companies/${cui}/opportunities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: oppId, status }),
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto w-full text-center py-20 text-titanium-400 font-mono text-xs">
        Se încarcă profilul companiei din registru și baza D1...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
          {error || 'Compania nu a fost găsită.'}
          <div className="mt-4">
            <Link href="/companies" className="text-xs text-titanium-300 underline">Înapoi la companii</Link>
          </div>
        </div>
      </div>
    );
  }

  const { company, contacts, opportunities, pipeline, interactions, followUps, statusHistory, isSuppressed, categories } = data;

  const currentStatusObj = CRM_STATUSES.find(s => s.id === (pipeline?.status || 'NEW')) || CRM_STATUSES[0];
  const primaryPhone = contacts.find((c: any) => c.contact_type?.includes('PHONE') || c.contact_type === 'MOBILE' || c.contact_type === 'LANDLINE');
  const primaryEmail = contacts.find((c: any) => c.contact_type?.includes('EMAIL'));

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Breadcrumb & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Link
          href="/companies"
          className="text-xs text-titanium-400 hover:text-radar-green flex items-center gap-1.5 transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Înapoi la Baza Națională
        </Link>

        <div className="flex items-center gap-2">
          {isSuppressed ? (
            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1.5">
              <AlertOctagon className="w-3.5 h-3.5" />
              EXCLUS DIN PROSPECTARE (DO NOT CONTACT)
            </span>
          ) : (
            <button
              onClick={handleSuppress}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-titanium-900 border border-titanium-700 hover:border-rose-500 text-titanium-400 hover:text-rose-400 transition-colors flex items-center gap-1.5"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              Exclude din Prospectare
            </button>
          )}

          <button
            onClick={() => handleStatusChange('CLIENT_WON')}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Award className="w-4 h-4" />
            Marchează Client Câștigat
          </button>
        </div>
      </div>

      {/* Main Profile Header Banner */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-titanium-800 border border-titanium-700 text-titanium-300">
                {company.legal_form || 'SRL'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                company.status === 'ACTIVE'
                  ? 'bg-radar-emerald/10 text-radar-green border-radar-emerald/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {company.status === 'ACTIVE' ? 'ACTIVĂ (ÎN FUNCȚIUNE)' : company.status}
              </span>
              <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${currentStatusObj.color}`}>
                Etapă CRM: {currentStatusObj.label}
              </span>
              {company.website && (
                <a
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-radar-green hover:underline flex items-center gap-1 font-mono"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {company.website}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-titanium-100 tracking-tight">
              {company.name}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs text-titanium-400 font-mono">
              <div>CUI: <strong className="text-titanium-100">{company.cui}</strong></div>
              <div>•</div>
              <div>RegCom: <strong className="text-titanium-200">{company.reg_com || 'Nespecificat'}</strong></div>
              <div>•</div>
              <div>EUID: <span className="text-titanium-300">{company.euid || 'N/A'}</span></div>
            </div>

            <div className="flex items-center gap-2 text-xs text-titanium-400 pt-1">
              <MapPin className="w-3.5 h-3.5 text-titanium-500" />
              <span>
                {company.county}, {company.city}
                {company.street ? `, Str. ${company.street} ${company.street_nr || ''}` : ''}
                {company.postal_code ? ` (Cod ${company.postal_code})` : ''}
              </span>
            </div>
          </div>

          {/* KPI Card */}
          <div className="bg-titanium-950 border border-titanium-800 rounded-xl p-4 min-w-[220px] text-right space-y-2">
            <div className="text-[11px] font-semibold text-titanium-400 uppercase tracking-wider">
              Scor Oportunitate BI
            </div>
            <div className="text-3xl font-extrabold text-radar-green font-mono">
              {company.opportunity_score}%
            </div>
            <div className="text-xs text-titanium-400">
              Completitudine Date: <strong className="text-titanium-200">{company.data_completeness_score}%</strong>
            </div>
            {pipeline?.next_follow_up_date && (
              <div className="pt-2 border-t border-titanium-800/80 text-[11px] text-amber-400 font-medium">
                📅 Următor follow-up: {pipeline.next_follow_up_date}
              </div>
            )}
          </div>
        </div>

        {/* Quick Action Ribbon */}
        <div className="pt-4 border-t border-titanium-800/80 flex flex-wrap items-center gap-2.5">
          {primaryPhone ? (
            <a
              href={`tel:${primaryPhone.contact_value}`}
              className="px-3 py-1.5 bg-titanium-800 hover:bg-titanium-700 text-radar-green font-semibold text-xs rounded-lg border border-titanium-700 flex items-center gap-1.5 transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Apelează {primaryPhone.contact_value}
            </a>
          ) : (
            <button
              onClick={() => {
                setContactForm(prev => ({ ...prev, contact_type: 'MOBILE' }));
                setShowContactModal(true);
              }}
              className="px-3 py-1.5 bg-titanium-950 hover:bg-titanium-800 text-titanium-400 font-semibold text-xs rounded-lg border border-dashed border-titanium-700 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adaugă Telefon
            </button>
          )}

          {primaryPhone && (
            <button
              onClick={() => copyToClipboard(primaryPhone.contact_value)}
              className="px-3 py-1.5 bg-titanium-800 hover:bg-titanium-700 text-titanium-200 text-xs rounded-lg border border-titanium-700 flex items-center gap-1.5 transition-colors"
            >
              {copiedText === primaryPhone.contact_value ? <Check className="w-3.5 h-3.5 text-radar-green" /> : <Copy className="w-3.5 h-3.5" />}
              Copiază Număr
            </button>
          )}

          {primaryEmail && (
            <a
              href={`mailto:${primaryEmail.contact_value}`}
              className="px-3 py-1.5 bg-titanium-800 hover:bg-titanium-700 text-cyan-400 font-semibold text-xs rounded-lg border border-titanium-700 flex items-center gap-1.5 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              Trimite Email
            </a>
          )}

          <button
            onClick={() => setShowInteractionModal(true)}
            className="px-3.5 py-1.5 bg-radar-green text-titanium-950 font-bold text-xs rounded-lg hover:bg-emerald-400 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            Înregistrează Interacțiune
          </button>

          <button
            onClick={() => setShowFollowUpModal(true)}
            className="px-3 py-1.5 bg-titanium-800 hover:bg-titanium-700 text-amber-400 font-semibold text-xs rounded-lg border border-titanium-700 flex items-center gap-1.5 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />
            Programează Follow-up
          </button>

          <button
            onClick={() => setShowContactModal(true)}
            className="px-3 py-1.5 bg-titanium-800 hover:bg-titanium-700 text-titanium-200 text-xs rounded-lg border border-titanium-700 flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adaugă Contact
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-titanium-400">Schimbă Etapă:</span>
            <select
              value={pipeline?.status || 'NEW'}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-titanium-950 border border-titanium-700 text-titanium-100 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-radar-green"
            >
              {CRM_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-titanium-800 gap-1 overflow-x-auto text-xs font-semibold">
        {[
          { id: 'overview', label: 'Prezentare & CRM' },
          { id: 'contacts', label: `Coordonate Contact (${contacts.length})` },
          { id: 'opportunities', label: `Oportunități Asigurare (${opportunities.length})` },
          { id: 'timeline', label: `Istoric Interacțiuni (${interactions.length})` },
          { id: 'tasks', label: `Follow-ups (${followUps.filter((f: any) => f.status === 'PENDING').length})` },
          { id: 'legal', label: 'Identitate Juridică & CAEN' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-radar-green text-radar-green'
                : 'border-transparent text-titanium-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview & CRM */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Sales CRM Status Box */}
            <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
                <h2 className="text-xs font-bold text-titanium-200 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-radar-green" />
                  Stare Oportunitate Vânzări
                </h2>
                <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${currentStatusObj.color}`}>
                  {currentStatusObj.label}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                <div className="p-3 bg-titanium-950 rounded-lg border border-titanium-800">
                  <span className="text-titanium-500 text-[10px]">Prioritate</span>
                  <div className="font-bold text-titanium-100 mt-0.5">{pipeline?.priority || 'STANDARD'}</div>
                </div>
                <div className="p-3 bg-titanium-950 rounded-lg border border-titanium-800">
                  <span className="text-titanium-500 text-[10px]">Următor Follow-up</span>
                  <div className="font-bold text-amber-400 mt-0.5">{pipeline?.next_follow_up_date || 'Neprogramat'}</div>
                </div>
                <div className="p-3 bg-titanium-950 rounded-lg border border-titanium-800">
                  <span className="text-titanium-500 text-[10px]">Total Interacțiuni</span>
                  <div className="font-bold text-cyan-400 mt-0.5">{interactions.length}</div>
                </div>
                <div className="p-3 bg-titanium-950 rounded-lg border border-titanium-800">
                  <span className="text-titanium-500 text-[10px]">Ultima Actualizare</span>
                  <div className="font-bold text-titanium-300 mt-0.5">{pipeline?.updated_at?.slice(0, 10) || 'Recent'}</div>
                </div>
              </div>

              {pipeline?.notes && (
                <div className="p-4 bg-titanium-950 rounded-lg border border-titanium-800 text-xs text-titanium-300 space-y-1">
                  <div className="text-titanium-500 font-semibold text-[11px]">Notițe CRM Actuale:</div>
                  <p>{pipeline.notes}</p>
                </div>
              )}
            </div>

            {/* Quick Recommended Opportunities */}
            <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
                <h2 className="text-xs font-bold text-titanium-200 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-radar-green" />
                  Oportunități Recomandate ({opportunities.length})
                </h2>
                <button
                  onClick={() => setActiveTab('opportunities')}
                  className="text-xs text-radar-green hover:underline flex items-center gap-1"
                >
                  Vezi toate
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {opportunities.slice(0, 3).map((opp: any) => (
                  <div key={opp.id} className="p-4 bg-titanium-850 rounded-lg border border-titanium-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-titanium-100">{opp.product_name}</div>
                      <div className="text-xs text-titanium-400 mt-0.5">{opp.rationale}</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-titanium-800 text-titanium-300 border border-titanium-700">
                      {opp.estimated_priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Pending Follow-ups */}
          <div className="space-y-6">
            <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
                <h3 className="text-xs font-bold text-titanium-200 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Sarcini Follow-up Programate
                </h3>
                <button
                  onClick={() => setShowFollowUpModal(true)}
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Nou
                </button>
              </div>

              {followUps.filter((f: any) => f.status === 'PENDING').length === 0 ? (
                <div className="text-xs text-titanium-500 py-4 text-center">
                  Nu există sarcini active de follow-up.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {followUps
                    .filter((f: any) => f.status === 'PENDING')
                    .map((f: any) => (
                      <div key={f.id} className="p-3 bg-titanium-950 rounded-lg border border-titanium-800 space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-titanium-100">{f.title}</div>
                          <span className="text-[10px] font-mono font-bold text-amber-400">{f.due_date}</span>
                        </div>
                        {f.description && <p className="text-titanium-400 text-[11px]">{f.description}</p>}
                        <div className="pt-1 flex items-center justify-end">
                          <button
                            onClick={() => handleCompleteTask(f.id)}
                            className="text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Marchează Finalizat
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* CAEN Classification Snippet */}
            <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5 space-y-3 text-xs">
              <div className="text-xs font-bold text-titanium-200 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-titanium-400" />
                Activitate Principală
              </div>
              <div className="p-3 bg-titanium-950 rounded border border-titanium-800">
                <div className="font-mono text-radar-green font-bold">CAEN {company.primary_caen}</div>
                <div className="text-titanium-300 mt-1">{company.caen_description}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Contacts */}
      {activeTab === 'contacts' && (
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-titanium-800 pb-4">
            <div>
              <h2 className="text-sm font-bold text-titanium-100 uppercase tracking-wider flex items-center gap-2">
                <Phone className="w-4 h-4 text-radar-green" />
                Registru Coordonate &amp; Date de Contact Verificate
              </h2>
              <p className="text-xs text-titanium-400 mt-0.5">
                Date reale obținute din surse deschise și verificate (ANAF, Web oficial, Broker). Niciun contact nu este generat artificial.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleEnrich}
                disabled={enrichLoading}
                className="px-3.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-semibold text-xs rounded-lg border border-emerald-500/30 transition-colors flex items-center gap-1.5"
              >
                <Sparkles className={`w-3.5 h-3.5 ${enrichLoading ? 'animate-spin' : ''}`} />
                {enrichLoading ? 'Se verifică sursele...' : 'Îmbogățește Automat (ANAF & Web)'}
              </button>

              <button
                onClick={() => setShowContactModal(true)}
                className="px-3.5 py-1.5 bg-titanium-800 hover:bg-titanium-700 text-titanium-200 font-bold text-xs rounded-lg border border-titanium-700 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Adaugă Contact Manual
              </button>
            </div>
          </div>

          {enrichResultMsg && (
            <div className="p-3 rounded-lg bg-titanium-950 border border-titanium-800 text-xs text-emerald-300 font-mono">
              {enrichResultMsg}
            </div>
          )}

          {contacts.length === 0 && !company.website ? (
            <div className="py-10 text-center space-y-3">
              <Phone className="w-8 h-8 text-titanium-600 mx-auto" />
              <div className="text-sm text-titanium-300 font-semibold">
                Nu am identificat încă date de contact în sursele verificate.
              </div>
              <p className="text-xs text-titanium-500 max-w-md mx-auto">
                Surse verificate: Evidențele publice ANAF (PlatitorTvaRest) și Registrul Comerțului. Poți lansa motorul automat de îmbogățire sau poți adăuga un contact verificat direct.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleEnrich}
                  disabled={enrichLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Lansează Căutarea în ANAF &amp; Web
                </button>
                <button
                  onClick={() => setShowContactModal(true)}
                  className="px-4 py-2 bg-titanium-800 hover:bg-titanium-700 text-titanium-200 text-xs rounded-lg border border-titanium-700 transition-colors"
                >
                  Adaugă Contact Manual
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {company.website && (
                <div className="p-4 bg-titanium-950 rounded-xl border border-titanium-800 flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-radar-green bg-radar-green/10 px-2 py-0.5 rounded border border-radar-green/20">
                      Website Oficial
                    </span>
                    <div className="text-sm font-mono font-bold text-titanium-100 pt-1">
                      {company.website}
                    </div>
                    <div className="text-[10px] text-titanium-500 font-mono">
                      Sursă: Web Official / Registru Oficial
                    </div>
                  </div>
                  <a
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-titanium-800 hover:bg-titanium-700 text-radar-green rounded-lg border border-titanium-700 transition-colors"
                    title="Deschide site oficial"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {contacts.map((c: any) => (
                <div key={c.id} className="p-4 bg-titanium-950 rounded-xl border border-titanium-800 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-titanium-800 text-titanium-300 border border-titanium-700">
                          {c.contact_type} ({c.label || 'OFFICE'})
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            c.verification_status === 'OFFICIAL_REGISTER' ||
                            c.verification_status === 'OFFICIAL_WEBSITE' ||
                            c.verification_status === 'MANUALLY_CONFIRMED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {c.verification_status}
                        </span>
                      </div>

                      <div className="text-base font-bold font-mono text-titanium-100 pt-1.5 flex items-center gap-2">
                        {c.normalized_value || c.contact_value}
                        <button
                          onClick={() => copyToClipboard(c.normalized_value || c.contact_value)}
                          className="text-titanium-500 hover:text-white"
                          title="Copiază în clipboard"
                        >
                          {copiedText === (c.normalized_value || c.contact_value) ? (
                            <Check className="w-3.5 h-3.5 text-radar-green" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {c.contact_person && (
                        <div className="text-xs text-titanium-300 pt-0.5">
                          Persoană de contact: <strong>{c.contact_person}</strong>{' '}
                          {c.contact_person_position && `(${c.contact_person_position})`}
                        </div>
                      )}

                      {c.notes && (
                        <div className="text-[11px] text-titanium-400 italic pt-0.5">{c.notes}</div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {c.contact_type.includes('PHONE') ||
                      c.contact_type === 'MOBILE' ||
                      c.contact_type === 'LANDLINE' ? (
                        <a
                          href={`tel:${c.normalized_value || c.contact_value}`}
                          className="p-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg border border-emerald-500/30 transition-colors"
                          title="Apelează telefonic"
                        >
                          <PhoneCall className="w-4 h-4" />
                        </a>
                      ) : null}

                      {c.contact_type.includes('EMAIL') ? (
                        <a
                          href={`mailto:${c.normalized_value || c.contact_value}`}
                          className="p-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg border border-purple-500/30 transition-colors"
                          title="Trimite Email"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                      ) : null}

                      {c.contact_type === 'WEBSITE' || c.contact_type === 'CONTACT_FORM' ? (
                        <a
                          href={
                            (c.normalized_value || c.contact_value).startsWith('http')
                              ? c.normalized_value || c.contact_value
                              : `https://${c.normalized_value || c.contact_value}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg border border-blue-500/30 transition-colors"
                          title="Deschide pagină"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-[10px] text-titanium-500 font-mono border-t border-titanium-850 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      Sursă: <span className="text-titanium-300">{c.source_name || 'Înregistrare Directă'}</span>
                      {c.provenance_url && (
                        <a
                          href={c.provenance_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5"
                        >
                          [URL Proveniență <ExternalLink className="w-2.5 h-2.5" />]
                        </a>
                      )}
                    </div>
                    <div>
                      Încredere: <span className="text-emerald-400">{Math.round((c.confidence_score || 0.8) * 100)}%</span>
                      {c.discovered_at && <span className="ml-2 text-titanium-600">{c.discovered_at.slice(0, 10)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Opportunities */}
      {activeTab === 'opportunities' && (
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-6">
          <div className="border-b border-titanium-800 pb-4">
            <h2 className="text-sm font-bold text-titanium-100 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-radar-green" />
              Oportunități de Asigurare Recomandate ({opportunities.length})
            </h2>
            <p className="text-xs text-titanium-400 mt-0.5">
              Recomandări determinate algoritmic pe baza codului CAEN și a profilului de risc operațional.
            </p>
          </div>

          <div className="space-y-4">
            {opportunities.map((opp: any) => (
              <div key={opp.id} className="p-5 bg-titanium-950 rounded-xl border border-titanium-800 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-base text-titanium-100">{opp.product_name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      opp.estimated_priority === 'URGENT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                      opp.estimated_priority === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                      'bg-titanium-800 text-titanium-400 border-titanium-700'
                    }`}>
                      {opp.estimated_priority}
                    </span>
                  </div>

                  {/* Opportunity Status Pill */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-titanium-400">Status Oportunitate:</span>
                    <select
                      value={opp.status || 'RECOMMENDED'}
                      onChange={(e) => handleUpdateOpportunityStatus(opp.id, e.target.value)}
                      className="bg-titanium-900 border border-titanium-700 text-titanium-200 text-xs px-2.5 py-1 rounded focus:outline-none"
                    >
                      <option value="RECOMMENDED">Recomandat (Prospectare)</option>
                      <option value="ACCEPTED">Acceptat de Client</option>
                      <option value="REJECTED">Respins de Client</option>
                      <option value="ALREADY_INSURED">Deja Asigurat la alt Broker</option>
                      <option value="POLICY_ISSUED">Poliță Emisă</option>
                    </select>
                  </div>
                </div>

                <div className="text-xs text-titanium-300">
                  <strong className="text-titanium-200">Rațiune Brokeraj:</strong> {opp.rationale}
                </div>

                <div className="p-3 bg-titanium-900 rounded-lg border border-titanium-800 text-xs space-y-1">
                  <div className="text-titanium-400 font-semibold text-[11px]">Întrebări Cheie pentru Calificare Vânzări:</div>
                  <div className="text-titanium-300">{opp.additional_info_needed}</div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-titanium-500 font-mono pt-1">
                  <span>Trigger: {opp.trigger_event}</span>
                  <span>Încredere Algoritm: {Math.round((opp.confidence_level || 0.8) * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Interaction Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-titanium-800 pb-4">
            <div>
              <h2 className="text-sm font-bold text-titanium-100 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                Jurnal Interacțiuni & Istoric Vânzări
              </h2>
              <p className="text-xs text-titanium-400 mt-0.5">
                Înregistrare durabilă a apelurilor, email-urilor, întâlnirilor și notițelor.
              </p>
            </div>
            <button
              onClick={() => setShowInteractionModal(true)}
              className="px-3.5 py-1.5 bg-radar-green text-titanium-950 font-bold text-xs rounded-lg hover:bg-emerald-400 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Adaugă Interacțiune
            </button>
          </div>

          {interactions.length === 0 ? (
            <div className="py-12 text-center text-xs text-titanium-500">
              Nu a fost înregistrată nicio interacțiune pentru această companie. Folosește butonul de mai sus pentru a loga primul apel sau notiță.
            </div>
          ) : (
            <div className="space-y-4">
              {interactions.map((it: any) => (
                <div key={it.id} className="p-4 bg-titanium-950 rounded-xl border border-titanium-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-titanium-800 text-titanium-200 border border-titanium-700">
                        {it.interaction_type}
                      </span>
                      <span className="text-xs font-semibold text-titanium-100">
                        {it.outcome}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-titanium-500">{it.created_at}</span>
                  </div>

                  <p className="text-xs text-titanium-300 whitespace-pre-wrap">{it.notes}</p>

                  {(it.contact_person || it.next_action || it.next_follow_up_date) && (
                    <div className="pt-2 border-t border-titanium-850 flex flex-wrap items-center gap-4 text-[11px] text-titanium-400 font-mono">
                      {it.contact_person && <span>👤 Persoană: {it.contact_person}</span>}
                      {it.next_action && <span>🎯 Acțiune: {it.next_action}</span>}
                      {it.next_follow_up_date && <span className="text-amber-400">📅 Follow-up: {it.next_follow_up_date}</span>}
                      <span className="ml-auto text-titanium-500">Resp: {it.user_responsible}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Tasks & Follow-ups */}
      {activeTab === 'tasks' && (
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-titanium-800 pb-4">
            <div>
              <h2 className="text-sm font-bold text-titanium-100 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Management Sarcini Follow-up
              </h2>
              <p className="text-xs text-titanium-400 mt-0.5">
                Sarcini programate pentru contactare, reluare discuții și trimitere oferte.
              </p>
            </div>
            <button
              onClick={() => setShowFollowUpModal(true)}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-titanium-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Programează Sarcină
            </button>
          </div>

          <div className="space-y-3">
            {followUps.length === 0 ? (
              <div className="py-12 text-center text-xs text-titanium-500">
                Nicio sarcină de follow-up programată.
              </div>
            ) : (
              followUps.map((task: any) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    task.status === 'COMPLETED'
                      ? 'bg-titanium-950/40 border-titanium-850 opacity-60'
                      : 'bg-titanium-950 border-titanium-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${task.status === 'COMPLETED' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span className="font-bold text-sm text-titanium-100">{task.title}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-titanium-800 text-titanium-400">
                        {task.priority}
                      </span>
                    </div>
                    {task.description && <p className="text-xs text-titanium-400">{task.description}</p>}
                    <div className="text-[11px] text-titanium-500 font-mono pt-1">
                      Termen: <strong className="text-amber-400">{task.due_date}</strong> • Creat de: {task.created_by}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {task.status !== 'COMPLETED' && (
                      <button
                        onClick={() => handleCompleteTask(task.id)}
                        className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Finalizează
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Legal & Activities */}
      {activeTab === 'legal' && (
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-6">
          <div className="border-b border-titanium-800 pb-4">
            <h2 className="text-sm font-bold text-titanium-100 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-titanium-400" />
              Identitate Juridică & Înregistrare Oficială
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-4">
              <div>
                <span className="text-titanium-500">Denumire Legală:</span>
                <div className="text-titanium-100 font-bold mt-0.5">{company.name}</div>
              </div>
              <div>
                <span className="text-titanium-500">Cod Unic de Înregistrare (CUI):</span>
                <div className="text-titanium-100 font-mono font-bold mt-0.5">{company.cui}</div>
              </div>
              <div>
                <span className="text-titanium-500">Număr Registrul Comerțului:</span>
                <div className="text-titanium-200 font-mono mt-0.5">{company.reg_com || 'Nespecificat'}</div>
              </div>
              <div>
                <span className="text-titanium-500">EUID:</span>
                <div className="text-titanium-200 font-mono mt-0.5">{company.euid || 'Nespecificat'}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-titanium-500">Data Înmatriculării:</span>
                <div className="text-titanium-200 font-mono mt-0.5">{company.incorporation_date || 'Nespecificat'}</div>
              </div>
              <div>
                <span className="text-titanium-500">Formă Juridică:</span>
                <div className="text-titanium-200 mt-0.5">{company.legal_form || 'SRL'}</div>
              </div>
              <div>
                <span className="text-titanium-500">Sediu Social / Adresă:</span>
                <div className="text-titanium-200 mt-0.5">
                  {company.county}, {company.city}, Str. {company.street || ''} {company.street_nr || ''} {company.address_details || ''}
                </div>
              </div>
            </div>
          </div>

          {/* CAEN Section */}
          <div className="pt-6 border-t border-titanium-800 space-y-3">
            <h3 className="text-xs font-bold text-titanium-300 uppercase tracking-wider">
              Clasificare Activități Economice (CAEN Rev.2)
            </h3>
            <div className="p-4 bg-titanium-950 rounded-xl border border-titanium-800 space-y-2">
              <div className="font-mono text-radar-green font-bold text-sm">
                CAEN Principal {company.primary_caen}
              </div>
              <div className="text-xs text-titanium-200">{company.caen_description}</div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {categories.map((c: string) => (
                  <span key={c} className="px-2 py-0.5 rounded text-[10px] font-bold bg-titanium-800 text-titanium-300 border border-titanium-700">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Înregistrează Interacțiune */}
      {showInteractionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-titanium-900 border border-titanium-700 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
              <h3 className="font-bold text-sm text-titanium-100 flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-radar-green" />
                Înregistrează Interacțiune CRM
              </h3>
              <button onClick={() => setShowInteractionModal(false)} className="text-titanium-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInteractionSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-titanium-400 block mb-1">Tip Interacțiune</label>
                  <select
                    value={interactionForm.interaction_type}
                    onChange={(e) => setInteractionForm(prev => ({ ...prev, interaction_type: e.target.value }))}
                    className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                  >
                    <option value="CALL_OUTGOING">Apel Ieșire (Broker -&gt; Client)</option>
                    <option value="CALL_INCOMING">Apel Intrare (Client -&gt; Broker)</option>
                    <option value="EMAIL_SENT">Email Trimis</option>
                    <option value="EMAIL_RECEIVED">Email Primit</option>
                    <option value="WHATSAPP">Mesaj WhatsApp</option>
                    <option value="MEETING">Întâlnire Fizică</option>
                    <option value="VIDEO_CALL">Video Call / Prezentare</option>
                    <option value="OFFER_SENT">Ofertă Trimisă</option>
                    <option value="NOTE">Notiță / Notificare Internă</option>
                  </select>
                </div>

                <div>
                  <label className="text-titanium-400 block mb-1">Rezultat</label>
                  <select
                    value={interactionForm.outcome}
                    onChange={(e) => setInteractionForm(prev => ({ ...prev, outcome: e.target.value }))}
                    className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                  >
                    <option value="REACHED_DECISION_MAKER">Contactat Decident (Administrator)</option>
                    <option value="NO_ANSWER">Nu a răspuns</option>
                    <option value="BUSY">Ocupat</option>
                    <option value="CALLBACK_REQUESTED">A solicitat revenire</option>
                    <option value="INTERESTED">Interesat de ofertă</option>
                    <option value="OFFER_REQUESTED">A cerut cotație preț</option>
                    <option value="MEETING_SCHEDULED">Întâlnire programată</option>
                    <option value="NOT_INTERESTED">Neinteresat</option>
                    <option value="CLOSED_WON">Contract Semnat</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-titanium-400 block mb-1">Persoană Contact / Funcție</label>
                <input
                  type="text"
                  placeholder="ex: Popescu Ion (Director General)"
                  value={interactionForm.contact_person}
                  onChange={(e) => setInteractionForm(prev => ({ ...prev, contact_person: e.target.value }))}
                  className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                />
              </div>

              <div>
                <label className="text-titanium-400 block mb-1">Notițe & Detalii Convorbire *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Notează punctele cheie discutate, cerințele clientului..."
                  value={interactionForm.notes}
                  onChange={(e) => setInteractionForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-titanium-400 block mb-1">Următoarea Acțiune</label>
                  <input
                    type="text"
                    placeholder="ex: Trimitere ofertă CAR"
                    value={interactionForm.next_action}
                    onChange={(e) => setInteractionForm(prev => ({ ...prev, next_action: e.target.value }))}
                    className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                  />
                </div>
                <div>
                  <label className="text-titanium-400 block mb-1">Dată Follow-up (Opțional)</label>
                  <input
                    type="date"
                    value={interactionForm.next_follow_up_date}
                    onChange={(e) => setInteractionForm(prev => ({ ...prev, next_follow_up_date: e.target.value }))}
                    className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowInteractionModal(false)}
                  className="px-4 py-2 bg-titanium-800 hover:bg-titanium-700 text-titanium-300 rounded font-semibold"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-radar-green hover:bg-emerald-400 text-titanium-950 rounded font-bold"
                >
                  Salvează Interacțiune
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Programează Follow-up */}
      {showFollowUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-titanium-900 border border-titanium-700 rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
              <h3 className="font-bold text-sm text-titanium-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                Programează Sarcină Follow-up
              </h3>
              <button onClick={() => setShowFollowUpModal(false)} className="text-titanium-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFollowUpSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-titanium-400 block mb-1">Titlu Sarcină *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Sunat pentru feedback ofertă CASCO"
                  value={followUpForm.title}
                  onChange={(e) => setFollowUpForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                />
              </div>

              <div>
                <label className="text-titanium-400 block mb-1">Descriere / Instrucțiuni</label>
                <textarea
                  rows={2}
                  placeholder="Detalii adiționale pentru convorbire..."
                  value={followUpForm.description}
                  onChange={(e) => setFollowUpForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-titanium-400 block mb-1">Dată Scadență *</label>
                  <input
                    type="date"
                    required
                    value={followUpForm.due_date}
                    onChange={(e) => setFollowUpForm(prev => ({ ...prev, due_date: e.target.value }))}
                    className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                  />
                </div>
                <div>
                  <label className="text-titanium-400 block mb-1">Prioritate</label>
                  <select
                    value={followUpForm.priority}
                    onChange={(e) => setFollowUpForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                  >
                    <option value="LOW">Scăzută</option>
                    <option value="MEDIUM">Medie</option>
                    <option value="HIGH">Ridicată</option>
                    <option value="URGENT">Urgentă</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="px-4 py-2 bg-titanium-800 hover:bg-titanium-700 text-titanium-300 rounded font-semibold"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-titanium-950 rounded font-bold"
                >
                  Salvează Sarcină
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Adaugă Contact */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-titanium-900 border border-titanium-700 rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
              <h3 className="font-bold text-sm text-titanium-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-radar-green" />
                Înregistrează Coordonată de Contact
              </h3>
              <button onClick={() => setShowContactModal(false)} className="text-titanium-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-titanium-400 block mb-1">Tip Contact *</label>
                  <select
                    value={contactForm.contact_type}
                    onChange={(e) => setContactForm(prev => ({ ...prev, contact_type: e.target.value }))}
                    className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                  >
                    <option value="MOBILE">Telefon Mobil</option>
                    <option value="LANDLINE">Telefon Fix</option>
                    <option value="MAIN_PHONE">Telefon Centrală</option>
                    <option value="GENERAL_EMAIL">Email General</option>
                    <option value="COMMERCIAL_EMAIL">Email Vânzări/Comercial</option>
                    <option value="WEBSITE">Website Oficial</option>
                    <option value="CONTACT_PERSON">Persoană de Contact</option>
                  </select>
                </div>
                <div>
                  <label className="text-titanium-400 block mb-1">Etichetă</label>
                  <input
                    type="text"
                    placeholder="ex: OFFICE, DIRECTOR, SECRETARIAT"
                    value={contactForm.label}
                    onChange={(e) => setContactForm(prev => ({ ...prev, label: e.target.value }))}
                    className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-titanium-400 block mb-1">Valoare Contact (Număr / Email / URL) *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: +40722123456 sau office@firma.ro"
                  value={contactForm.contact_value}
                  onChange={(e) => setContactForm(prev => ({ ...prev, contact_value: e.target.value }))}
                  className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-titanium-400 block mb-1">Persoană Contact</label>
                  <input
                    type="text"
                    placeholder="ex: Popescu Ion"
                    value={contactForm.contact_person}
                    onChange={(e) => setContactForm(prev => ({ ...prev, contact_person: e.target.value }))}
                    className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                  />
                </div>
                <div>
                  <label className="text-titanium-400 block mb-1">Funcție</label>
                  <input
                    type="text"
                    placeholder="ex: Administrator"
                    value={contactForm.contact_person_position}
                    onChange={(e) => setContactForm(prev => ({ ...prev, contact_person_position: e.target.value }))}
                    className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-titanium-400 block mb-1">Sursă Coordonată</label>
                  <select
                    value={contactForm.source_name}
                    onChange={(e) => setContactForm(prev => ({ ...prev, source_name: e.target.value }))}
                    className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                  >
                    <option value="DECLARATIE_CLIENT">Declarat Direct de Client</option>
                    <option value="ANAF_DECLARAT">Declarat la ANAF</option>
                    <option value="WEBSITE_OFICIAL">Website Oficial Companie</option>
                    <option value="ONRC_OFICIAL">Registrul Comerțului (ONRC)</option>
                    <option value="CONFIRMAT_MANUAL">Confirmat Telefonic Manual</option>
                  </select>
                </div>
                <div>
                  <label className="text-titanium-400 block mb-1">Statut Verificare</label>
                  <select
                    value={contactForm.verification_status}
                    onChange={(e) => setContactForm(prev => ({ ...prev, verification_status: e.target.value }))}
                    className="w-full bg-titanium-950 border border-titanium-700 rounded p-2 text-titanium-100"
                  >
                    <option value="MANUALLY_CONFIRMED">Confirmat Manual</option>
                    <option value="DECLARED_PUBLIC_REGISTER">Declarat în Registru Public</option>
                    <option value="WEBSITE_FOUND">Găsit pe Website Oficial</option>
                    <option value="FORMAT_VALIDATED_ONLY">Doar Format Validat</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="px-4 py-2 bg-titanium-800 hover:bg-titanium-700 text-titanium-300 rounded font-semibold"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-radar-green hover:bg-emerald-400 text-titanium-950 rounded font-bold"
                >
                  Salvează Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
