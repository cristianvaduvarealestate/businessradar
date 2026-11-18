export type PortfolioType = 'GENERAL' | 'NICHE_HORECA_AUTO_CONSTRUCT' | 'TOURISM_UNITS';

export type CommercialStatusKey =
  | 'NEW_UNVERIFIED'
  | 'VERIFY_CONTACT'
  | 'UNVERIFIABLE'
  | 'WRONG_NUMBER'
  | 'TO_CONTACT'
  | 'CALL_NO_ANSWER'
  | 'CALL_BUSY'
  | 'GATEKEEPER'
  | 'CALLBACK_SCHEDULED'
  | 'DISCUSSION_IN_PROGRESS'
  | 'INTERESTED_OFFER_REQUESTED'
  | 'OFFER_SENT_UNDER_REVIEW'
  | 'NEGOTIATION_TECHNICAL'
  | 'CLOSED_WON_POLICY_ISSUED'
  | 'CLOSED_LOST_DEFINITIVE_REFUSAL'
  | 'CLOSED_LOST_ALREADY_INSURED'
  | 'REEVALUATION_6_MONTHS';

export interface CommercialStatusDefinition {
  key: CommercialStatusKey;
  label: string;
  category: 'initial' | 'in_progress' | 'advanced' | 'closed';
  badgeClass: string;
}

export const COMMERCIAL_STATUSES: Record<CommercialStatusKey, CommercialStatusDefinition> = {
  NEW_UNVERIFIED: {
    key: 'NEW_UNVERIFIED',
    label: 'Nou — neverificat',
    category: 'initial',
    badgeClass: 'bg-titanium-800 text-titanium-300 border-titanium-700',
  },
  VERIFY_CONTACT: {
    key: 'VERIFY_CONTACT',
    label: 'De verificat date de contact',
    category: 'initial',
    badgeClass: 'bg-amber-950/40 text-amber-300 border-amber-800/40',
  },
  UNVERIFIABLE: {
    key: 'UNVERIFIABLE',
    label: 'Neverificabil — date insuficiente',
    category: 'initial',
    badgeClass: 'bg-red-950/30 text-red-400 border-red-900/40',
  },
  WRONG_NUMBER: {
    key: 'WRONG_NUMBER',
    label: 'Număr greșit / inexistent',
    category: 'initial',
    badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  },
  TO_CONTACT: {
    key: 'TO_CONTACT',
    label: 'De contactat',
    category: 'in_progress',
    badgeClass: 'bg-blue-950/40 text-blue-300 border-blue-800/40',
  },
  CALL_NO_ANSWER: {
    key: 'CALL_NO_ANSWER',
    label: 'Apelat — nu răspunde',
    category: 'in_progress',
    badgeClass: 'bg-orange-950/40 text-orange-300 border-orange-800/40',
  },
  CALL_BUSY: {
    key: 'CALL_BUSY',
    label: 'Apelat — ocupat / revenire rapidă',
    category: 'in_progress',
    badgeClass: 'bg-amber-950/40 text-amber-300 border-amber-800/40',
  },
  GATEKEEPER: {
    key: 'GATEKEEPER',
    label: 'Secretariat — cerut contact decident',
    category: 'in_progress',
    badgeClass: 'bg-purple-950/40 text-purple-300 border-purple-800/40',
  },
  CALLBACK_SCHEDULED: {
    key: 'CALLBACK_SCHEDULED',
    label: 'Revenire programată',
    category: 'in_progress',
    badgeClass: 'bg-sky-950/40 text-sky-300 border-sky-800/40',
  },
  DISCUSSION_IN_PROGRESS: {
    key: 'DISCUSSION_IN_PROGRESS',
    label: 'Discuție în curs',
    category: 'in_progress',
    badgeClass: 'bg-cyan-950/40 text-cyan-300 border-cyan-800/40',
  },
  INTERESTED_OFFER_REQUESTED: {
    key: 'INTERESTED_OFFER_REQUESTED',
    label: 'Interesat — solicită ofertă',
    category: 'advanced',
    badgeClass: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40',
  },
  OFFER_SENT_UNDER_REVIEW: {
    key: 'OFFER_SENT_UNDER_REVIEW',
    label: 'Ofertă trimisă — în analiză',
    category: 'advanced',
    badgeClass: 'bg-teal-950/40 text-teal-300 border-teal-800/40',
  },
  NEGOTIATION_TECHNICAL: {
    key: 'NEGOTIATION_TECHNICAL',
    label: 'Negociere / clarificări tehnice',
    category: 'advanced',
    badgeClass: 'bg-indigo-950/40 text-indigo-300 border-indigo-800/40',
  },
  CLOSED_WON_POLICY_ISSUED: {
    key: 'CLOSED_WON_POLICY_ISSUED',
    label: 'Închis câștigat — poliță emisă',
    category: 'closed',
    badgeClass: 'bg-emerald-600 text-white border-emerald-500 font-semibold',
  },
  CLOSED_LOST_DEFINITIVE_REFUSAL: {
    key: 'CLOSED_LOST_DEFINITIVE_REFUSAL',
    label: 'Închis pierdut — refuz definitiv',
    category: 'closed',
    badgeClass: 'bg-rose-950/50 text-rose-300 border-rose-800/50',
  },
  CLOSED_LOST_ALREADY_INSURED: {
    key: 'CLOSED_LOST_ALREADY_INSURED',
    label: 'Închis pierdut — are deja asigurare / broker',
    category: 'closed',
    badgeClass: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  },
  REEVALUATION_6_MONTHS: {
    key: 'REEVALUATION_6_MONTHS',
    label: 'Reevaluare peste 6 luni / la expirare',
    category: 'closed',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
  },
};

export const INSURANCE_PRODUCT_OPTIONS = [
  'Clădiri și bunuri',
  'Răspundere civilă profesională / generală',
  'Flotă auto / CASCO / RCA',
  'Asigurări de sănătate de grup',
  'Asigurări de viață / accidente pentru angajați',
  'CAR / EAR (Construcții)',
  'CMR / Cargo (Transport)',
  'Asigurare Cyber',
  'Răspundere managerială (D&O)',
  'Altele',
];

export interface ProspectRecord {
  id: string;
  portfolio_type: PortfolioType;
  source_file: string;
  source_row_index: number;
  raw_content?: string;
  company_name: string;
  cui?: string | null;
  reg_com?: string | null;
  domain?: string | null;
  county?: string | null;
  city?: string | null;
  address?: string | null;
  phones: string[]; // parsed JSON
  emails: string[]; // parsed JSON
  website?: string | null;
  contact_persons?: string | null;
  initial_notes?: string | null;
  verification_note?: string | null;
  insurance_suggestions?: string | null;
  confirmed_interested_products: string[]; // parsed JSON
  commercial_status: CommercialStatusKey;
  decision_maker?: string | null;
  operational_notes?: string | null;
  is_incomplete: number;
  matched_cui?: string | null;
  matched_company_name?: string | null;
  is_potential_duplicate: number;
  next_callback_date?: string | null;
  next_action?: string | null;
  // Specialized fields for tourism units portfolio
  unit_type?: string | null;
  unit_name?: string | null;
  unit_classification?: string | null;
  rooms_count?: string | null;
  beds_count?: string | null;
  locality_type?: string | null;
  locality_subdivision?: string | null;
  operator_type?: string | null;
  operator_name?: string | null;
  authorization_number?: string | null;
  authorization_date?: string | null;
  created_at: string;
  updated_at: string;
  discussions_count?: number;
  last_discussion_date?: string | null;
}

export interface ProspectDiscussion {
  id: string;
  prospect_id: string;
  interaction_date: string;
  interaction_type: 'CALL' | 'EMAIL' | 'MEETING' | 'OFFER_SENT' | 'SCHEDULED_CALLBACK';
  contact_person?: string | null;
  discussion_summary: string;
  interested_products?: string | null;
  requested_documents?: string | null;
  offer_to_prepare?: string | null;
  outcome?: string | null;
  next_step?: string | null;
  next_callback_date?: string | null;
  created_at: string;
}
