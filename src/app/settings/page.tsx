import { getDatabase } from '@/lib/db';
import {
  Settings,
  ShieldAlert,
  Key,
  Bell,
  Sliders,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const db = getDatabase();

  const suppressedCount = (
    db.prepare('SELECT COUNT(*) as count FROM suppression_list').get() as any
  ).count;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="border-b border-titanium-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-titanium-400 uppercase tracking-wider mb-1">
          <Settings className="w-4 h-4" />
          Configurare Platformă
        </div>
        <h1 className="text-2xl font-extrabold text-titanium-100 tracking-tight">
          Setări & Listă de Supresie
        </h1>
        <p className="text-xs text-titanium-400 mt-1">
          Configurarea cheilor de acces, a preferințelor de notificare Telegram și a listei globale de supresie (DO NOT CONTACT) conforme cu normele GDPR.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Suppression List Management */}
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
            <h2 className="text-xs font-bold text-titanium-100 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Listă Globală de Supresie (DO NOT CONTACT)
            </h2>
            <span className="font-mono text-xs text-titanium-400 font-bold">
              {suppressedCount} entități excluse
            </span>
          </div>

          <p className="text-xs text-titanium-400">
            Companiile adăugate în lista de supresie sunt excluse automat din recomandările de oportunități, exporturile CSV și alertele Telegram.
          </p>

          <div className="p-4 bg-titanium-950 rounded-lg border border-titanium-800 text-xs text-titanium-300 space-y-2">
            <div className="font-semibold text-titanium-200">Adaugă CUI în Lista de Supresie:</div>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Introdu CUI pentru excludere..."
                className="flex-1 bg-titanium-900 border border-titanium-700 rounded px-3 py-1.5 text-xs text-titanium-100 focus:outline-none focus:border-rose-400 font-mono"
              />
              <button className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs transition-colors">
                Exclude
              </button>
            </div>
          </div>
        </div>

        {/* Telegram Integration Credentials */}
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
            <h2 className="text-xs font-bold text-titanium-100 uppercase tracking-wider flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-400" />
              Integrare Notificări Telegram
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-titanium-800 text-titanium-300">
              Server-Side Secret
            </span>
          </div>

          <p className="text-xs text-titanium-400">
            Pentru securitate maximă, credențialele Telegram se configurează prin variabilele de mediu server-side (niciodată expuse în codul client sau browser).
          </p>

          <div className="space-y-3 font-mono text-xs">
            <div>
              <span className="text-titanium-500 text-[11px]">TELEGRAM_BOT_TOKEN:</span>
              <div className="p-2 bg-titanium-950 rounded border border-titanium-800 text-titanium-300 flex items-center justify-between mt-1">
                <span>{process.env.TELEGRAM_BOT_TOKEN ? '••••••••••••••••••••••••••••••••' : 'Neconfigurat (Adaugă în .env)'}</span>
                <Lock className="w-3.5 h-3.5 text-titanium-500" />
              </div>
            </div>

            <div>
              <span className="text-titanium-500 text-[11px]">TELEGRAM_CHAT_ID:</span>
              <div className="p-2 bg-titanium-950 rounded border border-titanium-800 text-titanium-300 flex items-center justify-between mt-1">
                <span>{process.env.TELEGRAM_CHAT_ID ? '••••••••••' : 'Neconfigurat (Adaugă în .env)'}</span>
                <Lock className="w-3.5 h-3.5 text-titanium-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Commercial Fallback Providers */}
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
            <h2 className="text-xs font-bold text-titanium-100 uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              Furnizor Comercial Secundar (API Firme)
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Opțional
            </span>
          </div>

          <p className="text-xs text-titanium-400">
            Conector secundar pentru apifirme.dev. În absența cheii API, platforma funcționează complet și independent utilizând sursele deschise directe (ONRC + ANAF + MinFin).
          </p>

          <div className="space-y-2 text-xs font-mono">
            <span className="text-titanium-500 text-[11px]">APIFIRME_API_KEY:</span>
            <div className="p-2 bg-titanium-950 rounded border border-titanium-800 text-titanium-400 flex items-center justify-between">
              <span>{process.env.APIFIRME_API_KEY ? 'Configurat' : 'Neactivat (Opțional)'}</span>
              <Lock className="w-3.5 h-3.5 text-titanium-500" />
            </div>
          </div>
        </div>

        {/* Compliance & Data Protection Policy */}
        <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-4 text-xs">
          <h2 className="font-bold text-titanium-100 uppercase tracking-wider flex items-center gap-2 border-b border-titanium-800 pb-3">
            <CheckCircle2 className="w-4 h-4 text-radar-green" />
            Conformitate GDPR & Date B2B
          </h2>

          <div className="space-y-2 text-titanium-400 leading-relaxed">
            <p>
              Platforma colectează și prelucrează exclusiv date publice despre persoane juridice în temeiul <strong>Art. 6(1)(f) GDPR</strong> (Interes legitim de analiză economică și brokeraj corporativ).
            </p>
            <p>
              Nu sunt stocate sau prelucrate profiluri personale, rețele de socializare private sau date ale consumatorilor individuali.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
