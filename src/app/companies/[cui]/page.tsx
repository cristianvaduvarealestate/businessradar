import { getDatabase } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Building2,
  ShieldCheck,
  Globe,
  MapPin,
  Calendar,
  FileText,
  TrendingUp,
  Phone,
  Mail,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Clock,
  Layers,
  History,
} from 'lucide-react';
import { getCategoriesForCaen } from '@/lib/caen';

export const dynamic = 'force-dynamic';

export default function CompanyDetailPage({ params }: { params: { cui: string } }) {
  const cui = parseInt(params.cui, 10);
  if (!cui || isNaN(cui)) notFound();

  const db = getDatabase();

  const company = db.prepare('SELECT * FROM companies WHERE cui = ?').get(cui) as any;
  if (!company) notFound();

  const taxRecord = db.prepare('SELECT * FROM tax_records WHERE cui = ?').get(cui) as any;
  const financials = db.prepare('SELECT * FROM financial_records WHERE cui = ? ORDER BY fiscal_year DESC').all(cui) as any[];
  const contacts = db.prepare('SELECT * FROM contact_records WHERE cui = ? ORDER BY confidence_score DESC').all(cui) as any[];
  const opportunities = db.prepare('SELECT * FROM insurance_opportunities WHERE cui = ? ORDER BY confidence_level DESC').all(cui) as any[];
  const pipeline = db.prepare('SELECT * FROM prospect_pipeline WHERE cui = ?').get(cui) as any;
  const auditLogs = db.prepare('SELECT * FROM audit_log WHERE cui = ? ORDER BY id DESC LIMIT 10').all(cui) as any[];

  const categories = getCategoriesForCaen(company.primary_caen || '');

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/companies"
          className="text-xs text-titanium-400 hover:text-radar-green flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Înapoi la Baza Națională
        </Link>
        <div className="flex items-center gap-2 text-xs font-mono text-titanium-500">
          <span>Provenance: ONRC Open Data</span>
          <span>•</span>
          <span>ID: #{company.id}</span>
        </div>
      </div>

      {/* Main Profile Header Banner */}
      <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-titanium-800 border border-titanium-700 text-titanium-300">
                {company.legal_form || 'SRL'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                company.status === 'ACTIVE'
                  ? 'bg-radar-emerald/10 text-radar-green border-radar-emerald/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {company.status === 'ACTIVE' ? 'ACTIVĂ (ÎN FUNCȚIUNE)' : company.status}
              </span>
              {company.website && (
                <a
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-radar-green hover:underline flex items-center gap-1"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {company.website}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <h1 className="text-2xl font-black text-titanium-100 tracking-tight">
              {company.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-titanium-400 font-mono">
              <div>CUI: <strong className="text-titanium-200">{company.cui}</strong></div>
              <div>•</div>
              <div>RegCom: <strong className="text-titanium-200">{company.reg_com || 'Nespecificat'}</strong></div>
              <div>•</div>
              <div>EUID: <span className="text-titanium-300">{company.euid || 'N/A'}</span></div>
            </div>

            <div className="flex items-center gap-2 text-xs text-titanium-400 pt-1">
              <MapPin className="w-3.5 h-3.5 text-titanium-500" />
              <span>
                {company.county}, {company.city}
                {company.street ? `, Str. ${company.street} ${company.street_nr || ''}` : ''}
                {company.postal_code ? ` (Cod ${company.postal_code})` : ''}
              </span>
            </div>
          </div>

          {/* Opportunity Badge Box */}
          <div className="bg-titanium-950 border border-titanium-800 rounded-lg p-4 min-w-[200px] text-right space-y-1">
            <div className="text-[11px] font-semibold text-titanium-400 uppercase tracking-wider">
              Scor Oportunitate BI
            </div>
            <div className="text-3xl font-extrabold text-radar-green font-mono">
              {company.opportunity_score}%
            </div>
            <div className="text-xs text-titanium-400">
              Completitudine Date: <strong className="text-titanium-200">{company.data_completeness_score}%</strong>
            </div>
            <div className="pt-2">
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                company.prospect_priority === 'URGENT' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                company.prospect_priority === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                'bg-titanium-800 text-titanium-300'
              }`}>
                Prioritate Prospectare: {company.prospect_priority}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Details & Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Legal, Tax, Contacts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section: Recommended Insurance Products */}
          <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
              <h2 className="text-sm font-bold text-titanium-100 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-radar-green" />
                Oportunități de Asigurare Recomandate ({opportunities.length})
              </h2>
              <span className="text-[11px] text-titanium-400">Motor Decizional Determinist</span>
            </div>

            {opportunities.length === 0 ? (
              <div className="py-6 text-center text-xs text-titanium-500">
                Nu au fost identificate oportunități de asigurare specifice conform codului CAEN curent.
              </div>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <div key={opp.id} className="p-4 bg-titanium-850/80 border border-titanium-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm text-titanium-100">
                        {opp.product_name}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        opp.estimated_priority === 'URGENT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                        opp.estimated_priority === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                        'bg-titanium-800 text-titanium-400 border-titanium-700'
                      }`}>
                        {opp.estimated_priority}
                      </span>
                    </div>

                    <div className="text-xs text-titanium-300">
                      <strong>Rațiune Brokeraj:</strong> {opp.rationale}
                    </div>

                    <div className="text-[11px] text-titanium-400 bg-titanium-900 p-2.5 rounded border border-titanium-800">
                      <div className="text-titanium-300 font-semibold mb-0.5">Întrebări Cheie pentru Prospectare:</div>
                      {opp.additional_info_needed}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-titanium-500 pt-1 font-mono">
                      <span>Trigger: {opp.trigger_event}</span>
                      <span>Încredere Algoritm: {(opp.confidence_level * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Legal & Corporate Identification */}
          <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-titanium-100 uppercase tracking-wider flex items-center gap-2 border-b border-titanium-800 pb-3">
              <Building2 className="w-4 h-4 text-titanium-400" />
              Identitate Juridică & Înregistrare
            </h2>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-titanium-500">Denumire Oficială:</span>
                <div className="text-titanium-100 font-bold mt-0.5">{company.name}</div>
              </div>
              <div>
                <span className="text-titanium-500">Cod Unic de Înregistrare (CUI):</span>
                <div className="text-titanium-100 font-mono font-bold mt-0.5">{company.cui}</div>
              </div>
              <div>
                <span className="text-titanium-500">Număr Registrul Comerțului:</span>
                <div className="text-titanium-200 font-mono mt-0.5">{company.reg_com || 'Nespecificat'}</div>
              </div>
              <div>
                <span className="text-titanium-500">Data Înmatriculării:</span>
                <div className="text-titanium-200 font-mono mt-0.5">{company.incorporation_date || 'Nespecificat'}</div>
              </div>
              <div>
                <span className="text-titanium-500">Formă Juridică:</span>
                <div className="text-titanium-200 mt-0.5">{company.legal_form || 'SRL'}</div>
              </div>
              <div>
                <span className="text-titanium-500">Țara Origine / Mamă:</span>
                <div className="text-titanium-200 mt-0.5">{company.parent_company_country || company.country || 'România'}</div>
              </div>
            </div>
          </div>

          {/* Section: CAEN Activity Details */}
          <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-titanium-100 uppercase tracking-wider flex items-center gap-2 border-b border-titanium-800 pb-3">
              <Layers className="w-4 h-4 text-titanium-400" />
              Activitate Economică & CAEN
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-titanium-850 rounded-lg border border-titanium-800">
                <div className="flex items-center gap-2 text-radar-green font-mono font-bold">
                  <span>CAEN Principal {company.primary_caen}</span>
                </div>
                <div className="text-titanium-200 mt-1">{company.caen_description}</div>
              </div>

              {categories.length > 0 && (
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-titanium-500 text-xs">Clasificare Sectorială:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((catId) => (
                      <span key={catId} className="px-2 py-0.5 bg-titanium-800 text-titanium-300 rounded text-[11px] font-medium border border-titanium-700">
                        {catId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Contact Coordinates & Pipeline State */}
        <div className="space-y-6">
          {/* Commercial Contact Card */}
          <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-titanium-200 uppercase tracking-wider flex items-center gap-2">
              <Phone className="w-4 h-4 text-radar-green" />
              Date de Contact Comerciale
            </h3>

            {contacts.length === 0 && !company.website ? (
              <div className="text-xs text-titanium-500 py-3 text-center">
                Nu există încă date de contact directe înregistrate.
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {company.website && (
                  <div className="flex items-center justify-between p-2 bg-titanium-850 rounded border border-titanium-800">
                    <span className="text-titanium-400 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-radar-green" />
                      Website
                    </span>
                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-radar-green hover:underline font-mono truncate max-w-[160px]"
                    >
                      {company.website}
                    </a>
                  </div>
                )}

                {contacts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-titanium-850 rounded border border-titanium-800 font-mono text-[11px]">
                    <span className="text-titanium-400">{c.contact_type} ({c.label})</span>
                    <span className="text-titanium-200 font-bold">{c.contact_value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CRM Sales Pipeline Box */}
          <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-titanium-200 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              Status Pipeline Vânzări
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-titanium-400">Etapă Curentă:</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-titanium-800 text-titanium-200 border border-titanium-700">
                  {pipeline?.status || 'NOU DESCOPERIT'}
                </span>
              </div>

              {pipeline?.notes && (
                <div className="p-3 bg-titanium-950 rounded border border-titanium-800 text-[11px] text-titanium-300">
                  <div className="text-titanium-500 font-semibold mb-1">Notițe Broker:</div>
                  {pipeline.notes}
                </div>
              )}

              <Link
                href="/pipeline"
                className="block text-center py-2 bg-titanium-800 hover:bg-titanium-700 text-titanium-100 rounded-lg font-semibold text-xs transition-colors"
              >
                Gestionează în Pipeline CRM
              </Link>
            </div>
          </div>

          {/* Provenance Audit Stamp */}
          <div className="bg-titanium-950 border border-titanium-800/80 rounded-xl p-4 text-[11px] text-titanium-400 space-y-2">
            <div className="font-bold text-titanium-300 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-titanium-500" />
              Pista de Proveniență & Audit
            </div>
            <div>Sursă date: <strong>ONRC Open Data (data.gov.ro)</strong></div>
            <div>Observată prima dată: <strong>{company.first_observed_at}</strong></div>
            <div>Ultima verificare registru: <strong>{company.last_verified_at || 'Recent'}</strong></div>
            <div className="text-[10px] text-titanium-500 pt-1 border-t border-titanium-800">
              Informații conforme cu OGL-RO / GDPR B2B art. 6(1)(f).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
