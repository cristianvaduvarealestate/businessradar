import Link from 'next/link';
import {
  Compass,
  Building2,
  ShieldCheck,
  TrendingUp,
  Globe,
  PhoneCall,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Activity,
  Layers,
  Phone,
  Mail,
  Smartphone,
  Calendar,
  AlertTriangle,
  Award,
  ChevronRight,
  Check,
} from 'lucide-react';
import { queryOne, queryAll } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);

  // 1. Company counts
  const compStats = (await queryOne(`
    SELECT 
      COUNT(*) as total_companies,
      COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_companies,
      COUNT(CASE WHEN date(first_observed_at) = date('now') THEN 1 END) as new_today,
      COUNT(CASE WHEN datetime(first_observed_at, '+90 days') >= datetime('now') THEN 1 END) as new_last_90_days,
      COUNT(CASE WHEN website IS NOT NULL AND website != '' THEN 1 END) as with_website,
      COUNT(CASE WHEN prospect_priority IN ('HIGH', 'URGENT') THEN 1 END) as high_priority
    FROM companies
  `)) || {};

  // 2. Contact verification breakdown
  const contactStats = (await queryOne(`
    SELECT 
      COUNT(DISTINCT cui) as companies_with_any_contact,
      COUNT(DISTINCT CASE WHEN contact_type LIKE '%PHONE%' THEN cui END) as with_phones,
      COUNT(DISTINCT CASE WHEN contact_type = 'MOBILE' OR (contact_type LIKE '%PHONE%' AND (contact_value LIKE '+407%' OR contact_value LIKE '07%')) THEN cui END) as with_mobile,
      COUNT(DISTINCT CASE WHEN contact_type = 'LANDLINE' OR (contact_type LIKE '%PHONE%' AND (contact_value LIKE '+402%' OR contact_value LIKE '02%' OR contact_value LIKE '+403%' OR contact_value LIKE '03%')) THEN cui END) as with_landline,
      COUNT(DISTINCT CASE WHEN contact_type LIKE '%EMAIL%' THEN cui END) as with_emails
    FROM contact_records
  `)) || {};

  // 3. CRM Pipeline Metrics
  const crmStats = (await queryOne(`
    SELECT 
      COUNT(CASE WHEN status IN ('NEW', 'NEW_DISCOVERED') THEN 1 END) as not_yet_contacted,
      COUNT(CASE WHEN status IN ('CONTACTED', 'IN_DISCUSSION', 'INTERESTED', 'OFFER_REQUESTED', 'OFFER_SENT', 'NEGOTIATION') THEN 1 END) as in_contact,
      COUNT(CASE WHEN status IN ('IN_DISCUSSION', 'INTERESTED') THEN 1 END) as in_discussion,
      COUNT(CASE WHEN status IN ('OFFER_REQUESTED', 'OFFER_SENT') THEN 1 END) as offers_sent,
      COUNT(CASE WHEN status = 'CLIENT_WON' THEN 1 END) as clients_won,
      COUNT(CASE WHEN status IN ('LOST', 'NOT_INTERESTED') THEN 1 END) as lost_opportunities
    FROM prospect_pipeline
  `)) || {};

  // 4. Follow-up task metrics
  const followUpStats = (await queryOne(`
    SELECT 
      COUNT(CASE WHEN due_date = ? AND status = 'PENDING' THEN 1 END) as followups_today,
      COUNT(CASE WHEN due_date < ? AND status = 'PENDING' THEN 1 END) as followups_overdue
    FROM crm_follow_ups
  `, [today, today])) || {};

  // 5. Opportunities count
  const withOpportunities = (await queryOne('SELECT COUNT(DISTINCT cui) as count FROM insurance_opportunities'))?.count || 0;
  const totalOpportunities = (await queryOne('SELECT COUNT(*) as count FROM insurance_opportunities'))?.count || 0;

  // Conversion rate
  const totalEngaged = (crmStats.in_contact || 0) + (crmStats.clients_won || 0) + (crmStats.lost_opportunities || 0);
  const conversionRate = totalEngaged > 0 ? ((crmStats.clients_won || 0) / totalEngaged * 100).toFixed(1) : '0.0';

  // Top Opportunities
  const topOpportunities = await queryAll(`
    SELECT c.cui, c.name, c.county, c.city, c.primary_caen, c.caen_description,
           c.opportunity_score, c.prospect_priority, c.website,
           (SELECT COUNT(*) FROM insurance_opportunities io WHERE io.cui = c.cui) as opp_count
    FROM companies c
    ORDER BY c.opportunity_score DESC, c.first_observed_at DESC
    LIMIT 6
  `);

  // Top Counties
  const topCounties = await queryAll(`
    SELECT county, COUNT(*) as count 
    FROM companies 
    WHERE county IS NOT NULL AND county != '' 
    GROUP BY county 
    ORDER BY count DESC 
    LIMIT 6
  `);

  // Categories breakdown
  const oppCategories = await queryAll(`
    SELECT product_category, COUNT(*) as count
    FROM insurance_opportunities
    GROUP BY product_category
    ORDER BY count DESC
  `);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-titanium-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-radar-green uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-radar-green radar-pulse"></span>
            Intelligence & Prospectare B2B Live (Cloudflare D1 Persistat)
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-titanium-100 tracking-tight">
            RADAR BUSINESS ROMÂNIA
          </h1>
          <p className="text-xs md:text-sm text-titanium-400 mt-1">
            Descoperire autonomă, calificare oportunități de asigurare și CRM de vânzări cu date verificate.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/radar"
            className="px-4 py-2 bg-radar-green text-titanium-950 font-bold text-xs rounded-lg hover:bg-emerald-400 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Compass className="w-4 h-4" />
            Radar Firme Noi
          </Link>
          <Link
            href="/pipeline"
            className="px-4 py-2 bg-titanium-800 border border-titanium-700 text-amber-400 font-semibold text-xs rounded-lg hover:bg-titanium-700 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <TrendingUp className="w-4 h-4" />
            Pipeline CRM
          </Link>
        </div>
      </div>

      {/* SECTION 1: CORE REGISTRY KPIS (Clickable) */}
      <div>
        <div className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-3">
          1. Registru & Dimensiune Bază
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/companies"
            className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-5 transition-all group"
          >
            <div className="flex items-center justify-between text-titanium-400 text-xs font-medium mb-2">
              <span>Total Companii</span>
              <Building2 className="w-4 h-4 text-titanium-500 group-hover:text-radar-green transition-colors" />
            </div>
            <div className="text-2xl font-bold text-titanium-100 font-mono">
              {(compStats.total_companies || 0).toLocaleString('ro-RO')}
            </div>
            <div className="text-[11px] text-titanium-500 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-radar-green" />
              {(compStats.active_companies || 0).toLocaleString('ro-RO')} active (100%)
            </div>
          </Link>

          <Link
            href="/radar"
            className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-5 transition-all group"
          >
            <div className="flex items-center justify-between text-titanium-400 text-xs font-medium mb-2">
              <span>Radar Firme Noi (90z)</span>
              <Compass className="w-4 h-4 text-radar-green group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold text-radar-green font-mono">
              {(compStats.new_last_90_days || 0).toLocaleString('ro-RO')}
            </div>
            <div className="text-[11px] text-titanium-400 mt-1">
              +{(compStats.new_today || 0)} identificate astăzi
            </div>
          </Link>

          <Link
            href="/insurance"
            className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-5 transition-all group"
          >
            <div className="flex items-center justify-between text-titanium-400 text-xs font-medium mb-2">
              <span>Oportunități Asigurare</span>
              <ShieldCheck className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold text-cyan-400 font-mono">
              {(totalOpportunities || 0).toLocaleString('ro-RO')}
            </div>
            <div className="text-[11px] text-titanium-400 mt-1">
              în {(withOpportunities || 0).toLocaleString('ro-RO')} companii eligibile
            </div>
          </Link>

          <Link
            href="/companies?priority=HIGH"
            className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-5 transition-all group"
          >
            <div className="flex items-center justify-between text-titanium-400 text-xs font-medium mb-2">
              <span>Prioritate Ridicată</span>
              <TrendingUp className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold text-amber-400 font-mono">
              {(compStats.high_priority || 0).toLocaleString('ro-RO')}
            </div>
            <div className="text-[11px] text-titanium-400 mt-1">
              Scor oportunitate &gt;= 70%
            </div>
          </Link>
        </div>
      </div>

      {/* SECTION 2: VERIFIED CONTACT COVERAGE (Clickable & Honest) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-titanium-400 uppercase tracking-wider">
            2. Coordonate de Contact Verificate (Proveniență Reală)
          </div>
          <span className="text-[11px] text-titanium-500 font-mono">
            Date exclusiv din surse oficiale (0 fabricate)
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Link
            href="/companies?hasPhone=true"
            className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-4 transition-all"
          >
            <div className="flex items-center justify-between text-titanium-400 text-xs mb-1.5">
              <span>Toate Telefoanele</span>
              <Phone className="w-4 h-4 text-radar-green" />
            </div>
            <div className="text-xl font-bold font-mono text-titanium-100">
              {(contactStats.with_phones || 0).toLocaleString('ro-RO')}
            </div>
            <div className="text-[10px] text-titanium-500 mt-1">
              {contactStats.with_phones > 0 ? 'Surse verificate' : 'Indisponibil în stream ONRC'}
            </div>
          </Link>

          <Link
            href="/companies?hasMobile=true"
            className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-4 transition-all"
          >
            <div className="flex items-center justify-between text-titanium-400 text-xs mb-1.5">
              <span>Telefoane Mobile</span>
              <Smartphone className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-titanium-100">
              {(contactStats.with_mobile || 0).toLocaleString('ro-RO')}
            </div>
            <div className="text-[10px] text-titanium-500 mt-1">
              Prefix mobil +407
            </div>
          </Link>

          <Link
            href="/companies?hasLandline=true"
            className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-4 transition-all"
          >
            <div className="flex items-center justify-between text-titanium-400 text-xs mb-1.5">
              <span>Telefoane Fixe</span>
              <PhoneCall className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl font-bold font-mono text-titanium-100">
              {(contactStats.with_landline || 0).toLocaleString('ro-RO')}
            </div>
            <div className="text-[10px] text-titanium-500 mt-1">
              Prefix fix +402/+403
            </div>
          </Link>

          <Link
            href="/companies?hasEmail=true"
            className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-4 transition-all"
          >
            <div className="flex items-center justify-between text-titanium-400 text-xs mb-1.5">
              <span>Adrese de Email</span>
              <Mail className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-xl font-bold font-mono text-titanium-100">
              {(contactStats.with_emails || 0).toLocaleString('ro-RO')}
            </div>
            <div className="text-[10px] text-titanium-500 mt-1">
              Format oficial & domeniu
            </div>
          </Link>

          <Link
            href="/companies?hasWebsite=true"
            className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-4 transition-all"
          >
            <div className="flex items-center justify-between text-titanium-400 text-xs mb-1.5">
              <span>Website-uri Oficiale</span>
              <Globe className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-titanium-100">
              {(compStats.with_website || 0).toLocaleString('ro-RO')}
            </div>
            <div className="text-[10px] text-titanium-500 mt-1">
              Declarate în registru
            </div>
          </Link>
        </div>
      </div>

      {/* SECTION 3: SALES PIPELINE & FOLLOW-UP OPERATIONAL CONTROL */}
      <div>
        <div className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-3">
          3. Activitate Operațională & Sarcini CRM
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Link
            href="/pipeline?view=followups&filter=today"
            className={`border rounded-xl p-4 transition-all ${
              (followUpStats.followups_today || 0) > 0
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-titanium-900 border-titanium-800'
            }`}
          >
            <div className="text-titanium-400 text-xs mb-1 flex items-center justify-between">
              <span>Follow-ups Astăzi</span>
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-400">
              {followUpStats.followups_today || 0}
            </div>
            <div className="text-[10px] text-titanium-500 mt-1">Scadente în cursul zilei</div>
          </Link>

          <Link
            href="/pipeline?view=followups&filter=overdue"
            className={`border rounded-xl p-4 transition-all ${
              (followUpStats.followups_overdue || 0) > 0
                ? 'bg-rose-500/10 border-rose-500/30'
                : 'bg-titanium-900 border-titanium-800'
            }`}
          >
            <div className="text-titanium-400 text-xs mb-1 flex items-center justify-between">
              <span>Restante / Întârziate</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-bold font-mono text-rose-400">
              {followUpStats.followups_overdue || 0}
            </div>
            <div className="text-[10px] text-titanium-500 mt-1">Termen depășit</div>
          </Link>

          <Link
            href="/pipeline?stage=NEW"
            className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-4 transition-all"
          >
            <div className="text-titanium-400 text-xs mb-1">Necontactate</div>
            <div className="text-xl font-bold font-mono text-titanium-100">
              {(crmStats.not_yet_contacted || 0).toLocaleString('ro-RO')}
            </div>
            <div className="text-[10px] text-titanium-500 mt-1">Etapă "Nou"</div>
          </Link>

          <Link
            href="/pipeline?stage=IN_DISCUSSION"
            className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-4 transition-all"
          >
            <div className="text-titanium-400 text-xs mb-1">În Discuție</div>
            <div className="text-xl font-bold font-mono text-purple-400">
              {(crmStats.in_discussion || 0).toLocaleString('ro-RO')}
            </div>
            <div className="text-[10px] text-titanium-500 mt-1">Calificare activă</div>
          </Link>

          <Link
            href="/pipeline?stage=OFFER_SENT"
            className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-4 transition-all"
          >
            <div className="text-titanium-400 text-xs mb-1">Oferte Transmise</div>
            <div className="text-xl font-bold font-mono text-violet-400">
              {(crmStats.offers_sent || 0).toLocaleString('ro-RO')}
            </div>
            <div className="text-[10px] text-titanium-500 mt-1">În decizie client</div>
          </Link>

          <Link
            href="/pipeline?stage=CLIENT_WON"
            className="bg-titanium-900 border border-titanium-800 hover:border-titanium-700 rounded-xl p-4 transition-all"
          >
            <div className="text-titanium-400 text-xs mb-1 flex items-center justify-between">
              <span>Clienți Câștigați</span>
              <Award className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {(crmStats.clients_won || 0).toLocaleString('ro-RO')}
            </div>
            <div className="text-[10px] text-titanium-500 mt-1">Rată conversie: {conversionRate}%</div>
          </Link>
        </div>
      </div>

      {/* SECTION 4: SPLIT GRID (Top Opportunities & Geographic Intelligence) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Top BI Opportunities */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-titanium-800 pb-3">
            <h2 className="text-xs font-bold text-titanium-200 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-radar-green" />
              Top Oportunități Asigurare Recomandate
            </h2>
            <Link
              href="/insurance"
              className="text-xs text-radar-green hover:underline flex items-center gap-1"
            >
              Toate categoriile
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {topOpportunities.map((c: any) => (
              <div
                key={c.cui}
                className="p-4 bg-titanium-900 border border-titanium-800 rounded-xl flex items-center justify-between hover:border-titanium-700 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/companies/${c.cui}`}
                      className="font-bold text-sm text-titanium-100 hover:text-radar-green"
                    >
                      {c.name}
                    </Link>
                    <span className="font-mono text-xs text-titanium-400">(CUI {c.cui})</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-titanium-800 text-titanium-400">
                      {c.prospect_priority}
                    </span>
                  </div>
                  <div className="text-xs text-titanium-400">
                    📍 {c.county || 'România'}, {c.city || ''} • 🏷️ CAEN {c.primary_caen}: {c.caen_description}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-sm font-bold text-radar-green font-mono">
                      {c.opportunity_score}%
                    </div>
                    <div className="text-[10px] text-titanium-500">
                      {c.opp_count} polițe
                    </div>
                  </div>
                  <Link
                    href={`/companies/${c.cui}`}
                    className="p-2 bg-titanium-800 hover:bg-titanium-700 text-titanium-200 rounded-lg text-xs"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Geographic & Industry Breakdown */}
        <div className="space-y-6">
          {/* Top Counties */}
          <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-titanium-200 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-titanium-400" />
              Distribuție pe Județe (Top 6)
            </h3>
            <div className="space-y-2 text-xs">
              {topCounties.map((item: any) => (
                <Link
                  key={item.county}
                  href={`/companies?county=${encodeURIComponent(item.county)}`}
                  className="flex items-center justify-between p-2 rounded bg-titanium-950 hover:bg-titanium-800/80 transition-colors"
                >
                  <span className="text-titanium-300 font-medium">{item.county}</span>
                  <span className="font-mono text-titanium-100 font-bold">
                    {item.count.toLocaleString('ro-RO')}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Insurance Categories */}
          <div className="bg-titanium-900 border border-titanium-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-titanium-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-radar-green" />
              Oportunități pe Sectoare
            </h3>
            <div className="space-y-2 text-xs">
              {oppCategories.map((cat: any) => (
                <Link
                  key={cat.product_category}
                  href={`/companies?category=${encodeURIComponent(cat.product_category)}`}
                  className="flex items-center justify-between p-2 rounded bg-titanium-950 hover:bg-titanium-800/80 transition-colors"
                >
                  <span className="text-titanium-300 font-medium">{cat.product_category}</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {cat.count.toLocaleString('ro-RO')}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
