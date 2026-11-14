'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Compass,
  Calendar,
  Filter,
  ShieldCheck,
  Globe,
  Download,
  Building2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

export default function NewCompaniesRadarPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [county, setCounty] = useState('');
  const [priority, setPriority] = useState('');

  const fetchRadarCompanies = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        isNew: 'true',
      });
      if (county) params.set('county', county);
      if (priority) params.set('priority', priority);

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
    fetchRadarCompanies(1);
  }, [county, priority]);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-titanium-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-radar-green uppercase tracking-wider mb-1">
            <Compass className="w-4 h-4 radar-pulse" />
            Descoperire Continuă
          </div>
          <h1 className="text-2xl font-extrabold text-titanium-100 tracking-tight">
            Radar Firme Noi (Ultimele 90 de Zile)
          </h1>
          <p className="text-xs text-titanium-400 mt-1">
            {pagination.total.toLocaleString('ro-RO')} firme nou-înființate sau nou-observate în România — momentul optim pentru contractarea polițelor de start-up.
          </p>
        </div>

        <button
          onClick={() => window.open(`/api/export?isNew=true${county ? `&county=${county}` : ''}`, '_blank')}
          className="px-4 py-2 bg-titanium-800 hover:bg-titanium-700 text-titanium-100 text-xs font-semibold rounded-lg border border-titanium-700 flex items-center gap-2 transition-colors self-start md:self-auto"
        >
          <Download className="w-4 h-4 text-radar-green" />
          Exportă Firme Noi (CSV)
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-titanium-400 font-semibold flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Filtrează Radar:
          </span>

          <select
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="bg-titanium-950 border border-titanium-800 text-titanium-200 px-3 py-1.5 rounded-lg focus:outline-none focus:border-radar-green"
          >
            <option value="">Toate Județele</option>
            <option value="Bucureşti">București</option>
            <option value="Cluj">Cluj</option>
            <option value="Timiş">Timiș</option>
            <option value="Ilfov">Ilfov</option>
            <option value="Iaşi">Iași</option>
            <option value="Braşov">Brașov</option>
            <option value="Constanţa">Constanța</option>
          </select>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="bg-titanium-950 border border-titanium-800 text-titanium-200 px-3 py-1.5 rounded-lg focus:outline-none focus:border-radar-green"
          >
            <option value="">Toate Prioritățile</option>
            <option value="URGENT">Urgent (Oportunități Obligatorii)</option>
            <option value="HIGH">Ridicată (Scor &gt;= 70%)</option>
            <option value="STANDARD">Standard</option>
          </select>
        </div>

        <div className="text-titanium-400 font-mono text-[11px]">
          Frecvență scanare: <strong>4 ore</strong> (Sincronizare automată)
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-titanium-500 font-mono text-xs">
            Se încarcă companiile din radar...
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full py-16 text-center text-titanium-500 text-xs">
            Nicio companie identificată în fereastra curentă conform filtrelor.
          </div>
        ) : (
          items.map((c) => (
            <div key={c.cui} className="bg-titanium-900 border border-titanium-800 rounded-xl p-5 hover:border-titanium-700 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-titanium-800 border border-titanium-700 text-titanium-300">
                    CUI {c.cui}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    c.prospect_priority === 'URGENT' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                    c.prospect_priority === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-titanium-800 text-titanium-400'
                  }`}>
                    {c.prospect_priority}
                  </span>
                </div>

                <Link
                  href={`/companies/${c.cui}`}
                  className="block font-bold text-sm text-titanium-100 hover:text-radar-green transition-colors line-clamp-2"
                >
                  {c.name}
                </Link>

                <div className="text-xs text-titanium-400">
                  📍 {c.county || 'România'}, {c.city || ''}
                </div>

                <div className="text-[11px] text-titanium-300 pt-1 border-t border-titanium-800 line-clamp-2">
                  <span className="font-mono text-radar-green font-semibold">CAEN {c.primary_caen}:</span> {c.caen_description}
                </div>
              </div>

              <div className="pt-3 border-t border-titanium-800 flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-titanium-500">Scor Oportunitate:</div>
                  <div className="font-mono font-bold text-radar-green text-sm">{c.opportunity_score}%</div>
                </div>

                <Link
                  href={`/companies/${c.cui}`}
                  className="px-3 py-1.5 bg-titanium-800 hover:bg-radar-green hover:text-titanium-950 font-semibold text-titanium-200 rounded-lg text-xs border border-titanium-700 transition-colors"
                >
                  Vezi Oportunități ({c.opp_count})
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="p-4 bg-titanium-900 border border-titanium-800 rounded-xl flex items-center justify-between text-xs text-titanium-400">
        <div>Total {pagination.total} firme în radarul recent</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRadarCompanies(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-1.5 rounded bg-titanium-800 border border-titanium-700 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-titanium-200">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchRadarCompanies(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="p-1.5 rounded bg-titanium-800 border border-titanium-700 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
