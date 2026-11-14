# API CONNECTORS SPECIFICATION & PROVIDER INTERFACE
## RADAR BUSINESS ROMÂNIA — Standardized Ingestion Adapters

### 1. Standard Provider Abstraction (`CompanyDataProvider`)

All data source integrations in Radar Business România implement a unified TypeScript interface:

```typescript
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

  // Lifecycle & Health
  testConnection(): Promise<{ success: boolean; latencyMs: number; message: string }>;
  
  // Data Extraction
  discoverAvailableUpdates?(): Promise<Array<{ datasetId: string; title: string; publishedAt: string; downloadUrl: string; sizeBytes?: number }>>;
  fetchCompanyByCUI?(cui: number): Promise<PartialCompanyRecord | null>;
  fetchBatchCompanies?(cuis: number[]): Promise<Map<number, PartialCompanyRecord>>;
  fetchFinancialData?(cui: number, fiscalYear?: number): Promise<FinancialRecord[]>;
}
```

---

### 2. Implemented Connectors

1. **`OnrcCkanConnector`** (Official Registry / Open Data):
   - Queries data.gov.ro CKAN API endpoint `https://data.gov.ro/api/3/action/package_search?q=onrc`
   - Detects new published packages (`firme-DD-MM-YYYY`) and nomenclature tables.
   - Streams CSV files with delimiter handling (`^`), UTF-8 encoding normalization, and CUI deduplication.

2. **`AnafTaxConnector`** (Tax Administration):
   - Connects to ANAF REST service `https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva`.
   - Sends batched JSON arrays of `{ cui: number, data: "YYYY-MM-DD" }` (batches of 100-500).
   - Parses VAT payer status (`scpTVA`), split VAT, inactivity register (`statusInactivi`), e-Factura registration, and fiscal domicile.

3. **`MinFinFinancialConnector`** (Ministry of Finance):
   - Ingests official annual balance sheet data (`turnover`, `total_revenues`, `net_profit`, `net_loss`, `fixed_assets`, `total_liabilities`, `employees_avg`).
   - Maintains strict `NULL` handling (never zeroing missing figures).

4. **`ContactDiscoveryConnector`** (Commercial Discovery):
   - Discovers corporate website URLs from ONRC filings and official business listings.
   - Extracts public commercial coordinates (`office@`, `contact@`, commercial phone numbers) strictly respecting robots.txt and corporate contact boundaries.
   - Marks contacts with verification status and confidence score.

5. **`ApiFirmeConnector`** (Commercial Fallback):
   - Standardized adapter for `apifirme.dev` REST API.
   - Fully architected, enabled when user inputs optional API key in Settings.
