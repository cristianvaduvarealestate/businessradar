'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  PhoneCall,
  Calendar,
  Filter,
  ArrowRight,
  UserCheck,
  FileText,
  Search,
  ChevronRight,
  AlertTriangle,
  Award,
  Check,
  RefreshCw,
  Kanban,
  List,
  Plus,
  Phone,
  Mail,
  Building2,
  ArrowLeft,
  XCircle,
} from 'lucide-react';

const KANBAN_STAGES = [
  { id: 'NEW', label: 'Nou', color: 'border-titanium-700 bg-titanium-900/60' },
  { id: 'TO_CONTACT', label: 'De contactat', color: 'border-blue-500/50 bg-blue-950/20' },
  { id: 'CONTACTED', label: 'Contactat', color: 'border-cyan-500/50 bg-cyan-950/20' },
  { id: 'IN_DISCUSSION', label: 'În discuție', color: 'border-purple-500/50 bg-purple-950/20' },
  { id: 'INTERESTED', label: 'Interesat', color: 'border-radar-green/50 bg-radar-emerald/10' },
  { id: 'OFFER_SENT', label: 'Ofertă transmisă', color: 'border-violet-500/50 bg-violet-950/20' },
  { id: 'CLIENT_WON', label: 'Client câștigat', color: 'border-emerald-500/50 bg-emerald-950/30' },
  { id: 'LOST', label: 'Pierdut', color: 'border-rose-500/50 bg-rose-950/20' },
];

const ALL_CRM_STAGES = [
  { id: 'ALL', label: 'Toate Etapele' },
  { id: 'NEW', label: 'Nou' },
  { id: 'TO_CONTACT', label: 'De contactat' },
  { id: 'CONTACTED', label: 'Contactat' },
  { id: 'NO_ANSWER', label: 'Nu a răspuns' },
  { id: 'CALLBACK_REQUESTED', label: 'Revine' },
  { id: 'FOLLOW_UP_SCHEDULED', label: 'Follow-up programat' },
  { id: 'IN_DISCUSSION', label: 'În discuție' },
  { id: 'INTERESTED', label: 'Interesat' },
  { id: 'OFFER_REQUESTED', label: 'Ofertă solicitată' },
  { id: 'OFFER_SENT', label: 'Ofertă transmisă' },
  { id: 'NEGOTIATION', label: 'Negociere' },
  { id: 'CLIENT_WON', label: 'Client câștigat' },
  { id: 'LOST', label: 'Pierdut' },
  { id: 'NOT_INTERESTED', label: 'Nu este interesat' },
  { id: 'DO_NOT_CONTACT', label: 'Nu contacta' },
];

function PipelineContent() {
  const searchParams = useSearchParams();
  const initialView = searchParams?.get('view') || 'kanban';
  const initialStage = searchParams?.get('stage') || 'ALL';
  const initialFilter = searchParams?.get('filter') || 'today';

  const [viewMode, setViewMode] = useState<'kanban' | 'followups' | 'list'>(
    initialView === 'followups' ? 'followups' : initialView === 'list' ? 'list' : 'kanban'
  );

  const [items, setItems] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<any[]>([]);
  const [selectedStage, setSelectedStage] = useState(initialStage);
  const [countyFilter, setCountyFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Follow-ups state
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [followUpFilter, setFollowUpFilter] = useState(initialFilter);
  const [followUpCounts, setFollowUpCounts] = useState<any>({});
  const [followUpsLoading, setFollowUpsLoading] = useState(false);

  const fetchPipeline = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedStage && selectedStage !== 'ALL') params.set('stage', selectedStage);
      if (countyFilter) params.set('county', countyFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      params.set('limit', '300');

      const res = await fetch(`/api/pipeline?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.data) {
        setItems(data.data.items || []);
        setStatusCounts(data.data.statusCounts || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowUps = async () => {
    setFollowUpsLoading(true);
    try {
      const res = await fetch(`/api/crm/follow-ups?filter=${followUpFilter}`);
      const data = await res.json();
      if (data.success && data.data) {
        setFollowUps(data.data.items || []);
        setFollowUpCounts(data.data.counts || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFollowUpsLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
  }, [selectedStage, countyFilter, priorityFilter]);

  useEffect(() => {
    if (viewMode === 'followups') {
      fetchFollowUps();
    }
  }, [viewMode, followUpFilter]);

  const handleUpdateStatus = async (cui: number, newStatus: string) => {
    // Optimistic UI update
    setItems((prev) =>
      prev.map((item) => (item.cui === cui ? { ...item, status: newStatus } : item))
    );

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cui, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPipeline();
      }
    } catch (err) {
      console.error(err);
      fetchPipeline();
    }
  };

  const handleCompleteFollowUp = async (id: number) => {
    try {
      await fetch('/api/crm/follow-ups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'COMPLETED' }),
      });
      fetchFollowUps();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSnoozeFollowUp = async (id: number, days: number) => {
    const nextDate = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    try {
      await fetch('/api/crm/follow-ups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'SNOOZED', due_date: nextDate, notes: `+${days} zile` }),
      });
      fetchFollowUps();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.company_name?.toLowerCase().includes(q) ||
      String(item.cui).includes(q) ||
      item.city?.toLowerCase().includes(q) ||
      item.county?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-titanium-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
            <TrendingUp className="w-4 h-4" />
            CRM B2B & Prospectare Vânzări Asigurări
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-titanium-100 tracking-tight">
            Pipeline & Urmărire Oportunități
          </h1>
          <p className="text-xs text-titanium-400 mt-1">
            Gestionează relațiile cu firmele românești, etapele de calificare, contactările și sarcinile de follow-up.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 bg-titanium-900 p-1 rounded-xl border border-titanium-800 self-start md:self-auto">
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              viewMode === 'kanban'
                ? 'bg-titanium-800 text-radar-green border border-radar-green/30 shadow-sm'
                : 'text-titanium-400 hover:text-white'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            Tablă Kanban
          </button>

          <button
            onClick={() => setViewMode('followups')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              viewMode === 'followups'
                ? 'bg-titanium-800 text-amber-400 border border-amber-400/30 shadow-sm'
                : 'text-titanium-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Centru Follow-Up
            {followUpCounts.today_count > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-titanium-950">
                {followUpCounts.today_count}
              </span>
            )}
          </button>

          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              viewMode === 'list'
                ? 'bg-titanium-800 text-cyan-400 border border-cyan-400/30 shadow-sm'
                : 'text-titanium-400 hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Listă Filtrare ({items.length})
          </button>
        </div>
      </div>

      {/* FILTER BAR (Active on List & Kanban) */}
      {viewMode !== 'followups' && (
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[200px] flex-1 md:flex-none">
              <Search className="w-3.5 h-3.5 text-titanium-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Caută în pipeline (Nume, CUI, Oraș)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-titanium-950 border border-titanium-700 rounded-lg pl-8 pr-3 py-1.5 text-titanium-100 placeholder-titanium-500 focus:outline-none focus:border-radar-green"
              />
            </div>

            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="bg-titanium-950 border border-titanium-700 text-titanium-200 px-3 py-1.5 rounded-lg focus:outline-none focus:border-radar-green"
            >
              {ALL_CRM_STAGES.map((s) => {
                const count = statusCounts.find((sc) => sc.status === s.id)?.count;
                return (
                  <option key={s.id} value={s.id}>
                    {s.label} {count !== undefined ? `(${count})` : ''}
                  </option>
                );
              })}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-titanium-950 border border-titanium-700 text-titanium-200 px-3 py-1.5 rounded-lg focus:outline-none focus:border-radar-green"
            >
              <option value="">Toate prioritățile</option>
              <option value="URGENT">Doar URGENT</option>
              <option value="HIGH">Doar HIGH</option>
              <option value="STANDARD">Doar STANDARD</option>
            </select>
          </div>

          <button
            onClick={() => {
              setSelectedStage('ALL');
              setPriorityFilter('');
              setCountyFilter('');
              setSearchQuery('');
            }}
            className="text-xs text-titanium-400 hover:text-white flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Resetează filtre
          </button>
        </div>
      )}

      {/* VIEW 1: KANBAN BOARD */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1400px]">
            {KANBAN_STAGES.map((stage) => {
              const stageItems = filteredItems.filter((i) => i.status === stage.id);
              const stageCount = statusCounts.find((sc) => sc.status === stage.id)?.count || stageItems.length;

              return (
                <div
                  key={stage.id}
                  className={`flex-1 rounded-xl border flex flex-col max-h-[750px] shadow-sm ${stage.color}`}
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-titanium-800 flex items-center justify-between">
                    <span className="font-bold text-xs text-titanium-100 uppercase tracking-wider">
                      {stage.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-titanium-800 text-titanium-300">
                      {stageCount}
                    </span>
                  </div>

                  {/* Card Feed */}
                  <div className="p-3 space-y-3 overflow-y-auto flex-1 divide-y divide-transparent">
                    {loading ? (
                      <div className="text-center py-8 text-titanium-500 text-xs font-mono">
                        Se încarcă...
                      </div>
                    ) : stageItems.length === 0 ? (
                      <div className="text-center py-10 text-titanium-500 text-xs italic">
                        Nicio companie în această etapă.
                      </div>
                    ) : (
                      stageItems.map((item) => (
                        <div
                          key={item.cui}
                          className="p-3.5 bg-titanium-950 border border-titanium-800 rounded-xl space-y-2 hover:border-titanium-700 transition-all shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/companies/${item.cui}`}
                              className="font-bold text-xs text-titanium-100 hover:text-radar-green transition-colors line-clamp-1"
                              title={item.company_name}
                            >
                              {item.company_name}
                            </Link>
                            <span
                              className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                item.priority === 'URGENT'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : item.priority === 'HIGH'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-titanium-800 text-titanium-400'
                              }`}
                            >
                              {item.priority}
                            </span>
                          </div>

                          <div className="text-[11px] text-titanium-400 font-mono">
                            CUI {item.cui} • {item.county || 'România'}
                          </div>

                          <div className="text-[10px] text-titanium-500 truncate" title={item.caen_description}>
                            CAEN {item.primary_caen}: {item.caen_description}
                          </div>

                          {item.next_follow_up_date && (
                            <div className="text-[10px] text-amber-400 font-mono flex items-center gap-1 pt-1">
                              <Calendar className="w-3 h-3" />
                              Follow-up: {item.next_follow_up_date}
                            </div>
                          )}

                          {item.notes && (
                            <div className="text-[11px] text-titanium-300 italic bg-titanium-900/80 p-2 rounded border border-titanium-850 line-clamp-2">
                              "{item.notes}"
                            </div>
                          )}

                          {/* Quick Stage Move Dropdown */}
                          <div className="pt-2 border-t border-titanium-850 flex items-center justify-between text-[11px]">
                            <select
                              value={item.status}
                              onChange={(e) => handleUpdateStatus(item.cui, e.target.value)}
                              className="bg-titanium-900 border border-titanium-750 text-titanium-300 text-[10px] px-2 py-1 rounded focus:outline-none focus:border-radar-green"
                            >
                              {ALL_CRM_STAGES.filter((s) => s.id !== 'ALL').map((s) => (
                                <option key={s.id} value={s.id}>
                                  Mută: {s.label}
                                </option>
                              ))}
                            </select>

                            <Link
                              href={`/companies/${item.cui}`}
                              className="text-titanium-400 hover:text-white flex items-center gap-0.5"
                            >
                              Dosar
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: FOLLOW-UP CENTER */}
      {viewMode === 'followups' && (
        <div className="space-y-6">
          {/* Follow-up Sub-filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'today', label: 'Scadente Astăzi', count: followUpCounts.today_count || 0, color: 'text-amber-400' },
              { id: 'overdue', label: 'Restante / Întârziate', count: followUpCounts.overdue_count || 0, color: 'text-rose-400' },
              { id: 'upcoming', label: 'Viitoare', count: followUpCounts.upcoming_count || 0, color: 'text-cyan-400' },
              { id: 'completed', label: 'Finalizate', count: followUpCounts.completed_count || 0, color: 'text-emerald-400' },
              { id: 'all', label: 'Toate Sarcinile', count: followUpCounts.total_pending || 0, color: 'text-titanium-200' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setFollowUpFilter(p.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-colors ${
                  followUpFilter === p.id
                    ? 'bg-titanium-800 border-white text-white shadow-sm'
                    : 'bg-titanium-900 border-titanium-800 text-titanium-400 hover:text-white'
                }`}
              >
                <span>{p.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-titanium-950 ${p.color}`}>
                  {p.count}
                </span>
              </button>
            ))}
          </div>

          {/* Follow-up Tasks List */}
          <div className="bg-titanium-900 border border-titanium-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-titanium-850 border-b border-titanium-800 flex items-center justify-between text-xs font-bold text-titanium-300 uppercase tracking-wider">
              <span>Sarcină & Detalii Companie</span>
              <span>Acțiuni & Finalizare</span>
            </div>

            <div className="divide-y divide-titanium-800">
              {followUpsLoading ? (
                <div className="py-12 text-center text-titanium-500 font-mono text-xs">
                  Se încarcă sarcinile din baza D1...
                </div>
              ) : followUps.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <Clock className="w-8 h-8 text-titanium-600 mx-auto" />
                  <div className="text-xs text-titanium-400 font-semibold">
                    Nu există sarcini în această categorie.
                  </div>
                  <p className="text-[11px] text-titanium-500">
                    Programează un follow-up direct din profilul oricărei companii sau după înregistrarea unui apel.
                  </p>
                </div>
              ) : (
                followUps.map((task: any) => (
                  <div
                    key={task.id}
                    className="p-4 hover:bg-titanium-850/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${task.status === 'COMPLETED' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span className="font-bold text-sm text-titanium-100">{task.title}</span>
                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                          {task.due_date}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-titanium-400">
                        <Link
                          href={`/companies/${task.cui}`}
                          className="font-semibold text-radar-green hover:underline flex items-center gap-1"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          {task.company_name} (CUI {task.cui})
                        </Link>
                        <span>•</span>
                        <span>📍 {task.county}, {task.city}</span>
                        <span>•</span>
                        <span>CAEN {task.primary_caen}</span>
                      </div>

                      {task.description && (
                        <p className="text-xs text-titanium-300 italic pt-0.5">"{task.description}"</p>
                      )}
                    </div>

                    {/* Follow-up Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {task.status !== 'COMPLETED' ? (
                        <>
                          <button
                            onClick={() => handleCompleteFollowUp(task.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Finalizat
                          </button>

                          <div className="flex items-center bg-titanium-950 border border-titanium-700 rounded-lg overflow-hidden text-xs">
                            <span className="px-2 text-[10px] text-titanium-500">Amână:</span>
                            <button
                              onClick={() => handleSnoozeFollowUp(task.id, 1)}
                              className="px-2 py-1 text-titanium-300 hover:text-white hover:bg-titanium-800 border-l border-titanium-800"
                              title="+1 zi"
                            >
                              +1z
                            </button>
                            <button
                              onClick={() => handleSnoozeFollowUp(task.id, 3)}
                              className="px-2 py-1 text-titanium-300 hover:text-white hover:bg-titanium-800 border-l border-titanium-800"
                              title="+3 zile"
                            >
                              +3z
                            </button>
                            <button
                              onClick={() => handleSnoozeFollowUp(task.id, 7)}
                              className="px-2 py-1 text-titanium-300 hover:text-white hover:bg-titanium-800 border-l border-titanium-800"
                              title="+1 săptămână"
                            >
                              +7z
                            </button>
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Finalizat {task.completed_at?.slice(0, 10)}
                        </span>
                      )}

                      <Link
                        href={`/companies/${task.cui}`}
                        className="px-3 py-1.5 bg-titanium-800 hover:bg-titanium-700 text-titanium-200 rounded-lg text-xs border border-titanium-700 transition-colors"
                      >
                        Deschide Dosar
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: ADVANCED FILTER LIST */}
      {viewMode === 'list' && (
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 bg-titanium-850 border-b border-titanium-800 flex items-center justify-between text-xs font-bold text-titanium-300 uppercase tracking-wider">
            <span>Companie & Industrie</span>
            <span>Etapă Curentă & Acțiuni</span>
          </div>

          <div className="divide-y divide-titanium-800">
            {loading ? (
              <div className="py-12 text-center text-titanium-500 font-mono text-xs">
                Se încarcă lista de companii din pipeline...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-12 text-center text-titanium-500 text-xs">
                Nicio companie găsită conform filtrelor selectate.
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.cui}
                  className="p-4 hover:bg-titanium-850/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/companies/${item.cui}`}
                        className="font-bold text-sm text-titanium-100 hover:text-radar-green"
                      >
                        {item.company_name}
                      </Link>
                      <span className="font-mono text-xs text-titanium-400">(CUI {item.cui})</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          item.priority === 'URGENT'
                            ? 'bg-rose-500/20 text-rose-400'
                            : item.priority === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-titanium-800 text-titanium-400'
                        }`}
                      >
                        {item.priority}
                      </span>
                    </div>

                    <div className="text-xs text-titanium-400">
                      📍 {item.county || 'România'}, {item.city || ''} • 🏷️ CAEN {item.primary_caen}: {item.caen_description}
                    </div>

                    {item.notes && (
                      <div className="text-[11px] text-titanium-300 italic pt-1">
                        "{item.notes}"
                      </div>
                    )}
                  </div>

                  {/* Status Switcher & Link */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={item.status}
                      onChange={(e) => handleUpdateStatus(item.cui, e.target.value)}
                      className="bg-titanium-950 border border-titanium-700 text-titanium-200 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-radar-green"
                    >
                      {ALL_CRM_STAGES.filter((s) => s.id !== 'ALL').map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>

                    <Link
                      href={`/companies/${item.cui}`}
                      className="px-2.5 py-1.5 bg-titanium-800 hover:bg-titanium-700 text-titanium-200 rounded text-xs border border-titanium-700 transition-colors"
                    >
                      Dosar
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default function PipelinePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      }
    >
      <PipelineContent />
    </Suspense>
  );
}
