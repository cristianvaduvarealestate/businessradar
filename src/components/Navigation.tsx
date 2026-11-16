'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Compass,
  Building2,
  Layers,
  ShieldCheck,
  TrendingUp,
  Server,
  HeartPulse,
  Settings,
  BarChart3,
  LogOut,
  ShieldAlert,
  Sparkles,
  PhoneCall,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: BarChart3 },
  { href: '/calling', label: 'Workspace Apeluri', icon: PhoneCall, badge: 'HOT', highlight: true },
  { href: '/radar', label: 'Radar Firme Noi', icon: Compass, badge: 'LIVE' },
  { href: '/companies', label: 'Baza Națională', icon: Building2 },
  { href: '/enrichment', label: 'Motor Contacte B2B', icon: Sparkles, badge: 'AUTO' },
  { href: '/industries', label: 'Sectoare CAEN', icon: Layers },
  { href: '/insurance', label: 'Oportunități Asigurare', icon: ShieldCheck, highlight: true },
  { href: '/pipeline', label: 'Pipeline Vânzări CRM', icon: TrendingUp },
  { href: '/sources', label: 'Management Surse', icon: Server },
  { href: '/health', label: 'Stare Sistem & Watchdog', icon: HeartPulse },
  { href: '/settings', label: 'Configurare & Supresie', icon: Settings },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  // Hide navigation on login page
  if (pathname === '/login') {
    return null;
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  return (
    <aside className="w-64 bg-titanium-900 border-r border-titanium-800 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-titanium-800">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-titanium-800 border border-titanium-700 flex items-center justify-center text-radar-green shadow-inner">
            <Compass className="w-5 h-5 radar-pulse" />
          </div>
          <div>
            <div className="text-xs font-semibold tracking-wider text-titanium-400 uppercase">National BI</div>
            <div className="text-sm font-bold text-titanium-100 flex items-center gap-1.5">
              RADAR BUSINESS
              <span className="w-2 h-2 rounded-full bg-radar-green"></span>
            </div>
          </div>
        </Link>
        <div className="mt-2 text-[11px] text-titanium-400 font-mono">
          businessradar.cristianvaduva.com
        </div>
      </div>

      {/* Main Nav Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-bold text-titanium-500 uppercase tracking-wider">
          Intelligence &amp; Prospectare
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-titanium-800 text-radar-green border border-titanium-700 shadow-sm'
                  : 'text-titanium-300 hover:text-titanium-100 hover:bg-titanium-850'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-radar-green' : 'text-titanium-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-radar-emerald/20 text-radar-green border border-radar-emerald/30">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Security & System Footer */}
      <div className="p-4 border-t border-titanium-800 bg-titanium-950/40 text-[11px] space-y-2.5">
        <div className="flex items-center justify-between text-titanium-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-radar-green"></span>
            Motor Ingestie
          </span>
          <span className="font-mono text-titanium-300">AUTO</span>
        </div>

        <div className="flex items-center justify-between text-[10px] text-titanium-500">
          <span>Securitate</span>
          <span className="text-radar-green font-mono flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Zero Trust
          </span>
        </div>

        <div className="pt-2 border-t border-titanium-850/60 flex items-center justify-between">
          <div className="text-[10px] text-titanium-400 font-mono truncate max-w-[140px]">
            admin
          </div>
          <button
            onClick={handleLogout}
            title="Deconectare securizată"
            className="text-[11px] text-titanium-400 hover:text-rose-400 transition-colors flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Ieșire</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
