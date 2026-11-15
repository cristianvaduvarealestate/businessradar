'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, AlertCircle, ArrowRight, Compass } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, key }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Autentificare eșuată.');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError('Eroare de rețea. Vă rugăm reîncercați.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-titanium-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-titanium-900 border border-titanium-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-titanium-800 border border-titanium-700 flex items-center justify-center text-radar-green mb-3 shadow-inner">
            <Compass className="w-6 h-6 radar-pulse" />
          </div>
          <h1 className="text-xl font-bold text-titanium-100 tracking-tight">
            RADAR BUSINESS ROMÂNIA
          </h1>
          <p className="text-xs text-titanium-400 mt-1 uppercase tracking-wider font-semibold">
            Sistem Privat de Inteligență Economică
          </p>
          <div className="mt-3 px-3 py-1 rounded-full bg-titanium-850 border border-titanium-700 text-[11px] text-titanium-300 flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-radar-green" />
            Acces Restricționat Administratorilor Autorizați
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-titanium-300 mb-1">
              Email Administrator Autorizat
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nume@domeniu.ro"
              className="w-full px-3.5 py-2.5 bg-titanium-950 border border-titanium-700 rounded-lg text-sm text-titanium-100 placeholder-titanium-500 focus:outline-none focus:border-radar-green transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-titanium-300 mb-1">
              Cheie de Acces / Passkey Securizat
            </label>
            <input
              type="password"
              required
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full px-3.5 py-2.5 bg-titanium-950 border border-titanium-700 rounded-lg text-sm text-titanium-100 placeholder-titanium-500 focus:outline-none focus:border-radar-green transition-colors font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-radar-green text-titanium-950 font-semibold text-xs rounded-lg hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <span>Verificare identitate...</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Autentificare Securizată</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-titanium-800 text-center">
          <p className="text-[11px] text-titanium-500">
            Platformă protejată prin Cloudflare Zero Trust Access &amp; HSTS.
            <br />
            Toate tentativele de acces neautorizat sunt înregistrate în audit log.
          </p>
        </div>
      </div>
    </div>
  );
}
