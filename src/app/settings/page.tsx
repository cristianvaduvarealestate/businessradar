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
  Sparkles,
  Server,
  Activity,
  Calendar,
  Clock,
  AlertCircle,
  Database,
  ExternalLink,
} from 'lucide-react';

interface SyncLogItem {
  id?: number;
  sync_id: string;
  source_name: string;
  started_at: string;
  ended_at?: string;
  status: string;
  records_discovered: number;
  records_updated: number;
  records_rejected: number;
  checkpoint_start?: string;
  checkpoint_end?: string;
  error_message?: string;
  execution_type?: string;
  triggered_by?: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'monitoring' | 'suppression' | 'sources' | 'security'>('monitoring');

  // Suppression State
  const [suppressedList, setSuppressedList] = useState<any[]>([]);
  const [suppressionLoading, setSuppressionLoading] = useState(true);
  const [cuiInput, setCuiInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [submittingSuppression, setSubmittingSuppression] = useState(false);
  const [suppressionMsg, setSuppressionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Monitoring Config & History State
  const [monitoringConfig, setMonitoringConfig] = useState<Record<string, string>>({});
  const [syncLogs, setSyncLogs] = useState<SyncLogItem[]>([]);
  const [monitoringLoading, setMonitoringLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  // Editable config fields
  const [activationDate, setActivationDate] = useState('');
  const [batchLimit, setBatchLimit] = useState('50');
  const [cronSchedule, setCronSchedule] = useState('0 6 * * *');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState('true');

  // Source Health
  const [sourceHealth, setSourceHealth] = useState<{
    onrc: { status: string; latency?: number };
    anaf: { status: string; latency?: number };
  }>({
    onrc: { status: 'ONLINE (data.gov.ro CKAN)' },
    anaf: { status: 'ONLINE (ANAF v9 REST)' },
  });

  const fetchSuppressionList = async () => {
    setSuppressionLoading(true);
    try {
      const res = await fetch('/api/suppression');
      const json = await res.json();
      if (json.success && json.data) {
        setSuppressedList(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSuppressionLoading(false);
    }
  };

  const fetchMonitoringData = async () => {
    setMonitoringLoading(true);
    try {
      const res = await fetch('/api/monitoring');
      const json = await res.json();
      if (json.success) {
        setMonitoringConfig(json.config || {});
        setSyncLogs(json.recentSyncs || []);
        if (json.config) {
          setActivationDate(json.config.monitoring_activation_date || '');
          setBatchLimit(json.config.batch_limit || '50');
          setCronSchedule(json.config.cron_schedule || '0 6 * * *');
          setAutoSyncEnabled(json.config.auto_sync_enabled || 'true');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMonitoringLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppressionList();
    fetchMonitoringData();
  }, []);

  const handleSaveMonitoringConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSuccessMsg(null);
    try {
      const res = await fetch('/api/monitoring', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monitoring_activation_date: activationDate,
          batch_limit: batchLimit,
          cron_schedule: cronSchedule,
          auto_sync_enabled: autoSyncEnabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConfigSuccessMsg('Configurarea monitorizării a fost salvată cu succes.');
        setMonitoringConfig(data.config || {});
        setTimeout(() => setConfigSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      alert(`Eroare la salvare: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleManualSync = async () => {
    setSyncingNow(true);
    try {
      const res = await fetch('/api/monitoring/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchLimit: parseInt(batchLimit, 10) || 50 }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || `Sincronizare completă: ${data.discoveredCount} companii noi.`);
        fetchMonitoringData();
      } else {
        alert(data.message || data.error || 'Eroare la sincronizare');
      }
    } catch (err: any) {
      alert(`Eroare rețea: ${err.message}`);
    } finally {
      setSyncingNow(false);
    }
  };

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuiInput) return;
    setSubmittingSuppression(true);
    setSuppressionMsg(null);

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
        setSuppressionMsg({ type: 'success', text: `CUI ${cuiInput} a fost exclus din prospectare.` });
        setCuiInput('');
        setReasonInput('');
        fetchSuppressionList();
      } else {
        setSuppressionMsg({ type: 'error', text: json.error || 'Eroare la excludere.' });
      }
    } catch (err: any) {
      setSuppressionMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingSuppression(false);
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="border-b border-titanium-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-titanium-400 uppercase tracking-wider mb-1">
          <Settings className="w-4 h-4" />
          Configurare Platformă &amp; Audit Operațional
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          CONFIGURARE &amp; MONITORIZARE
        </h1>
        <p className="text-xs text-titanium-400 mt-1">
          Configurarea sistemului de descoperire companii noi, surse oficiale de date, verificări ANAF, listă de supresie și securitate.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-titanium-800 pb-2 overflow-x-auto text-xs">
        {[
          { id: 'monitoring', label: 'Monitorizare Firme Noi', icon: Sparkles },
          { id: 'suppression', label: 'Listă de Supresie (DNC)', icon: ShieldAlert },
          { id: 'sources', label: 'Surse & Sănătate API', icon: Server },
          { id: 'security', label: 'Securitate & D1', icon: Key },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-radar-green text-black font-bold shadow-sm'
                  : 'bg-titanium-900 hover:bg-titanium-850 text-titanium-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MONITORING CONFIGURATION & SYNC HISTORY */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Configuration Form */}
            <div className="lg:col-span-1 bg-titanium-900 border border-titanium-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-radar-green" />
                  Parametri Monitorizare
                </h2>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={syncingNow}
                  className="px-2.5 py-1 rounded bg-radar-green hover:bg-emerald-400 text-black font-bold text-[11px] flex items-center gap-1.5 disabled:opacity-50"
                  title="Lansează o sesiune de scanare acum"
                >
                  <RefreshCw className={`w-3 h-3 ${syncingNow ? 'animate-spin' : ''}`} />
                  <span>{syncingNow ? 'Scanare...' : 'Scanare Acum'}</span>
                </button>
              </div>

              <form onSubmit={handleSaveMonitoringConfig} className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                    Dată Activare Monitorizare Continuă
                  </label>
                  <input
                    type="date"
                    value={activationDate}
                    onChange={(e) => setActivationDate(e.target.value)}
                    placeholder="Se înregistrează la prima sincronizare completă"
                    className="w-full bg-titanium-950 border border-titanium-700 text-white rounded-lg p-2 font-mono text-xs focus:border-radar-green focus:outline-none"
                  />
                  <p className="text-[10px] text-titanium-500 mt-1">
                    Se înregistrează automat la finalizarea primei sincronizări complete. Înainte de activare, toate înregistrările noi apar ca <strong>INITIAL BACKFILL</strong>.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                    Limită Companii / Sincronizare
                  </label>
                  <input
                    type="number"
                    value={batchLimit}
                    onChange={(e) => setBatchLimit(e.target.value)}
                    className="w-full bg-titanium-950 border border-titanium-700 text-white rounded-lg p-2 font-mono text-xs focus:border-radar-green focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                    Programare Cron (Zilnic UTC)
                  </label>
                  <input
                    type="text"
                    value={cronSchedule}
                    onChange={(e) => setCronSchedule(e.target.value)}
                    className="w-full bg-titanium-950 border border-titanium-700 text-white rounded-lg p-2 font-mono text-xs focus:border-radar-green focus:outline-none"
                  />
                  <p className="text-[10px] text-titanium-500 mt-1">
                    Ex: <code>0 6 * * *</code> (declanșare zilnică la 06:00 UTC)
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                    Sincronizare Automată Activă
                  </label>
                  <select
                    value={autoSyncEnabled}
                    onChange={(e) => setAutoSyncEnabled(e.target.value)}
                    className="w-full bg-titanium-950 border border-titanium-700 text-white rounded-lg p-2 text-xs focus:border-radar-green focus:outline-none"
                  >
                    <option value="true">Activată (Programat)</option>
                    <option value="false">Dezactivată (Exclusiv manual)</option>
                  </select>
                </div>

                {configSuccessMsg && (
                  <div className="p-2 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono">
                    {configSuccessMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingConfig}
                  className="w-full py-2 bg-titanium-800 hover:bg-titanium-700 text-white font-bold rounded-lg text-xs transition-colors border border-titanium-700"
                >
                  {savingConfig ? 'Se salvează...' : 'Salvează Configurarea'}
                </button>
              </form>
            </div>

            {/* Current State & Checkpoint Info */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2 border-b border-titanium-800 pb-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Starea Curentă a Pipeline-ului de Monitorizare
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-titanium-950 border border-titanium-800 font-mono">
                    <div className="text-[10px] text-titanium-500">Status Serviciu</div>
                    <div className="text-emerald-400 font-bold mt-0.5">
                      {monitoringConfig.last_sync_status || 'STANDBY'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-titanium-950 border border-titanium-800 font-mono">
                    <div className="text-[10px] text-titanium-500">Total Descoperite</div>
                    <div className="text-white font-bold mt-0.5">
                      {monitoringConfig.total_discovered_count || '0'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-titanium-950 border border-titanium-800 font-mono">
                    <div className="text-[10px] text-titanium-500">Cursor Streaming</div>
                    <div className="text-cyan-400 font-bold mt-0.5">
                      Linia {monitoringConfig.stream_cursor_line || '0'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-titanium-950 border border-titanium-800 font-mono">
                    <div className="text-[10px] text-titanium-500">Ultimul Pachet ONRC</div>
                    <div className="text-titanium-200 truncate mt-0.5" title={monitoringConfig.active_package_title}>
                      {monitoringConfig.active_package_title || 'firme-04-11-2026'}
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-xs text-titanium-400 flex items-center justify-between border-t border-titanium-800/80 font-mono">
                  <span>
                    Ultima rulare reușită:{' '}
                    <strong className="text-white">
                      {monitoringConfig.last_successful_sync_at
                        ? new Date(monitoringConfig.last_successful_sync_at).toLocaleString('ro-RO')
                        : 'În așteptare'}
                    </strong>
                  </span>
                  <span>
                    Următoarea rulare: <strong className="text-radar-green">Zilnic conform Cron</strong>
                  </span>
                </div>
              </div>

              {/* Sync Execution History */}
              <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-titanium-800 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-400" />
                    Jurnal Sincronizări &amp; Audit Erori
                  </h3>
                  <span className="text-[10px] text-titanium-400 font-mono">
                    {syncLogs.length} sesiuni înregistrate
                  </span>
                </div>

                {syncLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-titanium-500 italic">
                    Nicio sesiune de sincronizare înregistrată încă în baza D1.
                  </div>
                ) : (
                  <div className="divide-y divide-titanium-800/60 max-h-72 overflow-y-auto text-xs font-mono">
                    {syncLogs.map((log) => (
                      <div key={log.sync_id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                log.status === 'SUCCESS'
                                  ? 'bg-emerald-400'
                                  : log.status === 'RUNNING'
                                  ? 'bg-amber-400 animate-pulse'
                                  : 'bg-rose-500'
                              }`}
                            ></span>
                            <span className="font-bold text-white">{log.sync_id}</span>
                            <span className="text-[10px] text-titanium-400">({log.execution_type || 'MANUAL'})</span>
                          </div>
                          <div className="text-[11px] text-titanium-400 mt-0.5">
                            {new Date(log.started_at).toLocaleString('ro-RO')} • {log.records_discovered} descoperite, {log.records_updated} actualizate
                          </div>
                          {log.error_message && (
                            <div className="text-[10px] text-rose-400 mt-0.5 truncate max-w-md">
                              Eroare: {log.error_message}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'SUCCESS'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {log.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUPPRESSION LIST */}
      {activeTab === 'suppression' && (
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Listă Globală de Supresie (DO NOT CONTACT)
            </h2>
            <span className="font-mono text-xs text-titanium-400 font-bold bg-titanium-950 px-2.5 py-1 rounded border border-titanium-800">
              {suppressedList.length} entități excluse
            </span>
          </div>

          <p className="text-xs text-titanium-400">
            Companiile din lista de supresie sunt excluse din spațiul de lucru activ, exporturile CSV și alertele de vânzări.
          </p>

          <form onSubmit={handleAddSuppression} className="p-4 bg-titanium-950 rounded-lg border border-titanium-800 space-y-3 text-xs">
            <div className="font-semibold text-titanium-200">Adaugă CUI în Lista de Supresie:</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                type="number"
                required
                placeholder="CUI Companie..."
                value={cuiInput}
                onChange={(e) => setCuiInput(e.target.value)}
                className="bg-titanium-900 border border-titanium-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400 font-mono"
              />
              <input
                type="text"
                placeholder="Motiv excludere (opțional)..."
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                className="bg-titanium-900 border border-titanium-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex justify-between items-center pt-1">
              {suppressionMsg && (
                <span className={`text-[11px] ${suppressionMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {suppressionMsg.text}
                </span>
              )}
              <button
                type="submit"
                disabled={submittingSuppression}
                className="ml-auto px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs transition-colors flex items-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                {submittingSuppression ? 'Se exclude...' : 'Exclude din Prospectare'}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <div className="text-[11px] font-bold text-titanium-400 uppercase tracking-wider">
              Entități Excluse Curent ({suppressedList.length})
            </div>

            {suppressionLoading ? (
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
      )}

      {/* TAB 3: DATA SOURCES & HEALTH */}
      {activeTab === 'sources' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-radar-green" />
                ONRC Open Data (data.gov.ro)
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                {sourceHealth.onrc.status}
              </span>
            </div>

            <div className="space-y-2 text-xs text-titanium-300">
              <p>Depozitul central de date deschise al Oficiului Național al Registrului Comerțului.</p>
              <div className="p-3 bg-titanium-950 rounded border border-titanium-800 space-y-1 font-mono text-[11px]">
                <div>• Endpoint: <code>https://data.gov.ro/api/3/action</code></div>
                <div>• Frecvență actualizare: 2-4 săptămâni</div>
                <div>• Licență: OGL-ROU-1.0 (Guvernul României)</div>
                <div>• Metodă ingestie: Streaming HTTP delimitat cu caret (^)</div>
              </div>
            </div>
          </div>

          <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                ANAF PlatitorTvaRest v9
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                {sourceHealth.anaf.status}
              </span>
            </div>

            <div className="space-y-2 text-xs text-titanium-300">
              <p>Serviciu web oficial ANAF pentru verificarea în timp real a statutului fiscal și numerelor declarate.</p>
              <div className="p-3 bg-titanium-950 rounded border border-titanium-800 space-y-1 font-mono text-[11px]">
                <div>• Endpoint: <code>https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva</code></div>
                <div>• Frecvență actualizare: În timp real (REST)</div>
                <div>• Capacitate: Batch până la 500 CUI-uri simultan</div>
                <div>• Date returnate: Stare fiscală, TVA, RO e-Factura, Telefon declarat</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SECURITY & CLOUDFLARE D1 */}
      {activeTab === 'security' && (
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              Securitate &amp; Bază de Date D1
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-titanium-800 text-titanium-300">
              Cloudflare Worker EEUR
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div>
              <span className="text-titanium-500 text-[11px]">RADAR_ADMIN_PASSKEY:</span>
              <div className="p-2.5 bg-titanium-950 rounded border border-titanium-800 text-titanium-300 flex items-center justify-between mt-1">
                <span>••••••••••••••••••••••••</span>
                <Lock className="w-3.5 h-3.5 text-radar-green" />
              </div>
            </div>

            <div>
              <span className="text-titanium-500 text-[11px]">BAZĂ DE DATE PERSISTENTĂ (D1):</span>
              <div className="p-2.5 bg-titanium-950 rounded border border-titanium-800 text-radar-green flex items-center justify-between mt-1">
                <span>businessradar-db (ID: 58b90910-e6d0-4c6b-8103-6d6cc62615ff)</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-radar-green" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
