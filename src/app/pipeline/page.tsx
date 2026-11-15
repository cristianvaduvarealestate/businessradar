'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';

const STAGES = [
  { id: 'NEW_DISCOVERED', label: 'Nou Descoperit', color: 'border-titanium-600' },
  { id: 'AWAITING_VERIFICATION', label: 'În Verificare', color: 'border-blue-500' },
  { id: 'TO_CONTACT', label: 'De Contactat', color: 'border-amber-500' },
  { id: 'CONTACTED', label: 'Contactat', color: 'border-cyan-500' },
  { id: 'INTERESTED', label: 'Interesat', color: 'border-radar-green' },
  { id: 'QUOTATION_SENT', label: 'Ofertă Trimisă', color: 'border-purple-500' },
  { id: 'CLIENT', label: 'Client Semnat', color: 'border-emerald-500' },
];

export default function PipelinePage() {
  const [items, setItems] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState('ALL');

  const fetchPipeline = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pipeline');
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

  useEffect(() => {
    fetchPipeline();
  }, []);

  const handleUpdateStatus = async (cui: number, newStatus: string) => {
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
    }
  };

  const filteredItems = selectedStage === 'ALL'
    ? items
    : items.filter(i => i.status === selectedStage);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="border-b border-titanium-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
          <TrendingUp className="w-4 h-4" />
          Sistem de Gestionare a Oportunităților (CRM B2B)
        </div>
        <h1 className="text-2xl font-extrabold text-titanium-100 tracking-tight">
          Pipeline Vânzări Asigurări
        </h1>
        <p className="text-xs text-titanium-400 mt-1">
          Monitorizează procesul de calificare, contactare, ofertare și semnare a contractelor de asigurare. Niciun mesaj nu este trimis automat; controlul total aparține utilizatorului.
        </p>
      </div>

      {/* Stage Selector Pills */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <button
          onClick={() => setSelectedStage('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            selectedStage === 'ALL'
              ? 'bg-titanium-100 text-titanium-950 border-white'
              : 'bg-titanium-900 text-titanium-400 border-titanium-800 hover:text-white'
          }`}
        >
          Toate Etapele ({items.length})
        </button>

        {STAGES.map((s) => {
          const count = statusCounts.find((sc) => sc.status === s.id)?.count || 0;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedStage(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                selectedStage === s.id
                  ? 'bg-titanium-800 text-radar-green border-radar-green'
                  : 'bg-titanium-900 text-titanium-400 border-titanium-800 hover:text-white'
              }`}
            >
              {s.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Prospect List */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-titanium-850 border-b border-titanium-800 flex items-center justify-between text-xs font-bold text-titanium-300 uppercase tracking-wider">
          <span>Companie & Industrie</span>
          <span>Etapă Curentă & Acțiuni</span>
        </div>

        <div className="divide-y divide-titanium-800">
          {loading ? (
            <div className="py-12 text-center text-titanium-500 font-mono text-xs">
              Se încarcă oportunitățile din pipeline...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-titanium-500 text-xs">
              Nicio companie în această etapă de prospectare.
            </div>
          ) : (
            filteredItems.map((item) => (
              <div key={item.cui} className="p-4 hover:bg-titanium-850/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/companies/${item.cui}`}
                      className="font-bold text-sm text-titanium-100 hover:text-radar-green"
                    >
                      {item.company_name}
                    </Link>
                    <span className="font-mono text-xs text-titanium-400">(CUI {item.cui})</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      item.priority === 'URGENT' ? 'bg-rose-500/20 text-rose-400' :
                      item.priority === 'HIGH' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-titanium-800 text-titanium-400'
                    }`}>
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

                {/* Status Switcher */}
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={item.status}
                    onChange={(e) => handleUpdateStatus(item.cui, e.target.value)}
                    className="bg-titanium-950 border border-titanium-700 text-titanium-200 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-radar-green"
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                    <option value="NOT_INTERESTED">Neinteresat</option>
                    <option value="DO_NOT_CONTACT">Nu Contacta (Supresie)</option>
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
    </div>
  );
}
