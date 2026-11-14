import Link from 'next/link';
import {
  Layers,
  ArrowRight,
  Hotel,
  Compass,
  Key,
  Home,
  Building2,
  Hammer,
  Cpu,
  Car,
  Truck,
  Activity,
  Factory,
  ShoppingBag,
  Briefcase,
  GraduationCap,
  Tractor,
  Zap,
  Sparkles,
  Music,
  ShieldCheck,
} from 'lucide-react';
import { INDUSTRY_CATEGORIES } from '@/lib/caen';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function IndustriesIndexPage() {
  const db = getDatabase();

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="border-b border-titanium-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-radar-green uppercase tracking-wider mb-1">
          <Layers className="w-4 h-4" />
          Clasificare Sectorială CAEN Rev. 2 / Rev. 3
        </div>
        <h1 className="text-2xl font-extrabold text-titanium-100 tracking-tight">
          Sectoare Economice & Industrii
        </h1>
        <p className="text-xs text-titanium-400 mt-1">
          Explorare verticală pe cele 20 de categorii macroeconomice din România pentru campanii de brokeraj specializate.
        </p>
      </div>

      {/* 20 Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.values(INDUSTRY_CATEGORIES).map((cat) => {
          // Count companies in this category
          const orPrefixes = cat.caenPrefixes.map(() => 'primary_caen LIKE ?').join(' OR ');
          const params = cat.caenPrefixes.map((p) => `${p}%`);
          const count = (
            db.prepare(`SELECT COUNT(*) as count FROM companies WHERE ${orPrefixes}`).get(...params) as any
          ).count;

          return (
            <Link
              key={cat.id}
              href={`/industries/${cat.id}`}
              className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-5 transition-all flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-radar-green font-semibold">
                    {cat.caenPrefixes.length} prefixe CAEN
                  </span>
                  <span className="font-mono text-xs font-bold text-titanium-200">
                    {count.toLocaleString('ro-RO')} companii
                  </span>
                </div>

                <h2 className="text-base font-bold text-titanium-100 group-hover:text-radar-green transition-colors">
                  {cat.nameRo}
                </h2>

                <p className="text-xs text-titanium-400 line-clamp-2">
                  {cat.description}
                </p>
              </div>

              <div className="pt-3 border-t border-titanium-800 flex items-center justify-between text-xs text-titanium-400 font-medium">
                <span>Explorează companiile</span>
                <ArrowRight className="w-4 h-4 text-radar-green group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
