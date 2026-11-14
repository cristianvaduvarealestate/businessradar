import { REGISTERED_PROVIDERS } from '@/lib/providers';
import { getDatabase } from '@/lib/db';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  ExternalLink,
  Shield,
  Activity,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function SourcesManagementPage() {
  const db = getDatabase();

  const jobs = db.prepare(`
    SELECT job_id, provider, scheduled_at, started_at, ended_at, status,
           records_processed, new_records, updated_records, duration_ms, error_log
    FROM ingestion_jobs
    ORDER BY id DESC
    LIMIT 15
  `).all() as any[];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="border-b border-titanium-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-radar-green uppercase tracking-wider mb-1">
          <Server className="w-4 h-4" />
          Arhitectură de Ingestie & Audit
        </div>
        <h1 className="text-2xl font-extrabold text-titanium-100 tracking-tight">
          Management Surse & Conectori
        </h1>
        <p className="text-xs text-titanium-400 mt-1">
          Monitorizarea conectorilor externi oficiali (ONRC, ANAF, MinFin), frecvențele de sincronizare, cotele de apelare și auditul joburilor de import.
        </p>
      </div>

      {/* Connectors Matrix */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-titanium-200 uppercase tracking-wider">
          Conectori Înregistrați în Platformă
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(REGISTERED_PROVIDERS).map((source) => (
            <div
              key={source.id}
              className="bg-titanium-900 border border-titanium-800 rounded-xl p-5 space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    source.status === 'CONNECTED_AND_TESTED' ? 'bg-radar-emerald/10 text-radar-green border-radar-emerald/30' :
                    source.status === 'PUBLIC_DATASET_AVAILABLE' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                    'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    {source.status}
                  </span>

                  <span className="text-[10px] font-mono text-titanium-500">
                    {source.updateFrequency}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-titanium-100">
                  {source.name}
                </h3>

                <div className="text-xs text-titanium-400 space-y-1">
                  <div><strong>Autentificare:</strong> {source.requiresAuth ? 'Necesită API Key' : 'Public (€0 / Gratuit)'}</div>
                  <div><strong>Model Cost:</strong> {source.isPaid ? 'Comercial / Plătit' : 'Deschis / Open Data (€0)'}</div>
                  <div><strong>Cotă & Limite:</strong> {source.rateLimitInfo}</div>
                </div>
              </div>

              <div className="pt-3 border-t border-titanium-800 text-[10px] text-titanium-500">
                Atribuire: {source.attribution}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ingestion Execution History */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl overflow-hidden shadow-sm space-y-0">
        <div className="p-4 bg-titanium-850 border-b border-titanium-800 flex items-center justify-between">
          <h2 className="text-xs font-bold text-titanium-200 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-radar-green" />
            Istoric Execuție Joburi de Ingestie (Ultimele Rulări)
          </h2>
          <span className="text-[11px] text-titanium-400 font-mono">Status Machine: SUCCESS / FAILED / RUNNING</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-titanium-900 text-titanium-400 font-semibold border-b border-titanium-800">
              <tr>
                <th className="py-2.5 px-4">Job ID</th>
                <th className="py-2.5 px-4">Sursă Provider</th>
                <th className="py-2.5 px-4">Data Start / Final</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Linii Procesate</th>
                <th className="py-2.5 px-4 text-right">Firme Noi</th>
                <th className="py-2.5 px-4 text-right">Durată (ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-800 font-mono">
              {jobs.map((j) => (
                <tr key={j.job_id} className="hover:bg-titanium-850/50">
                  <td className="py-2.5 px-4 text-titanium-300 font-bold">{j.job_id}</td>
                  <td className="py-2.5 px-4 text-titanium-400">{j.provider}</td>
                  <td className="py-2.5 px-4 text-titanium-500 text-[11px]">
                    {j.started_at ? j.started_at.replace('T', ' ').slice(0, 19) : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      j.status === 'SUCCESS' ? 'bg-radar-emerald/10 text-radar-green border border-radar-emerald/30' :
                      j.status === 'RUNNING' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-titanium-200">{j.records_processed.toLocaleString('ro-RO')}</td>
                  <td className="py-2.5 px-4 text-right text-radar-green font-bold">+{j.new_records}</td>
                  <td className="py-2.5 px-4 text-right text-titanium-400">{j.duration_ms || 0} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
