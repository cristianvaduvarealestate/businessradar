'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Send,
  Plus,
  MessageSquare,
  FileText,
  User,
  ExternalLink,
  ChevronRight,
  Save,
  Check,
  Copy,
  Briefcase,
  Layers,
  PhoneCall,
  Clock3,
} from 'lucide-react';
import {
  COMMERCIAL_STATUSES,
  CommercialStatusKey,
  INSURANCE_PRODUCT_OPTIONS,
  ProspectRecord,
  ProspectDiscussion,
} from '@/lib/prospecting-types';

interface ProspectDossierDrawerProps {
  prospectId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRecordUpdated?: () => void;
}

function formatSafeDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString('ro-RO');
  } catch {
    return '—';
  }
}

export default function ProspectDossierDrawer({
  prospectId,
  isOpen,
  onClose,
  onRecordUpdated,
}: ProspectDossierDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [prospect, setProspect] = useState<(ProspectRecord & { discussions: ProspectDiscussion[] }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states for adding a discussion
  const [isAddingDiscussion, setIsAddingDiscussion] = useState(false);
  const [discType, setDiscType] = useState<'CALL' | 'EMAIL' | 'MEETING' | 'OFFER_SENT' | 'SCHEDULED_CALLBACK'>('CALL');
  const [discContact, setDiscContact] = useState('');
  const [discSummary, setDiscSummary] = useState('');
  const [discProducts, setDiscProducts] = useState('');
  const [discDocuments, setDiscDocuments] = useState('');
  const [discOffer, setDiscOffer] = useState('');
  const [discOutcome, setDiscOutcome] = useState('');
  const [discNextStep, setDiscNextStep] = useState('');
  const [discNextCallback, setDiscNextCallback] = useState('');
  const [discStatusUpdate, setDiscStatusUpdate] = useState<CommercialStatusKey | ''>('');
  const [submittingDiscussion, setSubmittingDiscussion] = useState(false);

  // Field edit states
  const [operationalNotes, setOperationalNotes] = useState('');
  const [decisionMaker, setDecisionMaker] = useState('');
  const [nextCallbackDate, setNextCallbackDate] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [savingFields, setSavingFields] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const fetchProspect = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prospecting/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setProspect(json.data);
        setOperationalNotes(json.data.operational_notes || '');
        setDecisionMaker(json.data.decision_maker || json.data.contact_persons || '');
        setNextCallbackDate(json.data.next_callback_date || '');
        setNextAction(json.data.next_action || '');
        setSelectedProducts(json.data.confirmed_interested_products || []);
      } else {
        setError(json.error || 'Eroare la încărcarea dosarului.');
      }
    } catch (err: any) {
      setError(err.message || 'Eroare de conexiune.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prospectId && isOpen) {
      fetchProspect(prospectId);
    } else {
      setProspect(null);
      setIsAddingDiscussion(false);
    }
  }, [prospectId, isOpen]);

  // Handle Escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStatusChange = async (newStatus: CommercialStatusKey) => {
    if (!prospect) return;
    try {
      const res = await fetch(`/api/prospecting/${prospect.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commercial_status: newStatus }),
      });
      if (res.ok) {
        setProspect({ ...prospect, commercial_status: newStatus });
        if (onRecordUpdated) onRecordUpdated();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleProductToggle = (product: string) => {
    const updated = selectedProducts.includes(product)
      ? selectedProducts.filter((p) => p !== product)
      : [...selectedProducts, product];
    setSelectedProducts(updated);
  };

  const handleSaveFields = async () => {
    if (!prospect) return;
    setSavingFields(true);
    try {
      const res = await fetch(`/api/prospecting/${prospect.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operational_notes: operationalNotes,
          decision_maker: decisionMaker,
          next_callback_date: nextCallbackDate || null,
          next_action: nextAction || null,
          confirmed_interested_products: selectedProducts,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        if (onRecordUpdated) onRecordUpdated();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingFields(false);
    }
  };

  const handleAddDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prospect || !discSummary.trim()) return;

    setSubmittingDiscussion(true);
    try {
      const res = await fetch(`/api/prospecting/${prospect.id}/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interaction_type: discType,
          contact_person: discContact,
          discussion_summary: discSummary,
          interested_products: discProducts,
          requested_documents: discDocuments,
          offer_to_prepare: discOffer,
          outcome: discOutcome,
          next_step: discNextStep,
          next_callback_date: discNextCallback || null,
          update_status: discStatusUpdate || undefined,
        }),
      });

      if (res.ok) {
        // Reset form
        setDiscSummary('');
        setDiscContact('');
        setDiscProducts('');
        setDiscDocuments('');
        setDiscOffer('');
        setDiscOutcome('');
        setDiscNextStep('');
        setDiscNextCallback('');
        setDiscStatusUpdate('');
        setIsAddingDiscussion(false);

        // Refresh dossier
        await fetchProspect(prospect.id);
        if (onRecordUpdated) onRecordUpdated();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingDiscussion(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const currentStatusDef = prospect ? COMMERCIAL_STATUSES[prospect.commercial_status] : null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-sm flex justify-end"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-w-full sm:max-w-2xl bg-titanium-900 border-l border-titanium-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-titanium-800 bg-titanium-950 flex items-start justify-between shrink-0">
          <div className="flex-1 pr-3 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-titanium-800 text-titanium-300 border border-titanium-700">
                {prospect?.portfolio_type === 'GENERAL' ? 'Prospectare Generală' : 'HORECA / Auto / Construct'}
              </span>
              {prospect?.is_incomplete === 1 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  Date Incomplete
                </span>
              )}
              {prospect?.matched_cui && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                  <ShieldCheck className="w-3 h-3 text-radar-green" />
                  CUI {prospect.matched_cui} verificat
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-titanium-100 leading-tight truncate">
              {prospect?.company_name || 'Se încarcă dosarul...'}
            </h2>
            <div className="text-xs text-titanium-400 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>{prospect?.domain || 'Domeniu nespecificat'}</span>
              {(prospect?.city || prospect?.county) && (
                <>
                  <span>•</span>
                  <span>{[prospect.city, prospect.county].filter(Boolean).join(', ')}</span>
                </>
              )}
              {prospect?.cui && (
                <>
                  <span>•</span>
                  <span className="font-mono text-titanium-300">CUI: {prospect.cui}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-1 rounded-lg text-titanium-400 hover:text-white hover:bg-titanium-800 transition min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
            aria-label="Închide dosarul"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {loading && !prospect ? (
          <div className="flex-1 flex items-center justify-center p-8 text-titanium-400 text-sm">
            <Clock className="w-5 h-5 animate-spin mr-2 text-radar-green" />
            Se încarcă dosarul comercial...
          </div>
        ) : error ? (
          <div className="p-6 text-rose-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        ) : prospect ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 sm:space-y-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {/* 1. Commercial Status Selector */}
            <div className="p-4 rounded-xl bg-titanium-850 border border-titanium-800">
              <div className="text-xs font-semibold text-titanium-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Statut Comercial Curent</span>
                <span className={`text-[11px] px-2 py-0.5 rounded border ${currentStatusDef?.badgeClass}`}>
                  {currentStatusDef?.label}
                </span>
              </div>
              <div className="relative">
                <select
                  value={prospect.commercial_status}
                  onChange={(e) => handleStatusChange(e.target.value as CommercialStatusKey)}
                  className="w-full bg-titanium-900 border border-titanium-700 text-titanium-100 rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-radar-green focus:border-radar-green"
                >
                  <optgroup label="Etapa 1: Calificare & Date">
                    <option value="NEW_UNVERIFIED">1. Nou — neverificat</option>
                    <option value="VERIFY_CONTACT">2. De verificat date de contact</option>
                    <option value="UNVERIFIABLE">3. Neverificabil — date insuficiente</option>
                    <option value="WRONG_NUMBER">4. Număr greșit / inexistent</option>
                  </optgroup>
                  <optgroup label="Etapa 2: Contactare activă">
                    <option value="TO_CONTACT">5. De contactat</option>
                    <option value="CALL_NO_ANSWER">6. Apelat — nu răspunde</option>
                    <option value="CALL_BUSY">7. Apelat — ocupat / revenire rapidă</option>
                    <option value="GATEKEEPER">8. Secretariat — cerut contact decident</option>
                    <option value="CALLBACK_SCHEDULED">9. Revenire programată</option>
                    <option value="DISCUSSION_IN_PROGRESS">10. Discuție în curs</option>
                  </optgroup>
                  <optgroup label="Etapa 3: Ofertare & Negociere">
                    <option value="INTERESTED_OFFER_REQUESTED">11. Interesat — solicită ofertă</option>
                    <option value="OFFER_SENT_UNDER_REVIEW">12. Ofertă trimisă — în analiză</option>
                    <option value="NEGOTIATION_TECHNICAL">13. Negociere / clarificări tehnice</option>
                  </optgroup>
                  <optgroup label="Etapa 4: Finalizare & Retenție">
                    <option value="CLOSED_WON_POLICY_ISSUED">14. Închis câștigat — poliță emisă</option>
                    <option value="CLOSED_LOST_DEFINITIVE_REFUSAL">15. Închis pierdut — refuz definitiv</option>
                    <option value="CLOSED_LOST_ALREADY_INSURED">16. Închis pierdut — are deja asigurare / broker</option>
                    <option value="REEVALUATION_6_MONTHS">17. Reevaluare peste 6 luni / la expirare</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {/* 2. Contact Details & Identification */}
            <div className="p-4 rounded-xl bg-titanium-850 border border-titanium-800 space-y-3">
              <div className="text-xs font-semibold text-titanium-300 uppercase tracking-wider">
                Date de Contact & Localizare
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Telefoane */}
                <div className="space-y-1">
                  <span className="text-[11px] text-titanium-400 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-radar-green" /> Telefoane:
                  </span>
                  {prospect.phones && prospect.phones.length > 0 ? (
                    <div className="space-y-1">
                      {prospect.phones.map((phone, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-titanium-900 px-2 py-1.5 rounded border border-titanium-800">
                          <a
                            href={`tel:${phone.replace(/\s+/g, '')}`}
                            className="font-mono text-radar-green hover:underline"
                          >
                            {phone}
                          </a>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(phone, `phone_${idx}`)}
                            className="text-titanium-400 hover:text-white"
                          >
                            {copiedText === `phone_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-titanium-500 italic block">Fără număr de telefon</span>
                  )}
                </div>

                {/* Emailuri */}
                <div className="space-y-1">
                  <span className="text-[11px] text-titanium-400 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-radar-green" /> Emailuri:
                  </span>
                  {prospect.emails && prospect.emails.length > 0 ? (
                    <div className="space-y-1">
                      {prospect.emails.map((email, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-titanium-900 px-2 py-1.5 rounded border border-titanium-800">
                          <a
                            href={`mailto:${email}`}
                            className="font-mono text-titanium-200 hover:text-radar-green hover:underline truncate max-w-[180px]"
                            title={email}
                          >
                            {email}
                          </a>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(email, `email_${idx}`)}
                            className="text-titanium-400 hover:text-white"
                          >
                            {copiedText === `email_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-titanium-500 italic block">Fără adresă de email</span>
                  )}
                </div>
              </div>

              {/* Website & Adresă */}
              <div className="pt-2 border-t border-titanium-800 space-y-2 text-xs">
                {prospect.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-titanium-400" />
                    <span className="text-titanium-400">Website / Observații:</span>
                    <a
                      href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-radar-green hover:underline flex items-center gap-1 truncate max-w-sm"
                    >
                      {prospect.website}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {prospect.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-titanium-400 shrink-0 mt-0.5" />
                    <span className="text-titanium-300">{prospect.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Insurance Products & Needs Checklist */}
            <div className="p-4 rounded-xl bg-titanium-850 border border-titanium-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-titanium-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-radar-green" />
                  Produse de Asigurare de Interes
                </div>
                {prospect.insurance_suggestions && (
                  <span className="text-[10px] text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
                    Sugestie inițială disponibilă
                  </span>
                )}
              </div>

              {prospect.insurance_suggestions && (
                <div className="p-2.5 rounded-lg bg-titanium-900 border border-titanium-750 text-xs text-titanium-300">
                  <span className="text-titanium-400 font-medium">Sugestie din sursă: </span>
                  {prospect.insurance_suggestions}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {INSURANCE_PRODUCT_OPTIONS.map((prod) => {
                  const isChecked = selectedProducts.includes(prod);
                  return (
                    <label
                      key={prod}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                        isChecked
                          ? 'bg-radar-emerald/10 border-radar-green text-titanium-100 font-medium'
                          : 'bg-titanium-900 border-titanium-800 text-titanium-400 hover:border-titanium-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleProductToggle(prod)}
                        className="rounded border-titanium-700 bg-titanium-950 text-radar-green focus:ring-0"
                      />
                      <span>{prod}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 4. Decision Maker, Operational Notes & Next Action */}
            <div className="p-4 rounded-xl bg-titanium-850 border border-titanium-800 space-y-3">
              <div className="text-xs font-semibold text-titanium-300 uppercase tracking-wider">
                Operativitate CRM & Următorul Pas
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-titanium-400 mb-1">Persoană Decizie / Contact:</label>
                  <input
                    type="text"
                    value={decisionMaker}
                    onChange={(e) => setDecisionMaker(e.target.value)}
                    placeholder="ex: Ion Popescu (Director General)"
                    className="w-full bg-titanium-900 border border-titanium-700 rounded-lg px-3 py-1.5 text-xs text-titanium-100 focus:ring-1 focus:ring-radar-green"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-titanium-400 mb-1">Dată & Oră Revenire:</label>
                  <input
                    type="datetime-local"
                    value={nextCallbackDate}
                    onChange={(e) => setNextCallbackDate(e.target.value)}
                    className="w-full bg-titanium-900 border border-titanium-700 rounded-lg px-3 py-1.5 text-xs text-titanium-100 focus:ring-1 focus:ring-radar-green"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-titanium-400 mb-1">Următorul Pas Agreat:</label>
                <input
                  type="text"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="ex: Trimite cotație CASCO flotă până miercuri"
                  className="w-full bg-titanium-900 border border-titanium-700 rounded-lg px-3 py-1.5 text-xs text-titanium-100 focus:ring-1 focus:ring-radar-green"
                />
              </div>

              <div>
                <label className="block text-[11px] text-titanium-400 mb-1">Notițe Operative:</label>
                <textarea
                  value={operationalNotes}
                  onChange={(e) => setOperationalNotes(e.target.value)}
                  rows={2}
                  placeholder="Observații comerciale interne..."
                  className="w-full bg-titanium-900 border border-titanium-700 rounded-lg p-2.5 text-xs text-titanium-100 focus:ring-1 focus:ring-radar-green"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleSaveFields}
                  disabled={savingFields}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] bg-titanium-800 hover:bg-titanium-750 border border-titanium-700 text-titanium-100 rounded-lg text-xs font-semibold transition"
                >
                  {savingFields ? (
                    <>
                      <Clock className="w-3.5 h-3.5 animate-spin" /> Se salvează...
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Salvat!
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 text-radar-green" /> Salvează modificările
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 5. Chronological Discussions History */}
            <div className="p-4 rounded-xl bg-titanium-850 border border-titanium-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-titanium-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-radar-green" />
                    Istoric Discuții & Apeluri ({prospect.discussions?.length || 0})
                  </div>
                  <div className="text-[11px] text-titanium-500">
                    Jurnal cronologic permanent, fără suprascriere
                  </div>
                </div>
                {!isAddingDiscussion && (
                  <button
                    type="button"
                    onClick={() => setIsAddingDiscussion(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-radar-emerald/20 hover:bg-radar-emerald/30 border border-radar-emerald/40 text-radar-green rounded-lg text-xs font-medium transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adaugă discuție
                  </button>
                )}
              </div>

              {/* Add Discussion Form */}
              {isAddingDiscussion && (
                <form
                  onSubmit={handleAddDiscussion}
                  className="p-4 rounded-lg bg-titanium-900 border border-radar-emerald/30 space-y-3 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between border-b border-titanium-800 pb-2">
                    <span className="text-xs font-bold text-titanium-100 flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5 text-radar-green" />
                      Înregistrează o nouă interacțiune
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingDiscussion(false)}
                      className="text-titanium-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] text-titanium-400 mb-1">Tip Interacțiune:</label>
                      <select
                        value={discType}
                        onChange={(e) => setDiscType(e.target.value as any)}
                        className="w-full bg-titanium-950 border border-titanium-700 rounded-lg p-2 text-xs text-titanium-100"
                      >
                        <option value="CALL">Apel telefonic</option>
                        <option value="EMAIL">Email</option>
                        <option value="MEETING">Întâlnire</option>
                        <option value="OFFER_SENT">Ofertă trimisă</option>
                        <option value="SCHEDULED_CALLBACK">Revenire programată</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-titanium-400 mb-1">Persoana cu care s-a discutat:</label>
                      <input
                        type="text"
                        value={discContact}
                        onChange={(e) => setDiscContact(e.target.value)}
                        placeholder="Nume, funcție"
                        className="w-full bg-titanium-950 border border-titanium-700 rounded-lg p-2 text-xs text-titanium-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-titanium-400 mb-1">Rezumatul discuției * :</label>
                    <textarea
                      required
                      value={discSummary}
                      onChange={(e) => setDiscSummary(e.target.value)}
                      rows={3}
                      placeholder="Ce s-a discutat, obiecții, detalii relevante..."
                      className="w-full bg-titanium-950 border border-titanium-700 rounded-lg p-2 text-xs text-titanium-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] text-titanium-400 mb-1">Produse de asigurare discutate:</label>
                      <input
                        type="text"
                        value={discProducts}
                        onChange={(e) => setDiscProducts(e.target.value)}
                        placeholder="ex: CASCO flotă, Malpraxis"
                        className="w-full bg-titanium-950 border border-titanium-700 rounded-lg p-2 text-xs text-titanium-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-titanium-400 mb-1">Oferte de pregătit / Documente:</label>
                      <input
                        type="text"
                        value={discOffer}
                        onChange={(e) => setDiscOffer(e.target.value)}
                        placeholder="ex: Talon camioane, cotație 3 variante"
                        className="w-full bg-titanium-950 border border-titanium-700 rounded-lg p-2 text-xs text-titanium-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                    <div>
                      <label className="block text-[11px] text-titanium-400 mb-1">Următorul pas agreat:</label>
                      <input
                        type="text"
                        value={discNextStep}
                        onChange={(e) => setDiscNextStep(e.target.value)}
                        placeholder="ex: Revenire telefon"
                        className="w-full bg-titanium-950 border border-titanium-700 rounded-lg p-2 text-xs text-titanium-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-titanium-400 mb-1">Programare revenire:</label>
                      <input
                        type="datetime-local"
                        value={discNextCallback}
                        onChange={(e) => setDiscNextCallback(e.target.value)}
                        className="w-full bg-titanium-950 border border-titanium-700 rounded-lg p-2 text-xs text-titanium-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-titanium-400 mb-1">Actualizează statutul:</label>
                      <select
                        value={discStatusUpdate}
                        onChange={(e) => setDiscStatusUpdate(e.target.value as any)}
                        className="w-full bg-titanium-950 border border-titanium-700 rounded-lg p-2 text-xs text-titanium-100"
                      >
                        <option value="">-- Păstrează neschimbat --</option>
                        {Object.values(COMMERCIAL_STATUSES).map((st) => (
                          <option key={st.key} value={st.key}>
                            {st.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-titanium-800">
                    <button
                      type="button"
                      onClick={() => setIsAddingDiscussion(false)}
                      className="w-full sm:w-auto px-4 py-2 min-h-[40px] text-xs text-titanium-400 hover:text-white rounded-lg hover:bg-titanium-800 transition"
                    >
                      Anulează
                    </button>
                    <button
                      type="submit"
                      disabled={submittingDiscussion}
                      className="w-full sm:w-auto px-4 py-2 min-h-[40px] bg-radar-green text-titanium-950 rounded-lg text-xs font-semibold hover:bg-radar-emerald transition flex items-center justify-center gap-1.5"
                    >
                      {submittingDiscussion ? (
                        <>
                          <Clock className="w-3.5 h-3.5 animate-spin" /> Se salvează...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" /> Salvează discuția în istoric
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Discussions List */}
              <div className="space-y-3">
                {prospect.discussions && prospect.discussions.length > 0 ? (
                  prospect.discussions.map((disc) => (
                    <div
                      key={disc.id}
                      className="p-3.5 rounded-lg bg-titanium-900 border border-titanium-800 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-titanium-800 text-titanium-300 border border-titanium-700">
                            {disc.interaction_type === 'CALL'
                              ? 'Apel telefonic'
                              : disc.interaction_type === 'EMAIL'
                              ? 'Email'
                              : disc.interaction_type === 'MEETING'
                              ? 'Întâlnire'
                              : disc.interaction_type === 'OFFER_SENT'
                              ? 'Ofertă trimisă'
                              : 'Revenire programată'}
                          </span>
                          {disc.contact_person && (
                            <span className="text-titanium-300 font-medium flex items-center gap-1">
                              <User className="w-3 h-3 text-titanium-500" />
                              {disc.contact_person}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-titanium-500 font-mono">
                          {formatSafeDateTime(disc.interaction_date)}
                        </span>
                      </div>

                      <div className="text-titanium-200 whitespace-pre-wrap leading-relaxed">
                        {disc.discussion_summary}
                      </div>

                      {(disc.interested_products || disc.offer_to_prepare || disc.next_step || disc.next_callback_date) && (
                        <div className="pt-2 border-t border-titanium-800/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-titanium-400">
                          {disc.interested_products && (
                            <div>
                              <span className="text-titanium-500">Produse discutate: </span>
                              <span className="text-titanium-300">{disc.interested_products}</span>
                            </div>
                          )}
                          {disc.offer_to_prepare && (
                            <div>
                              <span className="text-titanium-500">Ofertă de pregătit: </span>
                              <span className="text-titanium-300">{disc.offer_to_prepare}</span>
                            </div>
                          )}
                          {disc.next_step && (
                            <div>
                              <span className="text-titanium-500">Următorul pas: </span>
                              <span className="text-radar-green">{disc.next_step}</span>
                            </div>
                          )}
                          {disc.next_callback_date && (
                            <div className="flex items-center gap-1">
                              <Clock3 className="w-3 h-3 text-amber-400" />
                              <span className="text-titanium-500">Revenire: </span>
                              <span className="text-amber-300">
                                {formatSafeDateTime(disc.next_callback_date)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-titanium-500 text-xs border border-dashed border-titanium-800 rounded-lg">
                    Nu există încă interacțiuni înregistrate pentru acest dosar.
                    <div className="mt-1 text-[11px] text-titanium-600">
                      Folosește butonul „Adaugă discuție” de mai sus pentru a nota apelurile și concluziile.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 6. Raw Fragment & Provenance */}
            {prospect.raw_content && (
              <div className="p-4 rounded-xl bg-titanium-950 border border-titanium-850 space-y-1.5 text-xs">
                <div className="text-[10px] font-mono text-titanium-500 uppercase tracking-wider">
                  Sursă Originală: {prospect.source_file} (Rândul {prospect.source_row_index})
                </div>
                <pre className="text-[11px] text-titanium-400 font-mono whitespace-pre-wrap bg-titanium-900 p-2.5 rounded border border-titanium-800 max-h-32 overflow-y-auto">
                  {prospect.raw_content}
                </pre>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
