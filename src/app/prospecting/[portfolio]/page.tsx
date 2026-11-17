'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import {
  Search,
  Filter,
  Download,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Calendar,
  Clock,
  Clock3,
  ShieldCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  FileSpreadsheet,
  RefreshCw,
  X,
  PhoneOutgoing,
  SlidersHorizontal,
} from 'lucide-react';
import ProspectDossierDrawer from '@/components/ProspectDossierDrawer';
import {
  COMMERCIAL_STATUSES,
  CommercialStatusKey,
  PortfolioType,
  ProspectRecord,
} from '@/lib/prospecting-types';

interface PageProps {
  params?: { portfolio?: string };
}

function formatSafeDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('ro-RO');
  } catch {
    return '—';
  }
}

export default function ProspectingPortfolioPage({ params }: PageProps) {
  const routeParams = useParams();
  const rawPortfolio = (params?.portfolio || (routeParams?.portfolio as string) || '').toLowerCase();

  const isNiche = rawPortfolio === 'niche';
  const portfolioType: PortfolioType = isNiche ? 'NICHE_HORECA_AUTO_CONSTRUCT' : 'GENERAL';
  const title = isNiche
    ? 'Hoteluri, pensiuni, rent-a-car și construcții'
    : 'Prospectare Generală';
  const subtitle = isNiche
    ? 'Portofoliu nișat: 25 companii cu date complete de contact, flote auto și sugestii de asigurare'
    : 'Companii din servicii, sănătate, construcții, logistică, auto, IT și distribuție';
  const sourceBadge = isNiche
    ? 'Sursa: Pasted markdown (2).md (25 companii)'
    : 'Sursa: Pasted text.txt (304 firme)';

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ProspectRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CommercialStatusKey | ''>('');
  const [callbackFilter, setCallbackFilter] = useState<'' | 'today' | 'overdue' | 'week'>('');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [callbackCounts, setCallbackCounts] = useState<{ overdue: number; today: number; week: number }>({
    overdue: 0,
    today: 0,
    week: 0,
  });

  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchProspects = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('portfolio', portfolioType);
      q.set('page', String(page));
      q.set('limit', '50');
      if (search.trim()) q.set('search', search.trim());
      if (statusFilter) q.set('status', statusFilter);
      if (callbackFilter) q.set('callback_filter', callbackFilter);

      const res = await fetch(`/api/prospecting?${q.toString()}`);
      const json = await res.json();
      if (json.success) {
        setRecords(json.data || []);
        setTotal(json.pagination.total || 0);
        setTotalPages(json.pagination.totalPages || 1);
        setStatusCounts(json.status_counts || {});
        setCallbackCounts(json.callback_counts || { overdue: 0, today: 0, week: 0 });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, [portfolioType, page, statusFilter, callbackFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProspects();
  };

  const handleExportCsv = () => {
    window.location.href = `/api/prospecting/export?portfolio=${portfolioType}`;
  };

  const openDossier = (id: string) => {
    setSelectedProspectId(id);
    setDrawerOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* 1. TOP HEADER */}
      <header className="p-4 sm:p-6 border-b border-titanium-800 bg-titanium-900/60 backdrop-blur sticky top-14 lg:top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-titanium-800 text-titanium-300 border border-titanium-700">
                {sourceBadge}
              </span>
              <span className="text-xs text-titanium-400 font-mono">
                Total: <strong className="text-radar-green">{total}</strong> firme
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-titanium-100 mt-1">{title}</h1>
            <p className="text-xs text-titanium-400 mt-0.5 line-clamp-2 sm:line-clamp-none">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={fetchProspects}
              className="p-2 rounded-lg bg-titanium-800 hover:bg-titanium-750 text-titanium-300 border border-titanium-700 transition"
              title="Reîmprospătează lista"
              aria-label="Reîmprospătează lista"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-titanium-800 hover:bg-titanium-750 text-titanium-100 border border-titanium-700 rounded-lg text-xs font-semibold transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Quick Callback Filter Badges */}
        <div className="flex items-center gap-2 mt-3 sm:mt-4 pt-3 border-t border-titanium-800 overflow-x-auto text-xs pb-1 scrollbar-none">
          <span className="text-titanium-400 font-medium text-[11px] uppercase tracking-wider shrink-0">
            Programări apeluri:
          </span>
          <button
            type="button"
            onClick={() => {
              setCallbackFilter(callbackFilter === 'overdue' ? '' : 'overdue');
              setPage(1);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition shrink-0 min-h-[30px] ${
              callbackFilter === 'overdue'
                ? 'bg-rose-900/60 text-rose-200 border-rose-600'
                : 'bg-titanium-850 text-rose-400 border-rose-900/50 hover:bg-titanium-800'
            }`}
          >
            <Clock3 className="w-3 h-3" />
            Restante: <strong>{callbackCounts.overdue}</strong>
          </button>
          <button
            type="button"
            onClick={() => {
              setCallbackFilter(callbackFilter === 'today' ? '' : 'today');
              setPage(1);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition shrink-0 min-h-[30px] ${
              callbackFilter === 'today'
                ? 'bg-amber-900/60 text-amber-200 border-amber-500'
                : 'bg-titanium-850 text-amber-300 border-amber-900/50 hover:bg-titanium-800'
            }`}
          >
            <Calendar className="w-3 h-3" />
            Astăzi: <strong>{callbackCounts.today}</strong>
          </button>
          <button
            type="button"
            onClick={() => {
              setCallbackFilter(callbackFilter === 'week' ? '' : 'week');
              setPage(1);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition shrink-0 min-h-[30px] ${
              callbackFilter === 'week'
                ? 'bg-sky-900/60 text-sky-200 border-sky-500'
                : 'bg-titanium-850 text-sky-300 border-sky-900/50 hover:bg-titanium-800'
            }`}
          >
            <Clock className="w-3 h-3" />
            Săptămâna aceasta: <strong>{callbackCounts.week}</strong>
          </button>
          {callbackFilter && (
            <button
              type="button"
              onClick={() => {
                setCallbackFilter('');
                setPage(1);
              }}
              className="text-[11px] text-titanium-400 hover:text-white flex items-center gap-0.5 ml-2 shrink-0 py-1"
            >
              <X className="w-3 h-3" /> Resetează filtru
            </button>
          )}
        </div>
      </header>

      {/* 2. FILTER AND SEARCH BAR */}
      <div className="p-3.5 sm:p-5 border-b border-titanium-800 bg-titanium-900/30">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-titanium-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută după nume firmă, oraș, domeniu, telefon, email sau CUI..."
              className="w-full bg-titanium-900 border border-titanium-700 text-titanium-100 rounded-lg pl-9 pr-20 py-2.5 text-xs focus:ring-1 focus:ring-radar-green"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-titanium-800 text-titanium-200 hover:text-white text-[11px] font-medium rounded border border-titanium-700"
            >
              Caută
            </button>
          </form>

          <div className="w-full sm:w-72">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="w-full bg-titanium-900 border border-titanium-700 text-titanium-100 rounded-lg px-3 py-2.5 text-xs font-medium focus:ring-1 focus:ring-radar-green truncate"
            >
              <option value="">Toate cele 17 statute comerciale ({total})</option>
              {Object.values(COMMERCIAL_STATUSES).map((st) => (
                <option key={st.key} value={st.key}>
                  {st.label} ({statusCounts[st.key] || 0})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. CONTENT AREA */}
      <div className="flex-1 p-3.5 sm:p-5">
        {loading && records.length === 0 ? (
          <div className="p-12 text-center text-titanium-400 text-xs">
            <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-radar-green" />
            Se încarcă lista de prospectare...
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-titanium-400 text-xs border border-dashed border-titanium-800 rounded-xl">
            <Building2 className="w-8 h-8 text-titanium-600 mx-auto mb-2" />
            Nicio firmă găsită conform filtrelor selectate.
          </div>
        ) : (
          <>
            {/* A. MOBILE CARDS VIEW (< 1024px) */}
            <div className="block lg:hidden space-y-3">
              {records.map((r, idx) => {
                const statusDef = COMMERCIAL_STATUSES[r.commercial_status];
                const isOverdue =
                  r.next_callback_date &&
                  new Date(r.next_callback_date) < new Date() &&
                  !['CLOSED_WON_POLICY_ISSUED', 'CLOSED_LOST_DEFINITIVE_REFUSAL'].includes(r.commercial_status);

                return (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl bg-titanium-900/80 border border-titanium-800 hover:border-titanium-700 transition space-y-3 shadow-sm"
                  >
                    {/* Header Row: Number + Company Name + Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-titanium-500">
                            #{r.source_row_index || idx + 1}
                          </span>
                          <span
                            onClick={() => openDossier(r.id)}
                            className="font-bold text-titanium-100 hover:text-radar-green transition text-sm cursor-pointer"
                          >
                            {r.company_name}
                          </span>
                        </div>
                        {r.domain && (
                          <div className="text-xs text-titanium-400 mt-0.5 truncate">
                            {r.domain}
                          </div>
                        )}
                      </div>

                      <span
                        className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded border shrink-0 ${
                          statusDef?.badgeClass || 'bg-titanium-800 text-titanium-300'
                        }`}
                      >
                        {statusDef?.label || r.commercial_status}
                      </span>
                    </div>

                    {/* Metadata & Badges */}
                    <div className="flex items-center gap-2 flex-wrap text-xs text-titanium-400">
                      {(r.city || r.county) && (
                        <div className="flex items-center gap-1 text-titanium-300">
                          <MapPin className="w-3 h-3 text-titanium-500 shrink-0" />
                          <span>{[r.city, r.county].filter(Boolean).join(', ')}</span>
                        </div>
                      )}
                      {r.cui && (
                        <span className="font-mono text-[11px] text-titanium-400">
                          CUI: {r.cui} {r.reg_com && `• ${r.reg_com}`}
                        </span>
                      )}
                      {r.is_incomplete === 1 && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                          Date incomplete
                        </span>
                      )}
                      {r.matched_cui && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                          CUI {r.matched_cui} verificat
                        </span>
                      )}
                    </div>

                    {/* Direct Contacts Row */}
                    <div className="space-y-1.5 pt-1 border-t border-titanium-800/60">
                      {r.phones && r.phones.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {r.phones.map((p, pIdx) => (
                            <a
                              key={pIdx}
                              href={`tel:${p.replace(/\s+/g, '')}`}
                              className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-radar-green bg-titanium-950 px-2.5 py-1 rounded-lg border border-titanium-800 active:scale-95 transition"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{p}</span>
                            </a>
                          ))}
                        </div>
                      ) : null}

                      {r.emails && r.emails.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {r.emails.map((e, eIdx) => (
                            <a
                              key={eIdx}
                              href={`mailto:${e}`}
                              className="inline-flex items-center gap-1.5 text-xs font-mono text-titanium-300 hover:text-radar-green bg-titanium-950 px-2.5 py-1 rounded-lg border border-titanium-800 truncate max-w-full"
                            >
                              <Mail className="w-3 h-3 text-titanium-400 shrink-0" />
                              <span className="truncate">{e}</span>
                            </a>
                          ))}
                        </div>
                      ) : null}

                      {(!r.phones || r.phones.length === 0) && (!r.emails || r.emails.length === 0) && (
                        <span className="text-titanium-500 italic text-xs">Fără date directe de contact</span>
                      )}
                    </div>

                    {/* Follow-up / Discussions & Dossier Action */}
                    <div className="pt-2 border-t border-titanium-800 flex items-center justify-between gap-2">
                      <div className="text-xs">
                        {r.next_callback_date ? (
                          <div
                            className={`flex items-center gap-1 text-xs ${
                              isOverdue ? 'text-rose-400 font-semibold' : 'text-amber-300'
                            }`}
                          >
                            <Clock3 className="w-3 h-3" />
                            <span>{formatSafeDate(r.next_callback_date)}</span>
                          </div>
                        ) : (
                          <div className="text-titanium-500 flex items-center gap-1 text-[11px]">
                            <MessageSquare className="w-3 h-3 text-titanium-600" />
                            <span>{r.discussions_count || 0} discuții</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => openDossier(r.id)}
                        className="px-3 py-1.5 bg-titanium-800 hover:bg-radar-emerald/20 hover:text-radar-green border border-titanium-700 hover:border-radar-emerald/40 text-titanium-200 rounded-lg text-xs font-semibold transition"
                      >
                        Dosar CRM
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* B. DESKTOP TABLE VIEW (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto rounded-xl border border-titanium-800 bg-titanium-900/40">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-titanium-800 bg-titanium-900/90 text-[11px] font-semibold text-titanium-400 uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Companie & Profil</th>
                    <th className="py-3 px-4">Localizare</th>
                    <th className="py-3 px-4">Contacte Directe</th>
                    <th className="py-3 px-4">Statut Comercial</th>
                    <th className="py-3 px-4">Revenire / Discuții</th>
                    <th className="py-3 px-4 text-right">Dosar CRM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-titanium-800/60">
                  {records.map((r, idx) => {
                    const statusDef = COMMERCIAL_STATUSES[r.commercial_status];
                    const isOverdue =
                      r.next_callback_date &&
                      new Date(r.next_callback_date) < new Date() &&
                      !['CLOSED_WON_POLICY_ISSUED', 'CLOSED_LOST_DEFINITIVE_REFUSAL'].includes(r.commercial_status);

                    return (
                      <tr
                        key={r.id}
                        onClick={() => openDossier(r.id)}
                        className="hover:bg-titanium-850/70 transition cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 text-center font-mono text-[11px] text-titanium-500">
                          {r.source_row_index || idx + 1}
                        </td>

                        {/* Company Name & Badges */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-semibold text-titanium-100 group-hover:text-radar-green transition flex items-center gap-1.5 flex-wrap">
                            <span>{r.company_name}</span>
                            {r.is_incomplete === 1 && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                                Date incomplete
                              </span>
                            )}
                            {r.matched_cui && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                                Verificat CUI {r.matched_cui}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-titanium-400 mt-0.5 truncate">
                            {r.domain || 'Domeniu nespecificat'}
                          </div>
                          {r.cui && (
                            <div className="text-[10px] font-mono text-titanium-400 mt-0.5">
                              CUI: {r.cui} {r.reg_com && `• ${r.reg_com}`}
                            </div>
                          )}
                        </td>

                        {/* Location */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-titanium-300">
                          {r.city || r.county ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-titanium-500 shrink-0" />
                              <span>{[r.city, r.county].filter(Boolean).join(', ')}</span>
                            </div>
                          ) : (
                            <span className="text-titanium-500 italic">—</span>
                          )}
                        </td>

                        {/* Contacts */}
                        <td className="py-3.5 px-4 max-w-xs" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1">
                            {r.phones && r.phones.length > 0 ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {r.phones.slice(0, 2).map((p, pIdx) => (
                                  <a
                                    key={pIdx}
                                    href={`tel:${p.replace(/\s+/g, '')}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-mono text-radar-green hover:underline bg-titanium-950 px-1.5 py-0.5 rounded border border-titanium-800"
                                  >
                                    <Phone className="w-2.5 h-2.5" />
                                    {p}
                                  </a>
                                ))}
                                {r.phones.length > 2 && (
                                  <span className="text-[10px] text-titanium-400">+{r.phones.length - 2}</span>
                                )}
                              </div>
                            ) : null}

                            {r.emails && r.emails.length > 0 ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {r.emails.slice(0, 2).map((e, eIdx) => (
                                  <a
                                    key={eIdx}
                                    href={`mailto:${e}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-mono text-titanium-300 hover:text-radar-green hover:underline bg-titanium-950 px-1.5 py-0.5 rounded border border-titanium-800 truncate max-w-[170px]"
                                    title={e}
                                  >
                                    <Mail className="w-2.5 h-2.5 text-titanium-400" />
                                    {e}
                                  </a>
                                ))}
                              </div>
                            ) : null}

                            {(!r.phones || r.phones.length === 0) && (!r.emails || r.emails.length === 0) && (
                              <span className="text-titanium-500 italic text-[11px]">Fără contacte directe</span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded border ${
                              statusDef?.badgeClass || 'bg-titanium-800 text-titanium-300'
                            }`}
                          >
                            {statusDef?.label || r.commercial_status}
                          </span>
                        </td>

                        {/* Next Callback & History */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {r.next_callback_date ? (
                            <div className="space-y-0.5">
                              <div
                                className={`text-[11px] font-medium flex items-center gap-1 ${
                                  isOverdue ? 'text-rose-400 font-semibold' : 'text-amber-300'
                                }`}
                              >
                                <Clock3 className="w-3 h-3" />
                                {formatSafeDate(r.next_callback_date)}
                              </div>
                              {r.next_action && (
                                <div className="text-[10px] text-titanium-400 max-w-[140px] truncate" title={r.next_action}>
                                  {r.next_action}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-titanium-500 flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-titanium-600" />
                              <span>{r.discussions_count || 0} discuții</span>
                            </div>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openDossier(r.id)}
                            className="px-2.5 py-1 bg-titanium-800 hover:bg-radar-emerald/20 hover:text-radar-green border border-titanium-700 hover:border-radar-emerald/40 text-titanium-200 rounded text-xs font-medium transition"
                          >
                            Dosar CRM
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 4. PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 text-xs text-titanium-400">
            <div>
              Pagina <strong className="text-titanium-200">{page}</strong> din{' '}
              <strong className="text-titanium-200">{totalPages}</strong> ({total} înregistrări)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-titanium-900 border border-titanium-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-titanium-800 text-titanium-200 transition flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-titanium-900 border border-titanium-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-titanium-800 text-titanium-200 transition flex items-center gap-1"
              >
                <span>Următor</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. INDIVIDUAL CRM DOSSIER DRAWER */}
      <ProspectDossierDrawer
        prospectId={selectedProspectId}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRecordUpdated={fetchProspects}
      />
    </div>
  );
}
