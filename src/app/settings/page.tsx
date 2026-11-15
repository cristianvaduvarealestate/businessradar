'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  ShieldAlert,
  Key,
  Bell,
  Sliders,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Building2,
  Check,
} from 'lucide-react';

export default function SettingsPage() {
  const [suppressedList, setSuppressedList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cuiInput, setCuiInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSuppressionList = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/suppression');
      const json = await res.json();
      if (json.success && json.data) {
        setSuppressedList(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppressionList();
  }, []);

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuiInput) return;
    setSubmitting(true);
    setMsg(null);

    try {
      const res = await fetch('/api/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cui: Number(cuiInput),
          reason: reasonInput || 'Exclus manual prin Panou Setări',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMsg({ type: 'success', text: `CUI ${cuiInput} a fost exclus din prospectare.` });
        setCuiInput('');
        setReasonInput('');
        fetchSuppressionList();
      } else {
        setMsg({ type: 'error', text: json.error || 'Eroare la excludere.' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveSuppression = async (id: number) => {
    try {
      const res = await fetch(`/api/suppression?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchSuppressionList();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="border-b border-titanium-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-titanium-400 uppercase tracking-wider mb-1">
          <Settings className="w-4 h-4" />
          Configurare Platformă & Conformitate GDPR
        </div>
        <h1 className="text-2xl font-extrabold text-titanium-100 tracking-tight">
          Setări, Credențiale & Listă de Supresie
        </h1>
        <p className="text-xs text-titanium-400 mt-1">
          Configurarea cheilor de acces, integrarea notificărilor și gestionarea listei de supresie globale (DO NOT CONTACT).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Suppression List Management */}
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
            <h2 className="text-xs font-bold text-titanium-100 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Listă Globală de Supresie (DO NOT CONTACT)
            </h2>
            <span className="font-mono text-xs text-titanium-400 font-bold bg-titanium-950 px-2.5 py-1 rounded border border-titanium-800">
              {suppressedList.length} entități excluse
            </span>
          </div>

          <p className="text-xs text-titanium-400">
            Companiile din lista de supresie sunt excluse automat din recomandările de vânzări, exporturile CSV și alertele Telegram.
          </p>

          {/* Add form */}
          <form onSubmit={handleAddSuppression} className="p-4 bg-titanium-950 rounded-lg border border-titanium-800 space-y-3 text-xs">
            <div className="font-semibold text-titanium-200">Adaugă CUI în Lista de Supresie:</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                type="number"
                required
                placeholder="CUI Companie..."
                value={cuiInput}
                onChange={(e) => setCuiInput(e.target.value)}
                className="bg-titanium-900 border border-titanium-700 rounded px-3 py-2 text-xs text-titanium-100 focus:outline-none focus:border-rose-400 font-mono"
              />
              <input
                type="text"
                placeholder="Motiv excludere (opțional)..."
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                className="bg-titanium-900 border border-titanium-700 rounded px-3 py-2 text-xs text-titanium-100 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex justify-between items-center pt-1">
              {msg && (
                <span className={`text-[11px] ${msg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {msg.text}
                </span>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="ml-auto px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs transition-colors flex items-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                {submitting ? 'Se exclude...' : 'Exclude din Prospectare'}
              </button>
            </div>
          </form>

          {/* Table of suppressed entities */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-titanium-400 uppercase tracking-wider">
              Entități Excluse Curent ({suppressedList.length})
            </div>

            {loading ? (
              <div className="text-center py-6 text-titanium-500 text-xs font-mono">
                Se încarcă lista din D1...
              </div>
            ) : suppressedList.length === 0 ? (
              <div className="p-4 bg-titanium-950 rounded border border-titanium-800 text-center text-xs text-titanium-500">
                Lista de supresie este momentan goală.
              </div>
            ) : (
              <div className="divide-y divide-titanium-800 max-h-60 overflow-y-auto bg-titanium-950 rounded-lg border border-titanium-800">
                {suppressedList.map((item: any) => (
                  <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-bold text-titanium-200">
                        CUI {item.cui} {item.company_name && `• ${item.company_name}`}
                      </div>
                      <div className="text-[11px] text-titanium-500">
                        {item.reason} ({item.added_at?.slice(0, 10)})
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveSuppression(item.id)}
                      className="p-1.5 text-titanium-500 hover:text-rose-400 transition-colors"
                      title="Elimină din supresie"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Telegram & Security Credentials */}
        <div className="space-y-6">
          <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
              <h2 className="text-xs font-bold text-titanium-100 uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-400" />
                Integrare Notificări & Alerte
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-titanium-800 text-titanium-300">
                Cloudflare Worker Secret
              </span>
            </div>

            <p className="text-xs text-titanium-400">
              Pentru securitate maximă, credențialele Telegram se configurează ca secrete Cloudflare Worker (niciodată expuse în codul client sau browser).
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <span className="text-titanium-500 text-[11px]">RADAR_ADMIN_PASSKEY:</span>
                <div className="p-2.5 bg-titanium-950 rounded border border-titanium-800 text-titanium-300 flex items-center justify-between mt-1">
                  <span>••••••••••••••••••••••••</span>
                  <Lock className="w-3.5 h-3.5 text-radar-green" />
                </div>
              </div>

              <div>
                <span className="text-titanium-500 text-[11px]">RADAR_SECURITY_KEY:</span>
                <div className="p-2.5 bg-titanium-950 rounded border border-titanium-800 text-titanium-300 flex items-center justify-between mt-1">
                  <span>••••••••••••••••••••••••••••••••</span>
                  <Lock className="w-3.5 h-3.5 text-radar-green" />
                </div>
              </div>

              <div>
                <span className="text-titanium-500 text-[11px]">BAZĂ DE DATE PERSISTENTĂ (D1):</span>
                <div className="p-2.5 bg-titanium-950 rounded border border-titanium-800 text-radar-green flex items-center justify-between mt-1">
                  <span>businessradar-db (Regiune EEUR)</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-radar-green" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-3 text-xs">
            <h3 className="text-xs font-bold text-titanium-200 uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              Politici de Acces & Conformitate B2B
            </h3>
            <p className="text-titanium-400">
              Aplicația funcționează sub regim strict privat conform Art. 6(1)(f) GDPR (Interes legitim B2B).
            </p>
            <div className="p-3 bg-titanium-950 rounded border border-titanium-800 text-[11px] text-titanium-400 space-y-1">
              <div>• Acces permis exclusiv pentru administratorul autorizat.</div>
              <div>• Nicio campanie automată de spam nu este activă.</div>
              <div>• Fiecare apel și email este inițiat exclusiv manual de broker.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
