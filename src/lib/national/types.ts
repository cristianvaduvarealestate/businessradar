/**
 * NATIONAL COMPANY DATABASE TYPES & INTERFACES
 * Architecture for scalable Romanian company intelligence separated from operational D1.
 */

export interface NationalCompany {
  cui: number;
  name: string;
  normalized_name: string;
  reg_com?: string;
  euid?: string;
  legal_form: string;
  registration_date?: string; // YYYY-MM-DD
  country?: string;
  county?: string;
  city?: string;
  street?: string;
  street_nr?: string;
  building?: string;
  stair?: string;
  floor?: string;
  apartment?: string;
  postal_code?: string;
  sector?: string;
  address_details?: string;
  website_raw?: string;
  parent_company_country?: string;
  legal_status: string; // ACTIVE, RADIATED, SUSPENDED, DISSOLVED, UNKNOWN
  fiscal_status: string; // FISCALLY_ACTIVE, FISCALLY_INACTIVE, REACTIVATED, UNKNOWN
  primary_caen?: string;
  caen_description?: string;
  source_dataset_id: string;
  source_file_name: string;
  imported_at: string;
}

export interface NationalInvalidRecord {
  id?: number;
  raw_cui: string;
  raw_line: string;
  rejection_reason: string; // CUI_ZERO, INVALID_DELIMITER, MALFORMED_FIELDS
  name?: string;
  reg_com?: string;
  legal_form?: string;
  county?: string;
  imported_at: string;
}

export interface NationalSearchFilters {
  q?: string; // CUI or name substring
  cui?: number;
  county?: string;
  city?: string;
  legalForm?: string;
  legalStatus?: string;
  caen?: string;
  page?: number;
  limit?: number;
  cursor?: string;
  hydrate?: boolean;
}

export interface NationalSearchResult {
  items: NationalCompany[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    nextCursor?: string;
    prevCursor?: string;
  };
  metrics: {
    searchLatencyMs: number;
    dataSource: 'NATIONAL_DATABASE_SHARD' | 'NATIONAL_LOCAL_SQLITE' | 'OPERATIONAL_FALLBACK';
    cumulativeBytesRead?: number;
    shardReadsCount?: number;
    budgetLimited?: boolean;
  };
}

export interface NationalShardManifest {
  version: string;
  dataset_id: string;
  source_file_name: string;
  source_sha256: string;
  publication_date: string;
  generated_at: string;
  total_valid_records: number;
  total_invalid_records: number;
  is_complete: boolean;
  is_synthetic: boolean;
  shards: {
    cui_partition_modulo: number;
    cui_shards_count: number;
    counties_count: number;
    name_prefixes_count: number;
  };
  metrics: {
    generation_duration_ms: number;
    total_uncompressed_bytes: number;
  };
}

export interface NationalNameIndexItem {
  cui: number;
  name: string;
  county?: string;
  status?: string;
  caen?: string;
}

export interface NationalCountyIndexItem {
  cui: number;
  name: string;
  city?: string;
  legal_form?: string;
  status?: string;
  caen?: string;
  registration_date?: string;
}

export interface NationalImportStats {
  totalSourceRows: number;
  validCuiRecords: number;
  invalidOrZeroCuiRecords: number;
  uniqueImportedCompanies: number;
  duplicateCount: number;
  rejectedCount: number;
  byLegalForm: Record<string, number>;
  byLegalStatus: Record<string, number>;
  sourceSha256?: string;
  sourceDatasetId?: string;
  lastSuccessfulImport?: string;
  databaseSizeBytes?: number;
  manifest?: NationalShardManifest;
  storageDriver?: 'R2_STORAGE' | 'LOCAL_SHARDS' | 'LOCAL_SQLITE' | 'NOT_CONFIGURED';
}
