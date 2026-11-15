'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Filter,
  Download,
  Building2,
  Globe,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  CheckCircle2,
  Phone,
  Mail,
  Smartphone,
  PhoneCall,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

function CompaniesContent() {
  const searchParams = useSearchParams();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Filters
  const [query, setQuery] = useState(searchParams?.get('q') || '');
  const [county, setCounty] = useState(searchParams?.get('county') || '');
  const [priority, setPriority] = useState(searchParams?.get('priority') || '');
  const [status, setStatus] = useState(searchParams?.get('status') || '');
  const [stage, setStage] = useState(searchParams?.get('stage') || '');
  const [contactFilter, setContactFilter] = useState(
    searchParams?.get('hasPhone') === 'true' ? 'hasPhone' :
    searchParams?.get('hasMobile') === 'true' ? 'hasMobile' :
    searchParams?.get('hasLandline') === 'true' ? 'hasLandline' :
    searchParams?.get('hasEmail') === 'true' ? 'hasEmail' :
    searchParams?.get('hasWebsite') === 'true' ? 'hasWebsite' :
    searchParams?.get('hasAnyContact') === 'true' ? 'hasAnyContact' :
    searchParams?.get('noContact') === 'true' ? 'noContact' :
    searchParams?.get('needsVerification') === 'true' ? 'needsVerification' : ''
  );

  const fetchCompanies = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
      });
      if (query) params.set('q', query);
      if (county) params.set('county', county);
      if (priority) params.set('priority', priority);
      if (status) params.set('status', status);
      if (stage) params.set('stage', stage);

      if (contactFilter === 'hasPhone') params.set('hasPhone', 'true');
      if (contactFilter === 'hasMobile') params.set('hasMobile', 'true');
      if (contactFilter === 'hasLandline') params.set('hasLandline', 'true');
      if (contactFilter === 'hasEmail') params.set('hasEmail', 'true');
      if (contactFilter === 'hasWebsite') params.set('hasWebsite', 'true');
      if (contactFilter === 'hasAnyContact') params.set('hasAnyContact', 'true');
      if (contactFilter === 'noContact') params.set('noContact', 'true');
      if (contactFilter === 'needsVerification') params.set('needsVerification', 'true');

      const res = await fetch(`/api/companies?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.data) {
        setItems(data.data.items || []);
        const pag = data.data.pagination || {};
        setPagination({
          page: pag.page || 1,
          limit: pag.limit || 25,
          total: typeof pag.total === 'number' ? pag.total : (pag.totalItems || 0),
          totalPages: pag.totalPages || 1,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies(1);
  }, [county, priority, status, stage, contactFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCompanies(1);
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (county) params.set('county', county);
    if (priority) params.set('priority', priority);
    window.open(`/api/export?${params.toString()}`, '_blank');
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-titanium-800 pb-5">
        <div>
          <div className="text-xs font-semibold text-titanium-400 uppercase tracking-wider">
            Baza Națională de Date & Intelligence
          </div>
          <h1 className="text-2xl font-extrabold text-titanium-100 tracking-tight">
            Explorator Companii Românești
          </h1>
          <p className="text-xs text-titanium-400 mt-1">
            Total {(pagination?.total ?? 0).toLocaleString('ro-RO')} entități economice verificate în registru.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="px-4 py-2 bg-titanium-800 hover:bg-titanium-700 text-titanium-100 text-xs font-semibold rounded-lg border border-titanium-700 flex items-center gap-2 transition-colors self-start md:self-auto"
        >
          <Download className="w-4 h-4 text-radar-green" />
          Exportă Rezultate (CSV)
        </button>
      </div>

      {/* Search & Advanced Filters Bar */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-titanium-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caută după CUI, denumire companie, nr. RegCom sau oraș..."
              className="w-full pl-10 pr-4 py-2 bg-titanium-950 border border-titanium-800 rounded-lg text-xs text-titanium-100 placeholder-titanium-500 focus:outline-none focus:border-radar-green font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 bg-radar-green text-titanium-950 font-bold text-xs rounded-lg hover:bg-emerald-400 transition-colors"
          >
            Caută
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-titanium-800 text-xs">
          <div className="flex items-center gap-1.5 text-titanium-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtrează:</span>
          </div>

          <select
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="bg-titanium-950 border border-titanium-800 text-titanium-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-radar-green"
          >
            <option value="">Toate Județele</option>
            <option value="Bucureşti">București</option>
            <option value="Cluj">Cluj</option>
            <option value="Timiş">Timiș</option>
            <option value="Ilfov">Ilfov</option>
            <option value="Iaşi">Iași</option>
            <option value="Braşov">Brașov</option>
            <option value="Constanţa">Constanța</option>
            <option value="Bihor">Bihor</option>
            <option value="Prahova">Prahova</option>
            <option value="Dolj">Dolj</option>
            <option value="Argeş">Argeș</option>
          </select>

          <select
            value={contactFilter}
            onChange={(e) => setContactFilter(e.target.value)}
            className="bg-titanium-950 border border-titanium-800 text-titanium-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-radar-green"
          >
            <option value="">Toate contactele</option>
            <option value="hasAnyContact">Are orice contact identificat</option>
            <option value="hasMobile">Doar cu mobil (+407...)</option>
            <option value="hasLandline">Doar cu telefon fix (+402/+403)</option>
            <option value="hasPhone">Cu orice telefon</option>
            <option value="hasEmail">Doar cu adresă de email</option>
            <option value="hasWebsite">Doar cu website oficial</option>
            <option value="noContact">Fără date de contact încă</option>
            <option value="needsVerification">Contacte ce necesită verificare</option>
          </select>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="bg-titanium-950 border border-titanium-800 text-titanium-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-radar-green"
          >
            <option value="">Toate Prioritățile</option>
            <option value="URGENT">Urgent (Scor &gt; 85%)</option>
            <option value="HIGH">Ridicată (Scor &gt; 70%)</option>
            <option value="STANDARD">Standard</option>
          </select>

          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="bg-titanium-950 border border-titanium-800 text-titanium-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-radar-green"
          >
            <option value="">Toate Etapele CRM</option>
            <option value="NEW">Nou</option>
            <option value="TO_CONTACT">De contactat</option>
            <option value="CONTACTED">Contactat</option>
            <option value="IN_DISCUSSION">În discuție</option>
            <option value="INTERESTED">Interesat</option>
            <option value="OFFER_SENT">Ofertă transmisă</option>
            <option value="CLIENT_WON">Client câștigat</option>
            <option value="LOST">Pierdut</option>
          </select>

          {(county || priority || status || stage || contactFilter || query) && (
            <button
              onClick={() => {
                setCounty('');
                setPriority('');
                setStatus('');
                setStage('');
                setContactFilter('');
                setQuery('');
              }}
              className="text-titanium-400 hover:text-white flex items-center gap-1 ml-auto"
            >
              <RefreshCw className="w-3 h-3" />
              Resetează
            </button>
          )}
        </div>
      </div>

      {/* Companies Data Table */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-titanium-800 bg-titanium-950/60 text-titanium-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="p-4">Companie & CUI</th>
                <th className="p-4">Sediu & RegCom</th>
                <th className="p-4">Activitate Principală (CAEN)</th>
                <th className="p-4">Etapă CRM & Contacte</th>
                <th className="p-4 text-right">Scor BI</th>
                <th className="p-4 text-center">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-titanium-500 font-mono">
                    Se încarcă companiile din baza de date...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-titanium-500">
                    Nicio companie găsită conform criteriilor selectate.
                  </td>
                </tr>
              ) : (
                items.map((company) => (
                  <tr key={company.id} className="hover:bg-titanium-850/60 transition-colors">
                    <td className="p-4 font-mono">
                      <Link
                        href={`/companies/${company.cui}`}
                        className="font-bold text-sm text-titanium-100 hover:text-radar-green transition-colors block font-sans"
                      >
                        {company.name}
                      </Link>
                      <div className="text-titanium-400 text-xs mt-0.5 flex items-center gap-2">
                        <span>CUI: <strong className="text-titanium-200">{company.cui}</strong></span>
                        <span>•</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-titanium-800 text-titanium-300">
                          {company.legal_form || 'SRL'}
                        </span>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="text-titanium-200 font-medium">
                        {company.county}, {company.city}
                      </div>
                      <div className="text-titanium-500 font-mono text-[11px] mt-0.5">
                        {company.reg_com || 'Nespecificat'}
                      </div>
                    </td>

                    <td className="p-4 max-w-xs">
                      <div className="font-mono text-radar-green font-bold text-[11px]">
                        CAEN {company.primary_caen}
                      </div>
                      <div className="text-titanium-300 truncate text-[11px] mt-0.5" title={company.caen_description}>
                        {company.caen_description}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-titanium-800 text-titanium-300 border border-titanium-700 w-fit">
                          {company.crm_status || 'NOU'}
                        </span>

                        <div className="flex items-center gap-2 text-[11px] text-titanium-400 pt-0.5">
                          {company.sample_phone ? (
                            <a
                              href={`tel:${company.sample_phone}`}
                              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono font-medium bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/20"
                              title={`Sună ${company.sample_phone}`}
                            >
                              <Phone className="w-3 h-3" />
                              {company.sample_phone}
                            </a>
                          ) : null}

                          {company.sample_email ? (
                            <a
                              href={`mailto:${company.sample_email}`}
                              className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-mono font-medium bg-purple-950/30 px-1.5 py-0.5 rounded border border-purple-500/20"
                              title={`Email: ${company.sample_email}`}
                            >
                              <Mail className="w-3 h-3" />
                              {company.sample_email}
                            </a>
                          ) : null}

                          {company.website ? (
                            <a
                              href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 flex items-center gap-0.5 bg-blue-950/30 px-1.5 py-0.5 rounded border border-blue-500/20"
                              title={`Website: ${company.website}`}
                            >
                              <Globe className="w-3 h-3" />
                            </a>
                          ) : null}

                          {!company.website && !company.sample_phone && !company.sample_email && (
                            <span className="text-titanium-600 text-[10px] italic">Fără contact</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="p-4 text-right font-mono">
                      <div className="text-base font-bold text-radar-green">
                        {company.opportunity_score}%
                      </div>
                      <div className="text-[10px] text-titanium-500">
                        {company.prospect_priority}
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      <Link
                        href={`/companies/${company.cui}`}
                        className="px-3 py-1.5 bg-titanium-800 hover:bg-titanium-700 text-titanium-100 rounded-lg text-xs font-semibold border border-titanium-700 transition-colors inline-block"
                      >
                        Dosar & CRM
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-titanium-800 bg-titanium-950/40 flex items-center justify-between text-xs text-titanium-400">
          <div>
            Afișate {(pagination.page - 1) * pagination.limit + 1} -{' '}
            {Math.min(pagination.page * pagination.limit, pagination?.total ?? 0)} din {pagination?.total ?? 0} companii
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchCompanies(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="p-1.5 rounded-lg bg-titanium-800 border border-titanium-700 text-titanium-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-titanium-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-titanium-200">
              Pagina {pagination.page} din {pagination.totalPages}
            </span>
            <button
              onClick={() => fetchCompanies(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="p-1.5 rounded-lg bg-titanium-800 border border-titanium-700 text-titanium-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-titanium-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default function CompaniesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      }
    >
      <CompaniesContent />
    </Suspense>
  );
}
