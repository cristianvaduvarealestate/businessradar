export type ContactType = 'MOBILE' | 'LANDLINE' | 'PHONE' | 'EMAIL' | 'WEBSITE' | 'CONTACT_FORM';

export type VerificationStatus =
  | 'OFFICIAL_REGISTER'
  | 'DECLARED_BY_COMPANY'
  | 'OFFICIAL_WEBSITE'
  | 'PUBLIC_BUSINESS_DIRECTORY'
  | 'MANUALLY_CONFIRMED'
  | 'FORMAT_VALID_ONLY'
  | 'UNVERIFIED';

export interface DiscoveredContactItem {
  cui: number;
  contactType: ContactType;
  originalValue: string;
  normalizedValue: string;
  label?: string; // 'OFFICE' | 'SALES' | 'MANAGEMENT' | 'SUPPORT' | 'GENERAL'
  sourceName: string; // 'ANAF_OPEN_DATA' | 'OFFICIAL_WEBSITE' | 'DIRECT_BROKER_ENTRY' | etc.
  provenanceUrl?: string;
  verificationMethod: string;
  verificationStatus: VerificationStatus;
  confidenceScore: number; // 0.0 - 1.0
  contactPerson?: string;
  contactPersonPosition?: string;
  notes?: string;
}

export interface EnrichmentResult {
  cui: number;
  companyName: string;
  success: boolean;
  contactsDiscovered: DiscoveredContactItem[];
  websiteDiscovered?: string;
  taxStatus?: {
    vatRegistered: boolean;
    active: boolean;
    eFacturaReady: boolean;
    fiscalAddress?: string;
    registrationState?: string;
    caenCode?: string;
  };
  errors: string[];
  sourcesChecked: string[];
}

export interface EnrichmentProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  contactsFound: {
    mobile: number;
    landline: number;
    email: number;
    website: number;
  };
  currentCui?: number;
  currentCompanyName?: string;
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR';
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}
