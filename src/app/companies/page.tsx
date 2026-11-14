'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  Download,
  Building2,
  Globe,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  CheckCircle2,
} from 'lucide-react';

export default function CompaniesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Filters
  const [query, setQuery] = useState('');
  const [county, setCounty] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');

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
      if (status) params.set('status', status);

      const res = await fetch(`/api/companies?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.data.items);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies(1);
  }, [county, priority, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCompanies(1);
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (county) params.set('county', county);
    if (priority) params.set('priority', priority);
    window.open(`/api/export?${params.toString()}`, '_blank');
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-titanium-800 pb-5">
        <div>
          <div className="text-xs font-semibold text-titanium-400 uppercase tracking-wider">
            Baza Națională de Date
          </div>
          <h1 className="text-2xl font-extrabold text-titanium-100 tracking-tight">
            Explorator Companii Românești
          </h1>
          <p className="text-xs text-titanium-400 mt-1">
            Total {pagination.total.toLocaleString('ro-RO')} entități economice verificate în registru.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="px-4 py-2 bg-titanium-800 hover:bg-titanium-700 text-titanium-100 text-xs font-semibold rounded-lg border border-titanium-700 flex items-center gap-2 transition-colors self-start md:self-auto"
        >
          <Download className="w-4 h-4 text-radar-green" />
          Exportă Rezultate (CSV)
        </button>
      </div>

      {/* Search & Advanced Filters Bar */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-titanium-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caută după CUI, denumire companie, nr. RegCom sau oraș..."
              className="w-full pl-10 pr-4 py-2 bg-titanium-950 border border-titanium-800 rounded-lg text-xs text-titanium-100 placeholder-titanium-500 focus:outline-none focus:border-radar-green font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 bg-radar-green text-titanium-950 font-bold text-xs rounded-lg hover:bg-emerald-400 transition-colors"
          >
            Caută
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-titanium-800 text-xs">
          <div className="flex items-center gap-1.5 text-titanium-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtrează:</span>
          </div>

          <select
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="bg-titanium-950 border border-titanium-800 text-titanium-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-radar-green"
          >
            <option value="">Toate Județele</option>
            <option value="Bucureşti">București</option>
            <option value="Cluj">Cluj</option>
            <option value="Timiş">Timiș</option>
            <option value="Ilfov">Ilfov</option>
            <option value="Iaşi">Iași</option>
            <option value="Braşov">Brașov</option>
            <option value="Constanţa">Constanța</option>
            <option value="Prahova">Prahova</option>
            <option value="Bihor">Bihor</option>
            <option value="Dolj">Dolj</option>
            <option value="Argeş">Argeș</option>
          </select>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="bg-titanium-950 border border-titanium-800 text-titanium-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-radar-green"
          >
            <option value="">Toate Prioritățile</option>
            <option value="URGENT">Urgent (Legal / Mandat)</option>
            <option value="HIGH">Ridicată (Scor &gt;= 70%)</option>
            <option value="STANDARD">Standard</option>
            <option value="LOW">Scăzută</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-titanium-950 border border-titanium-800 text-titanium-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-radar-green"
          >
            <option value="">Toate Stările</option>
            <option value="ACTIVE">Active (în funcțiune)</option>
            <option value="RADIATED">Radiate</option>
          </select>

          {(query || county || priority || status) && (
            <button
              onClick={() => {
                setQuery('');
                setCounty('');
                setPriority('');
                setStatus('');
                fetchCompanies(1);
              }}
              className="text-xs text-rose-400 hover:underline ml-auto"
            >
              Resetează Filtre
            </button>
          )}
        </div>
      </div>

      {/* Companies Results Table */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-titanium-850 text-titanium-400 font-semibold border-b border-titanium-800">
              <tr>
                <th className="py-3 px-4">CUI & Companie</th>
                <th className="py-3 px-4">RegCom & Formă</th>
                <th className="py-3 px-4">Sediu Social</th>
                <th className="py-3 px-4">Obiect de Activitate (CAEN)</th>
                <th className="py-3 px-4 text-center">Oportunități</th>
                <th className="py-3 px-4 text-right">Scor BI</th>
                <th className="py-3 px-4 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-titanium-500 font-mono">
                    Se încarcă companiile din registrul național...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-titanium-500">
                    Nicio companie găsită conform criteriilor selectate.
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.cui} className="hover:bg-titanium-850/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-titanium-100 hover:text-radar-green">
                        <Link href={`/companies/${c.cui}`}>{c.name}</Link>
                      </div>
                      <div className="font-mono text-titanium-400 text-[11px] mt-0.5">
                        CUI: <span className="text-titanium-200">{c.cui}</span>
                      </div>
                      {c.website && (
                        <div className="text-[10px] text-radar-green flex items-center gap-1 mt-0.5">
                          <Globe className="w-3 h-3" />
                          {c.website}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-titanium-300">
                      <div>{c.reg_com || '—'}</div>
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded bg-titanium-800 border border-titanium-700 text-titanium-400">
                        {c.legal_form || 'SRL'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-titanium-300">
                      <div>{c.county || 'România'}</div>
                      <div className="text-[11px] text-titanium-500">{c.city || '—'}</div>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-mono text-[11px] text-titanium-200">CAEN {c.primary_caen || '—'}</div>
                      <div className="text-[11px] text-titanium-400 truncate">{c.caen_description || 'Consultanță'}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-radar-emerald/10 text-radar-green border border-radar-emerald/30">
                        <ShieldCheck className="w-3 h-3" />
                        {c.opp_count} polițe
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      <div className="font-bold text-radar-green text-sm">{c.opportunity_score}%</div>
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                        c.prospect_priority === 'URGENT' ? 'bg-rose-500/20 text-rose-400' :
                        c.prospect_priority === 'HIGH' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-titanium-800 text-titanium-400'
                      }`}>
                        {c.prospect_priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/companies/${c.cui}`}
                        className="px-2.5 py-1 bg-titanium-800 hover:bg-radar-green hover:text-titanium-950 rounded text-[11px] font-medium border border-titanium-700 transition-colors"
                      >
                        Profil
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-titanium-800 bg-titanium-950/40 flex items-center justify-between text-xs text-titanium-400">
          <div>
            Afișate {(pagination.page - 1) * pagination.limit + 1} -{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} din {pagination.total} companii
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchCompanies(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded bg-titanium-850 border border-titanium-700 text-titanium-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-titanium-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-titanium-200">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => fetchCompanies(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded bg-titanium-850 border border-titanium-700 text-titanium-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-titanium-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
