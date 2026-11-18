'use client';

import React, { useState, useEffect } from 'react';
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
  Briefcase,
  Hotel,
  Palmtree,
  Menu,
  X,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: any;
  badge?: string;
  highlight?: boolean;
}

const REGISTRY_ITEMS: NavItem[] = [
  { href: '/companies', label: 'Firme existente', icon: Building2, badge: '128' },
  { href: '/new-companies', label: 'Firme noi', icon: Sparkles, badge: 'Radar', highlight: true },
  { href: '/pipeline', label: 'Activități', icon: TrendingUp },
];

const PROSPECTING_ITEMS: NavItem[] = [
  { href: '/prospecting/general', label: 'Prospectare generală', icon: Briefcase, badge: '304' },
  { href: '/prospecting/niche', label: 'Hoteluri, pensiuni, auto', icon: Hotel, badge: '25' },
  { href: '/prospecting/tourism', label: 'Unități Turistice', icon: Palmtree, badge: '30.8k' },
];

const CONFIG_ITEMS: NavItem[] = [
  { href: '/settings', label: 'Configurare', icon: Settings },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Handle Escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen]);

  // Lock background scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

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

  // Find active section title for mobile header
  const allNavItems = [...REGISTRY_ITEMS, ...PROSPECTING_ITEMS, ...CONFIG_ITEMS];
  const activeItem = allNavItems.find(
    (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
  );
  const activeLabel = activeItem ? activeItem.label : 'Business Radar';

  // Navigation Links List (reused between desktop aside and mobile drawer)
  const renderNavLinks = (onItemClick?: () => void) => (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      <div className="px-3 py-1.5 text-[10px] font-bold text-titanium-500 uppercase tracking-wider">
        Registru Național
      </div>

      {REGISTRY_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all min-h-[40px] ${
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

      <div className="pt-3 px-3 py-1.5 text-[10px] font-bold text-titanium-500 uppercase tracking-wider">
        Portofolii Prospectare & CRM
      </div>

      {PROSPECTING_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all min-h-[40px] ${
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

      <div className="pt-3 px-3 py-1.5 text-[10px] font-bold text-titanium-500 uppercase tracking-wider">
        Sistem
      </div>

      {CONFIG_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all min-h-[40px] ${
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
  );

  // Security & Logout Footer
  const renderNavFooter = () => (
    <div className="p-4 border-t border-titanium-800 bg-titanium-950/40 text-[11px] space-y-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
          type="button"
          onClick={handleLogout}
          title="Deconectare securizată"
          className="text-[11px] text-titanium-400 hover:text-rose-400 transition-colors flex items-center gap-1 py-1 px-1.5 rounded hover:bg-titanium-800"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Ieșire</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. MOBILE TOP HEADER (visible on screens < 1024px) */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-titanium-900/95 backdrop-blur border-b border-titanium-800 h-14 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="p-2 -ml-1 text-titanium-300 hover:text-white rounded-lg hover:bg-titanium-800 focus:outline-none focus:ring-1 focus:ring-radar-green transition"
            aria-label="Deschide meniul de navigație"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/companies" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-titanium-800 border border-titanium-700 flex items-center justify-center text-radar-green shadow-inner">
              <Compass className="w-4 h-4 radar-pulse" />
            </div>
            <div className="leading-tight">
              <span className="text-xs font-bold text-titanium-100 tracking-tight flex items-center gap-1">
                RADAR BUSINESS
                <span className="w-1.5 h-1.5 rounded-full bg-radar-green"></span>
              </span>
              <span className="text-[10px] text-titanium-400 font-mono block truncate max-w-[150px]">
                {activeLabel}
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-titanium-800 text-radar-green border border-titanium-700">
            LIVE
          </span>
        </div>
      </header>

      {/* 2. MOBILE DRAWER OVERLAY & SIDEBAR (screens < 1024px) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 overflow-hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Sliding Drawer */}
          <aside className="relative w-72 max-w-[85vw] bg-titanium-900 border-r border-titanium-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-titanium-800 flex items-center justify-between">
              <Link
                href="/companies"
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center gap-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-titanium-800 border border-titanium-700 flex items-center justify-center text-radar-green shadow-inner">
                  <Compass className="w-4.5 h-4.5 radar-pulse" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold tracking-wider text-titanium-400 uppercase">National BI</div>
                  <div className="text-xs font-bold text-titanium-100 flex items-center gap-1">
                    RADAR BUSINESS
                    <span className="w-1.5 h-1.5 rounded-full bg-radar-green"></span>
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 rounded-lg text-titanium-400 hover:text-white hover:bg-titanium-800 transition"
                aria-label="Închide meniul"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav Links */}
            {renderNavLinks(() => setIsMobileOpen(false))}

            {/* Footer */}
            {renderNavFooter()}
          </aside>
        </div>
      )}

      {/* 3. DESKTOP PERMANENT SIDEBAR (screens >= 1024px) */}
      <aside className="hidden lg:flex w-64 bg-titanium-900 border-r border-titanium-800 flex-col shrink-0 min-h-screen sticky top-0 h-screen z-20">
        {/* Brand Header */}
        <div className="p-5 border-b border-titanium-800">
          <Link href="/companies" className="flex items-center gap-3">
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

        {/* Desktop Nav Links */}
        {renderNavLinks()}

        {/* Desktop Footer */}
        {renderNavFooter()}
      </aside>
    </>
  );
}
