'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Globe,
  ShieldCheck,
  Phone,
  Mail,
  Smartphone,
  PhoneCall,
  RefreshCw,
  ExternalLink,
  X,
  Copy,
  Check,
  Calendar,
  Clock,
  User,
  FileText,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Send,
  Sparkles,
  CheckCircle2,
  PhoneOutgoing,
} from 'lucide-react';

interface CompanyProfileDrawerProps {
  cui: number | null;
  onClose: () => void;
  onRecordUpdated?: () => void;
}

export default function CompanyProfileDrawer({
  cui,
  onClose,
  onRecordUpdated,
}: CompanyProfileDrawerProps) {
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [verifyingLive, setVerifyingLive] = useState(false);
  const [liveCheckResult, setLiveCheckResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // CRM Interaction form state
  const [interactionOutcome, setInteractionOutcome] = useState('REACHED_DECISION_MAKER');
  const [interactionNotes, setInteractionNotes] = useState('');
  const [interactionContactValue, setInteractionContactValue] = useState('');
  const [interactionContactPerson, setInteractionContactPerson] = useState('');
  const [interactionVerifyContact, setInteractionVerifyContact] = useState(false);
  const [interactionFollowUpDate, setInteractionFollowUpDate] = useState('');
  const [interactionFollowUpTitle, setInteractionFollowUpTitle] = useState('');
  const [interactionSubmitting, setInteractionSubmitting] = useState(false);
  const [interactionSuccess, setInteractionSuccess] = useState(false);

  useEffect(() => {
    if (!cui) {
      setDetailData(null);
      return;
    }

    let isMounted = true;
    setDetailLoading(true);
    setLiveCheckResult(null);
    setInteractionSuccess(false);

    fetch(`/api/companies/${cui}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.data) {
          setDetailData(data.data);
          const firstPhone = data.data.contacts?.find(
            (c: any) => c.contact_type === 'MOBILE' || c.contact_type === 'LANDLINE'
          );
          if (firstPhone) {
            setInteractionContactValue(firstPhone.contact_value || '');
          }
        }
      })
      .catch((err) => console.error('Failed to load company detail:', err))
      .finally(() => {
        if (isMounted) setDetailLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cui]);

  if (!cui) return null;

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleLiveAnafCheck = async (targetCui: number) => {
    setVerifyingLive(true);
    setLiveCheckResult(null);
    try {
      const res = await fetch(`/api/companies/${targetCui}/verify`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLiveCheckResult({
          success: true,
          message: `Verificare reușită: ${data.data?.fiscalStatus || 'Activ'} (TVA: ${
            data.data?.vatRegistered ? 'Înregistrat' : 'Neînregistrat'
          })`,
        });
        // Reload details
        const refreshed = await fetch(`/api/companies/${targetCui}`).then((r) => r.json());
        if (refreshed.success && refreshed.data) {
          setDetailData(refreshed.data);
        }
        if (onRecordUpdated) onRecordUpdated();
      } else {
        setLiveCheckResult({
          success: false,
          message: data.message || data.error || 'Eroare la apelul ANAF v9',
        });
      }
    } catch (err: any) {
      setLiveCheckResult({
        success: false,
        message: err.message || 'Eroare de rețea la interogarea ANAF',
      });
    } finally {
      setVerifyingLive(false);
    }
  };

  const handleSaveInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cui) return;
    setInteractionSubmitting(true);
    setInteractionSuccess(false);

    try {
      const res = await fetch('/api/crm/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cui,
          interactionType: 'CALL',
          outcome: interactionOutcome,
          notes: interactionNotes,
          contactValue: interactionContactValue,
          contactPerson: interactionContactPerson,
          verifyContact: interactionVerifyContact,
          nextFollowUpDate: interactionFollowUpDate || undefined,
          nextFollowUpTitle: interactionFollowUpTitle || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setInteractionSuccess(true);
        setInteractionNotes('');
        setInteractionFollowUpTitle('');
        setInteractionFollowUpDate('');
        // Reload details
        const refreshed = await fetch(`/api/companies/${cui}`).then((r) => r.json());
        if (refreshed.success && refreshed.data) {
          setDetailData(refreshed.data);
        }
        if (onRecordUpdated) onRecordUpdated();
      } else {
        alert(data.message || data.error || 'Eroare la salvarea interacțiunii');
      }
    } catch (err: any) {
      alert(err.message || 'Eroare de rețea la salvarea interacțiunii');
    } finally {
      setInteractionSubmitting(false);
    }
  };

  const company = detailData?.company;
  const contacts = detailData?.contacts || [];
  const opportunities = detailData?.opportunities || [];
  const interactions = detailData?.interactions || [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-sm flex justify-end">
      <div
        className="w-full max-w-2xl bg-titanium-900 border-l border-titanium-700 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-titanium-800 flex items-start justify-between bg-titanium-950/90">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">
                {company?.name || `CUI ${cui}`}
              </h2>
              {company?.classification === 'NEW' ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-radar-emerald/20 text-radar-green border border-radar-emerald/30">
                  FIRMĂ NOUĂ
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-titanium-800 text-titanium-300 border border-titanium-700">
                  FIRMĂ EXISTENTĂ (ISTORIC)
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-titanium-400 mt-1.5 font-mono">
              <span>
                CUI: <strong className="text-white">{cui}</strong>
              </span>
              <span>•</span>
              <span>{company?.legal_form || 'SRL'}</span>
              <span>•</span>
              <span>
                {company?.county || 'România'}
                {company?.city ? `, ${company.city}` : ''}
              </span>
              {company?.registration_date && (
                <>
                  <span>•</span>
                  <span>Înreg: {company.registration_date}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/companies/${cui}`}
              className="p-1.5 rounded-lg bg-titanium-800 hover:bg-titanium-700 text-titanium-300 hover:text-white text-xs flex items-center gap-1 border border-titanium-700 transition-colors"
              title="Deschide în pagină completă separată"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Pagină completă</span>
            </Link>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-titanium-800 hover:bg-rose-500/20 hover:text-rose-400 text-titanium-400 transition-colors"
              title="Închide"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {detailLoading ? (
            <div className="p-12 text-center text-titanium-400 font-mono">
              Se încarcă datele firmei...
            </div>
          ) : !company ? (
            <div className="p-12 text-center text-rose-400">
              Nu s-au putut încărca detaliile companiei.
            </div>
          ) : (
            <>
              {/* QUICK ACTION BAR */}
              <div className="bg-titanium-950 border border-titanium-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {contacts.find((c: any) => c.contact_type === 'MOBILE' || c.contact_type === 'LANDLINE') ? (
                    (() => {
                      const mainPhone = contacts.find(
                        (c: any) => c.contact_type === 'MOBILE' || c.contact_type === 'LANDLINE'
                      ).contact_value;
                      return (
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${mainPhone}`}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>Sună {mainPhone}</span>
                          </a>
                          <button
                            onClick={() => handleCopy(mainPhone, 'phone')}
                            className="p-1.5 rounded-lg bg-titanium-800 hover:bg-titanium-700 text-titanium-400 hover:text-white text-xs border border-titanium-700"
                            title="Copiază numărul de telefon"
                          >
                            {copiedKey === 'phone' ? (
                              <Check className="w-3.5 h-3.5 text-radar-green" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      );
                    })()
                  ) : (
                    <span className="text-xs text-titanium-500 italic">Fără telefon înregistrat</span>
                  )}

                  {contacts.find((c: any) => c.contact_type === 'EMAIL') &&
                    (() => {
                      const mainEmail = contacts.find((c: any) => c.contact_type === 'EMAIL').contact_value;
                      return (
                        <a
                          href={`mailto:${mainEmail}`}
                          className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Email</span>
                        </a>
                      );
                    })()}
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-[11px] text-titanium-300 font-mono bg-titanium-900 px-2.5 py-1 rounded-lg border border-titanium-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Verificare:</span>
                    <strong className="text-white">
                      {company.last_status_check_at
                        ? new Date(company.last_status_check_at).toLocaleDateString('ro-RO')
                        : 'Evidență stocată'}
                    </strong>
                  </div>

                  <button
                    onClick={() => handleLiveAnafCheck(company.cui)}
                    disabled={verifyingLive}
                    className="px-2.5 py-1 rounded-lg bg-titanium-800 hover:bg-radar-green/20 hover:text-radar-green text-titanium-300 text-[11px] font-semibold border border-titanium-700 transition-colors flex items-center gap-1.5"
                    title="Interoghează în timp real serverul REST ANAF v9"
                  >
                    <RefreshCw className={`w-3 h-3 ${verifyingLive ? 'animate-spin text-radar-green' : ''}`} />
                    <span>{verifyingLive ? 'Interogare live...' : 'Verifică live ANAF'}</span>
                  </button>
                </div>
              </div>

              {liveCheckResult && (
                <div
                  className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
                    liveCheckResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <span>{liveCheckResult.message}</span>
                  <button onClick={() => setLiveCheckResult(null)} className="text-titanium-400 hover:text-white text-xs ml-2">
                    ✕
                  </button>
                </div>
              )}

              {/* SECȚIUNEA A — DATE DE IDENTIFICARE & JURIDICE */}
              <div className="bg-titanium-950/60 border border-titanium-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-titanium-800/80 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-titanium-300 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-radar-green" />
                    Secțiunea A — Date de Identificare &amp; Formă Juridică
                  </h3>
                  <span className="text-[10px] text-titanium-400 font-mono">
                    {company.registration_date ? `Înmatriculare: ${company.registration_date}` : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] text-titanium-500">Stare Legală ONRC</div>
                    <div className="font-bold text-emerald-400 mt-0.5">
                      {company.legal_status || 'ACTIV'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-titanium-500">Stare Fiscală ANAF</div>
                    <div className="font-bold text-cyan-400 mt-0.5">
                      {company.fiscal_status || 'FISCALLY_ACTIVE'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-titanium-500">Număr Reg. Comerțului</div>
                    <div className="font-mono text-titanium-200 mt-0.5">
                      {company.reg_com || 'Nespecificat'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-titanium-500">Sursă Descoperire</div>
                    <div className="text-titanium-200 mt-0.5">
                      {company.discovery_source === 'ONRC_DATA_GOV' ? 'ONRC Open Data (data.gov.ro)' : 'Bază Istorică'}
                    </div>
                  </div>
                  {company.first_detected_at && (
                    <div>
                      <div className="text-[10px] text-titanium-500">Dată Primă Detecție</div>
                      <div className="font-mono text-titanium-300 mt-0.5">
                        {new Date(company.first_detected_at).toLocaleString('ro-RO')}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] text-titanium-500">Sediu Social</div>
                    <div className="text-titanium-200 mt-0.5">
                      {company.city || ''}{company.county ? `, ${company.county}` : ''}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-titanium-800/60">
                  <div className="text-[10px] text-titanium-500">Activitate Principală (CAEN)</div>
                  <div className="text-xs font-semibold text-radar-green mt-0.5 font-mono">
                    CAEN {company.primary_caen}: {company.caen_description}
                  </div>
                </div>
              </div>

              {/* SECȚIUNEA B — CANALE DE CONTACT & PROVENIENȚĂ */}
              <div className="bg-titanium-950/60 border border-titanium-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-titanium-800/80 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-titanium-300 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-400" />
                    Secțiunea B — Canale de Contact &amp; Proveniență
                  </h3>
                  <span className="text-[10px] text-titanium-400 font-mono">
                    {contacts.length} canale
                  </span>
                </div>

                {contacts.length > 0 ? (
                  <div className="space-y-2">
                    {contacts.map((c: any) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-titanium-900 border border-titanium-800 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          {c.contact_type === 'MOBILE' ? (
                            <Smartphone className="w-4 h-4 text-emerald-400" />
                          ) : c.contact_type === 'EMAIL' ? (
                            <Mail className="w-4 h-4 text-purple-400" />
                          ) : c.contact_type === 'WEBSITE' ? (
                            <Globe className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Phone className="w-4 h-4 text-cyan-400" />
                          )}
                          <div>
                            <div className="font-mono font-bold text-white flex items-center gap-2">
                              <span>{c.contact_value}</span>
                              <button
                                onClick={() => handleCopy(c.contact_value, `c-${c.id}`)}
                                className="text-titanium-500 hover:text-white"
                              >
                                {copiedKey === `c-${c.id}` ? (
                                  <Check className="w-3 h-3 text-radar-green" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <div className="text-[10px] text-titanium-400 flex items-center gap-2 mt-0.5">
                              <span>
                                Sursă:{' '}
                                <strong>
                                  {c.source_name === 'ANAF_OPEN_DATA'
                                    ? 'ANAF Open Data'
                                    : c.source_name === 'OFFICIAL_WEBSITE'
                                    ? 'Website Oficial'
                                    : c.source_name || 'Public'}
                                </strong>
                              </span>
                              <span>•</span>
                              {c.verification_status === 'MANUALLY_CONFIRMED' ? (
                                <span className="text-emerald-400 font-semibold">Confirmat manual (Apel CRM)</span>
                              ) : c.verification_status === 'DECLARED_BY_COMPANY' ? (
                                <span className="text-cyan-400 font-medium">Declarat de companie (Nediscutat)</span>
                              ) : c.verification_status === 'OFFICIAL_WEBSITE' ? (
                                <span className="text-purple-400 font-medium">Publicat pe website oficial</span>
                              ) : (
                                <span className="text-titanium-400">{c.verification_status || 'Format valid'}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div>
                          {c.contact_type === 'MOBILE' || c.contact_type === 'LANDLINE' ? (
                            <a
                              href={`tel:${c.contact_value}`}
                              className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[11px] font-semibold border border-emerald-500/30"
                            >
                              Apelează
                            </a>
                          ) : c.contact_type === 'EMAIL' ? (
                            <a
                              href={`mailto:${c.contact_value}`}
                              className="px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[11px] font-semibold border border-purple-500/30"
                            >
                              Trimite
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-titanium-500 italic p-3 text-center">
                    Niciun contact identificat în sursele publice încă.
                  </div>
                )}
              </div>

              {/* SECȚIUNEA C — CALIFICARE COMERCIALĂ & BILANȚ */}
              <div className="bg-titanium-950/60 border border-titanium-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-titanium-800/80 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-titanium-300 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    Secțiunea C — Calificare Comercială &amp; Bilanț
                  </h3>
                  <span className="text-[10px] text-titanium-400 font-mono">
                    {company.latest_financial_year
                      ? `An raportare: ${company.latest_financial_year}`
                      : company.classification === 'NEW'
                      ? 'Firmă Nouă'
                      : 'Fără bilanț depus'}
                  </span>
                </div>

                {company.latest_financial_year || company.turnover ? (
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-titanium-900 border border-titanium-800">
                      <div className="text-[10px] text-titanium-500">Cifră de Afaceri</div>
                      <div className="text-sm font-black font-mono text-white mt-0.5">
                        {company.turnover
                          ? `${(company.turnover / 1000).toLocaleString('ro-RO')} mii RON`
                          : '0'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-titanium-900 border border-titanium-800">
                      <div className="text-[10px] text-titanium-500">Angajați Medii</div>
                      <div className="text-sm font-black font-mono text-cyan-400 mt-0.5">
                        {company.employees_avg ?? '—'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-titanium-900 border border-titanium-800">
                      <div className="text-[10px] text-titanium-500">Profit Net</div>
                      <div className="text-sm font-black font-mono text-emerald-400 mt-0.5">
                        {company.net_profit
                          ? `${(company.net_profit / 1000).toLocaleString('ro-RO')} mii RON`
                          : '—'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-titanium-900/50 border border-titanium-800 text-xs text-titanium-400">
                    {company.classification === 'NEW'
                      ? 'Companie nou-înființată — fără bilanț financiar depus încă la Ministerul Finanțelor.'
                      : 'Inexistent în datele disponibile (firmă fără bilanț public depus la Ministerul Finanțelor).'}
                  </div>
                )}
              </div>

              {/* SECȚIUNEA D — CALIFICARE ASIGURARE (CRISTIAN INTEL) */}
              <div className="bg-titanium-950/60 border border-titanium-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-titanium-800/80 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-titanium-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-radar-green" />
                    Secțiunea D — Calificare Asigurare (Ghid Apel)
                  </h3>
                  <span className="text-[10px] text-radar-green font-mono">
                    CAEN {company.primary_caen}
                  </span>
                </div>

                {/* Relevanță Asigurare */}
                {company.insurance_relevance && (
                  <div className="p-2.5 rounded-lg bg-titanium-900 border border-titanium-800 text-xs text-titanium-200">
                    <div className="text-[10px] font-bold text-titanium-400 uppercase mb-0.5">Nevoi Identificate:</div>
                    {company.insurance_relevance}
                  </div>
                )}

                {/* Întrebări de calificare telefonică */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-titanium-300">
                    Întrebări cheie pentru apelul cu decidentul:
                  </div>
                  <div className="space-y-1.5 text-xs text-titanium-300">
                    <div className="p-2 rounded bg-titanium-900 border border-titanium-800 flex items-start gap-2">
                      <span className="text-radar-green font-bold">1.</span>
                      <span>Dețineți o flotă de vehicule sau echipamente speciale utilizate în activitatea curentă?</span>
                    </div>
                    <div className="p-2 rounded bg-titanium-900 border border-titanium-800 flex items-start gap-2">
                      <span className="text-radar-green font-bold">2.</span>
                      <span>Spațiul de lucru/depozitul este în proprietate sau în chirie, și aveți acoperire pentru bunuri și răspundere civilă față de terți?</span>
                    </div>
                    <div className="p-2 rounded bg-titanium-900 border border-titanium-800 flex items-start gap-2">
                      <span className="text-radar-green font-bold">3.</span>
                      <span>Când aveți scadența polițelor existente pentru a vă pregăti o ofertă comparativă optimizată?</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECȚIUNEA E — ISTORIC CRM */}
              <div className="bg-titanium-950/60 border border-titanium-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-titanium-800/80 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-titanium-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Secțiunea E — Istoric CRM &amp; Notițe
                  </h3>
                  <span className="text-[10px] text-titanium-400 font-mono">
                    {interactions.length} interacțiuni
                  </span>
                </div>

                {interactions.length > 0 ? (
                  <div className="space-y-2">
                    {interactions.map((it: any) => (
                      <div
                        key={it.id}
                        className="p-3 rounded-lg bg-titanium-900 border border-titanium-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs">
                            {it.outcome || it.interaction_type}
                          </span>
                          <span className="text-[10px] text-titanium-500 font-mono">
                            {new Date(it.created_at).toLocaleString('ro-RO')}
                          </span>
                        </div>
                        {it.notes && <p className="text-titanium-300 text-xs mt-1">{it.notes}</p>}
                        <div className="text-[10px] text-titanium-500 flex items-center gap-2 pt-1">
                          <span>Agent: {it.agent_id || 'Cristian'}</span>
                          {it.next_follow_up_date && (
                            <span className="text-amber-400">• Follow-up: {it.next_follow_up_date}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-titanium-500 italic p-3 text-center">
                    Nicio interacțiune înregistrată încă. Înregistrează primul apel mai jos.
                  </div>
                )}
              </div>

              {/* SECȚIUNEA F — ÎNREGISTRARE INTERACȚIUNE & FOLLOW-UP */}
              <form
                onSubmit={handleSaveInteraction}
                className="bg-titanium-950 border border-radar-green/30 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-titanium-800 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-radar-green flex items-center gap-2">
                    <PhoneOutgoing className="w-4 h-4" />
                    Secțiunea F — Înregistrează Apel &amp; Programează Follow-up
                  </h3>
                  {interactionSuccess && (
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Salvat cu succes!
                    </span>
                  )}
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                      Rezultat Apel
                    </label>
                    <select
                      value={interactionOutcome}
                      onChange={(e) => setInteractionOutcome(e.target.value)}
                      className="w-full bg-titanium-900 border border-titanium-700 text-white rounded-lg p-2 focus:border-radar-green focus:outline-none"
                    >
                      <option value="REACHED_DECISION_MAKER">Contactat Decident (Discuție utilă)</option>
                      <option value="INTERESTED">Interesat (Dorește discuție/ofertă)</option>
                      <option value="OFFER_REQUESTED">A solicitat Ofertă</option>
                      <option value="CALLBACK_REQUESTED">A cerut să revenim</option>
                      <option value="NO_ANSWER">Nu a răspuns</option>
                      <option value="NOT_INTERESTED">Nu este interesat</option>
                      <option value="WRONG_NUMBER">Număr greșit / Eronat</option>
                      <option value="DO_NOT_CONTACT">Nu contacta (Adaugă la supresie)</option>
                      <option value="CLIENT_WON">Client Câștigat</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                        Persoană Discutată
                      </label>
                      <input
                        type="text"
                        placeholder="ex: Andrei M. (Administrator)"
                        value={interactionContactPerson}
                        onChange={(e) => setInteractionContactPerson(e.target.value)}
                        className="w-full bg-titanium-900 border border-titanium-700 text-white rounded-lg p-1.5 text-xs focus:border-radar-green focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                        Canal Utilizat
                      </label>
                      <input
                        type="text"
                        placeholder="ex: +40744270546"
                        value={interactionContactValue}
                        onChange={(e) => setInteractionContactValue(e.target.value)}
                        className="w-full bg-titanium-900 border border-titanium-700 text-white rounded-lg p-1.5 text-xs focus:border-radar-green focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      type="checkbox"
                      id="verifyContactCheck"
                      checked={interactionVerifyContact}
                      onChange={(e) => setInteractionVerifyContact(e.target.checked)}
                      className="rounded border-titanium-700 text-radar-green focus:ring-0 focus:outline-none bg-titanium-900"
                    />
                    <label htmlFor="verifyContactCheck" className="text-[11px] text-titanium-300 cursor-pointer">
                      Confirmă acest număr ca <strong>validat manual</strong> prin apelul efectuat
                    </label>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                      Notițe Apel
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Notează detalii despre discuție, parcul auto, nevoile de asigurare..."
                      value={interactionNotes}
                      onChange={(e) => setInteractionNotes(e.target.value)}
                      className="w-full bg-titanium-900 border border-titanium-700 text-white rounded-lg p-2 text-xs focus:border-radar-green focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                        Dată Următor Follow-up
                      </label>
                      <input
                        type="date"
                        value={interactionFollowUpDate}
                        onChange={(e) => setInteractionFollowUpDate(e.target.value)}
                        className="w-full bg-titanium-900 border border-titanium-700 text-white rounded-lg p-1.5 text-xs focus:border-radar-green focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-titanium-400 uppercase block mb-1">
                        Acțiune Planificată
                      </label>
                      <input
                        type="text"
                        placeholder="ex: Trimitere cotație CASCO"
                        value={interactionFollowUpTitle}
                        onChange={(e) => setInteractionFollowUpTitle(e.target.value)}
                        className="w-full bg-titanium-900 border border-titanium-700 text-white rounded-lg p-1.5 text-xs focus:border-radar-green focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={interactionSubmitting}
                    className="w-full py-2.5 rounded-lg bg-radar-green hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{interactionSubmitting ? 'Se salvează...' : 'Salvează Interacțiunea & Actualizează CRM'}</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
