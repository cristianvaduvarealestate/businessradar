# DATA DICTIONARY
## RADAR BUSINESS ROMÂNIA — Field Definitions, Types & Provenance

### 1. Master Company Attributes (`companies`)

| Field Name | Type | Description | Source / Provenance | Nullable |
| :--- | :--- | :--- | :--- | :--- |
| `cui` | INTEGER | Cod Unic de Înregistrare (Unique Tax Code) | ONRC / ANAF | No |
| `name` | TEXT | Official registered company name | ONRC | No |
| `normalized_name` | TEXT | Upper-case, diacritic-normalized search name | Engine Normalizer | Yes |
| `reg_com` | TEXT | Trade Register number (e.g. J40/1234/2023) | ONRC | Yes |
| `euid` | TEXT | European Unique Identifier (e.g. ROONRC.J40/...) | ONRC | Yes |
| `legal_form` | TEXT | SRL, SA, PFA, II, IF, SNC, SCS | ONRC | Yes |
| `incorporation_date` | TEXT | Date company was registered (YYYY-MM-DD) | ONRC | Yes |
| `county` | TEXT | Romanian county (Județ) or București | ONRC / ANAF | Yes |
| `city` | TEXT | City / Town / Locality | ONRC / ANAF | Yes |
| `street` | TEXT | Street name (Denumire stradă) | ONRC / ANAF | Yes |
| `street_nr` | TEXT | Street number | ONRC | Yes |
| `postal_code` | TEXT | 6-digit postal code | ONRC / ANAF | Yes |
| `primary_caen` | TEXT | 4-digit main activity classification code | ONRC / ANAF | Yes |
| `caen_description` | TEXT | Official activity description | ONRC Nomenclature | Yes |
| `status` | TEXT | Current legal state: ACTIVE, RADIATED, etc. | ONRC `OD_STARE_FIRMA` | No |
| `website` | TEXT | Verified commercial website URL | ONRC / Discovery Engine | Yes |
| `data_completeness_score` | REAL | Completeness percentage (0.0 to 100.0) | Scoring Engine | No |
| `opportunity_score` | REAL | Insurance sales opportunity score (0.0 to 100.0) | BI Scoring Engine | No |
| `financial_trend` | TEXT | GROWING, STABLE, DECLINING, UNKNOWN | Financial Analyzer | Yes |
| `first_observed_at` | DATETIME | Timestamp when company was first discovered | Ingestion Engine | No |
| `last_verified_at` | DATETIME | Timestamp of last ANAF / ONRC check | Ingestion Engine | Yes |

---

### 2. Tax & Fiscal Attributes (`tax_records`)

| Field Name | Type | Description | Source |
| :--- | :--- | :--- | :--- |
| `vat_registered` | INTEGER (0/1) | Whether company is active VAT payer (`scpTVA`) | ANAF API |
| `vat_start_date` | TEXT | Registration date for VAT purposes | ANAF API |
| `vat_collection_regime` | INTEGER (0/1) | Inregistrare TVA la încasare | ANAF API |
| `split_vat` | INTEGER (0/1) | Inregistrare Split TVA | ANAF API |
| `taxpayer_active` | INTEGER (0/1) | 1 if active, 0 if declared inactive by ANAF | ANAF API |
| `e_factura_registered` | INTEGER (0/1) | Status in national RO e-Factura registry | ANAF API |
| `fiscal_domicile` | TEXT | Full official fiscal domicile string | ANAF API |

---

### 3. Financial Statement Attributes (`financial_records`)

| Field Name | Type | Description | Unit | Missing Value Rule |
| :--- | :--- | :--- | :--- | :--- |
| `fiscal_year` | INTEGER | Reporting fiscal year (e.g. 2023, 2024) | Year | No |
| `turnover` | REAL | Cifra de afaceri netă | RON | NULL (Never 0) |
| `total_revenues` | REAL | Venituri totale | RON | NULL (Never 0) |
| `gross_profit` | REAL | Profit brut | RON | NULL (Never 0) |
| `net_profit` | REAL | Profit net | RON | NULL (Never 0) |
| `net_loss` | REAL | Pierdere netă | RON | NULL (Never 0) |
| `fixed_assets` | REAL | Active imobilizate | RON | NULL (Never 0) |
| `current_assets` | REAL | Active circulante | RON | NULL (Never 0) |
| `total_liabilities` | REAL | Datorii totale | RON | NULL (Never 0) |
| `equity` | REAL | Capitaluri proprii | RON | NULL (Never 0) |
| `employees_avg` | INTEGER | Număr mediu de salariați | Count | NULL (Never 0) |
