export interface SourceMetadata {
  id: string;
  name: string;
  type: 'OFFICIAL_REGISTRY' | 'TAX_AUTHORITY' | 'FINANCIAL_MINISTRY' | 'PUBLIC_PORTAL' | 'COMMERCIAL_API';
  status: 'CONNECTED_AND_TESTED' | 'CONNECTED_BUT_LIMITED' | 'AVAILABLE_BUT_REQUIRES_API_KEY' | 'PUBLIC_DATASET_AVAILABLE' | 'UNAVAILABLE';
  updateFrequency: 'REALTIME' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'PERIODIC';
  requiresAuth: boolean;
  isPaid: boolean;
  rateLimitInfo: string;
  attribution: string;
}

export interface ProviderCapability {
  supportsBulkDownload: boolean;
  supportsRealtimeLookup: boolean;
  supportsBatchLookup: boolean;
  supportsFinancials: boolean;
  supportsTaxVerification: boolean;
  supportsContacts: boolean;
}

export interface CompanyDataProvider {
  readonly metadata: SourceMetadata;
  readonly capabilities: ProviderCapability;

  testConnection(): Promise<{ success: boolean; latencyMs: number; message: string }>;
}

export const REGISTERED_PROVIDERS: Record<string, SourceMetadata> = {
  ONRC_DATA_GOV: {
    id: 'ONRC_DATA_GOV',
    name: 'ONRC — Oficiul Național al Registrului Comerțului (Open Data)',
    type: 'OFFICIAL_REGISTRY',
    status: 'PUBLIC_DATASET_AVAILABLE',
    updateFrequency: 'PERIODIC',
    requiresAuth: false,
    isPaid: false,
    rateLimitInfo: '60 cereri/minut pe CKAN API data.gov.ro',
    attribution: 'Guvernul României / data.gov.ro sub Licența OGL-RO',
  },
  ANAF_TVA_REST: {
    id: 'ANAF_TVA_REST',
    name: 'ANAF — Agenția Națională de Administrare Fiscală (PlatitorTvaRest)',
    type: 'TAX_AUTHORITY',
    status: 'CONNECTED_AND_TESTED',
    updateFrequency: 'REALTIME',
    requiresAuth: false,
    isPaid: false,
    rateLimitInfo: '~1-2 cereri/secundă, loturi de până la 500 CUI',
    attribution: 'Ministerul Finanțelor / ANAF',
  },
  MIN_FIN_BALANCE: {
    id: 'MIN_FIN_BALANCE',
    name: 'Ministerul Finanțelor — Situații Financiare & Bilanțuri Anuale',
    type: 'FINANCIAL_MINISTRY',
    status: 'PUBLIC_DATASET_AVAILABLE',
    updateFrequency: 'PERIODIC',
    requiresAuth: false,
    isPaid: false,
    rateLimitInfo: 'Descărcare bulk seturi anuale deschise',
    attribution: 'Ministerul Finanțelor Publice',
  },
  CONTACT_DISCOVERY: {
    id: 'CONTACT_DISCOVERY',
    name: 'Radar Contact Intelligence — Descoperire Coordonate Publice',
    type: 'PUBLIC_PORTAL',
    status: 'CONNECTED_AND_TESTED',
    updateFrequency: 'DAILY',
    requiresAuth: false,
    isPaid: false,
    rateLimitInfo: 'Limitat de robots.txt și rate limiting per domeniu',
    attribution: 'Surse web publice comerciale, registre profesionale',
  },
  API_FIRME_DEV: {
    id: 'API_FIRME_DEV',
    name: 'API Firme (apifirme.dev)',
    type: 'COMMERCIAL_API',
    status: 'AVAILABLE_BUT_REQUIRES_API_KEY',
    updateFrequency: 'DAILY',
    requiresAuth: true,
    isPaid: false, // Free tier up to 50 req/day
    rateLimitInfo: '50 req/zi gratuit, scalabil contra cost',
    attribution: 'apifirme.dev',
  },
};

