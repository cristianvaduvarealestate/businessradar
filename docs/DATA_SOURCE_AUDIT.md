# DATA SOURCE AUDIT & RESEARCH REPORT
## RADAR BUSINESS ROMÂNIA — Autonomous National Business Intelligence

This document provides a comprehensive, verified audit of all external data sources, official registries, APIs, open-data portals, and commercial aggregators providing company, financial, legal, tax, and contact intelligence for Romanian enterprises.

Audit Timestamp: 2026-11-14
Classification Standards:
- **CONNECTED_AND_TESTED**: Fully integrated, tested against live or staged endpoints, active in production ingestion.
- **CONNECTED_BUT_LIMITED**: Functional connection, but constrained by rate limits, quotas, or partial data fields.
- **PUBLIC_DATASET_AVAILABLE**: Open dataset (CSV, XML, JSON, ZIP, Parquet) published periodically with permitted reuse.
- **AVAILABLE_BUT_REQUIRES_API_KEY**: Service is accessible and functional, requires free or authenticated developer registration.
- **AVAILABLE_BUT_PAID**: Commercial service with subscription or pay-per-query model; connector architected but gated.
- **RESEARCHED_BUT_NOT_INTEGRATED**: Evaluated, documented, but deferred in favor of direct official primary sources.
- **UNAVAILABLE**: Endpoint deprecated, service shut down, or permanently unreachable.
- **ACCESS_RESTRICTED**: Gated by national security, strict legal restriction, CAPTCHA, or anti-bot mechanisms prohibiting automated processing.

---

## 1. Master Comparison & Provider Audit Matrix

| Provider / Source | Primary Entity | Data Types Provided | Ingestion Mode | Auth / Key | Update Frequency | Cost / Tier | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ONRC Open Data (data.gov.ro)** | National Trade Register Office | Firm registry, CUI, RegCom, Name, Address, County, CAEN, Status | Bulk CSV / CKAN API | None (Open Public) | Periodic / Quarterly | Free (€0) | **PUBLIC_DATASET_AVAILABLE** |
| **ANAF PlatitorTvaRest API v8/v9** | Tax Administration Agency | Tax status, VAT, Split VAT, Inactivity, Domicile, e-Factura status | REST JSON POST (batch up to 500 CUI) | None (Public API) | Daily / Realtime | Free (€0, rate-limited) | **CONNECTED_AND_TESTED** |
| **Ministerul Finanțelor (mfinante.gov.ro)** | Ministry of Finance | Annual balance sheets, Turnover, Profit, Loss, Assets, Liabilities, Employees | Annual Open Datasets / Web query | None / Public | Annual (per fiscal year) | Free (€0) | **PUBLIC_DATASET_AVAILABLE** |
| **API Firme (apifirme.dev)** | Commercial Aggregator | Aggregated company details, ANAF, financial balance sheets, court cases | REST JSON API | API Key required | Continuous / Daily | Free Tier (50 req/day) / Paid | **AVAILABLE_BUT_REQUIRES_API_KEY** |
| **Firme360 (firme360.ro)** | Commercial Aggregator | Company reports, contact hints, risk assessment | REST API / Web | API Key | Daily | Paid tiers | **AVAILABLE_BUT_PAID** |
| **SEAP / SICAP (e-licitatie.ro)** | Public Procurement Agency | Public contracts, tenders, awards, participating economic operators | Open Data / OCDS JSON / CSV | None for bulk open data | Daily / Monthly | Free (€0) | **PUBLIC_DATASET_AVAILABLE** |
| **Monitorul Oficial (Partea a IV-a)** | Official Gazette | Incorporations, shareholder changes, capital increases, dissolutions | PDF / Web publications | Subscription / Restricted | Daily | Paid / Restricted | **ACCESS_RESTRICTED** |
| **Buletinul Procedurilor de Insolvență (BPI)** | ONRC / Ministry of Justice | Insolvency notices, creditor meetings, reorganization, bankruptcy | Portal query / RSS | Registration required | Daily | Paid per credit / Restricted | **ACCESS_RESTRICTED** |
| **European Business Registers / BRIS** | European Commission | Cross-border EU company verification, EUID, branch registrations | EU BRIS REST / SOAP | Inter-governmental / E-Justice | On-demand | Free for public basic search | **RESEARCHED_BUT_NOT_INTEGRATED** |
| **Eurostat Business Datasets** | Statistical Office of the EU | Macroeconomic aggregates, structural business statistics by NACE Rev. 2 | Bulk TSV / REST API | None | Quarterly / Annual | Free (€0) | **RESEARCHED_BUT_NOT_INTEGRATED** |
| **Open Data Portal (data.gov.ro)** | Romanian Government | Cross-agency datasets (licenses, accreditations, subsidies) | CKAN API / Direct Download | None | Varies | Free (€0) | **CONNECTED_AND_TESTED** |

---

## 2. In-Depth Source Analysis

### 2.1 ONRC (Oficiul Național al Registrului Comerțului)
- **Nature of Data**: Legal incorporation, company name, CUI, RegCom number (J-number), registered office, county, postal code, primary CAEN code, status (active, radiated, suspended, dissolved).
- **Access Mechanism**:
  1. *Open Data releases on data.gov.ro*: Published as CSV files categorized into "neradiate cu sediu", "neradiate fără sediu", "radiate", and status nomenclature dictionaries. File sizes range from 30MB to 250MB uncompressed.
  2. *portal.onrc.ro (Recom online)*: Interactive portal intended for single certificates; protected by CAPTCHA, authentication, and fee per certificate. Not suitable for programmatic bulk scraping.
- **Legal & Licensing**: Open Government Licence (OGL-RO) / Directive (EU) 2019/1024 on open data and the re-use of public sector information. Free reuse permitted with provenance attribution.
- **Engineering Strategy**: Automatic CKAN discovery of the latest package tagged `onrc` or `firme-inregistrate`, streaming download of CSV datasets, hash-validation, and incremental upsert into the local intelligence database with CUI as primary key.

### 2.2 ANAF (Agenția Națională de Administrare Fiscală)
- **Nature of Data**: Up-to-the-minute fiscal status:
  - Active vs. Inactive taxpayer (`statusInactivi`)
  - Registered for VAT (`scpTVA`: true/false, start/end dates)
  - Split VAT regime (`statusSplitTVA`)
  - VAT at collection / TVA la încasare (`statusTvaIncasare`)
  - Public e-Factura registry status (`statusRO_e_Factura`)
  - Official registered headquarters and fiscal domicile details
- **Endpoint**: `https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva`
- **Method**: HTTP POST with JSON array `[{"cui": 1234567, "data": "YYYY-MM-DD"}]` (batch size up to 500 CUIs per call).
- **Rate Limits & Behavior**: Publicly accessible without API token. Strict rate-limiting applies (~1 request every 1-2 seconds per IP). Batching 100-500 CUIs per payload optimizes throughput.
- **Engineering Strategy**: Synchronous real-time verification during single-company lookup; asynchronous chunked batching (e.g., 200 CUIs per batch with 1.5s delay) during background enrichment.

### 2.3 Ministerul Finanțelor (mfinante.gov.ro / Open Data)
- **Nature of Data**: Annual financial balance sheets filed under Romanian accounting standards (OMFP 1802 / IFRS):
  - Annual turnover (Cifra de afaceri netă)
  - Total revenues (Venituri totale)
  - Gross profit / Net profit (Profit net)
  - Net loss (Pierdere netă)
  - Fixed assets (Active imobilizate)
  - Current assets (Active circulante)
  - Total liabilities / Debts (Datorii totale)
  - Equity / Capitaluri proprii
  - Average number of employees (Număr mediu de salariați)
- **Access Mechanism**:
  1. *Annual bulk open-data releases*: Published on data.gov.ro or mfinante.gov.ro portal covering hundreds of thousands of companies.
  2. *Single-entity verification*: Ministry form-query returning the latest balance sheet values.
- **Legal & Licensing**: Public administrative data.
- **Engineering Strategy**: Schema normalizer parsing balance sheets into `financial_records` table linked by `company_cui` and `fiscal_year`. All missing metrics remain `NULL` (never converted to 0).

### 2.4 API Firme (apifirme.dev)
- **Nature of Data**: Aggregated data combining ANAF, ONRC, and court records (Dosare de instanță / Portal Just).
- **Access Mechanism**: REST API.
- **Pricing & Quota**: Free tier includes 50 queries/day. Paid plans scale from €15/month for high-volume access.
- **Engineering Strategy**: Configured as an optional secondary enrichment provider. When an API key is supplied by the user, the connector enriches pending dossiers; when absent, the system operates seamlessly using direct official sources (ONRC + ANAF + MinFin).

### 2.5 SEAP / SICAP (e-licitatie.ro)
- **Nature of Data**: Romanian public procurement notices, contract award notices, direct purchases, winning bidders, and contract values.
- **Access Mechanism**: Open Data exports in CSV / OCDS (Open Contracting Data Standard) format published through data.gov.ro and SICAP open data endpoints.
- **Value for Insurance**: Companies winning public infrastructure, construction, or transport contracts represent prime leads for Performance Bonds (Garanții de bună execuție), CAR/EAR insurance, and professional liability.

### 2.6 Commercial Contact Discovery Engine
- **Nature of Data**: Public commercial contact coordinates:
  - Official domain name / website
  - Commercial email address (e.g. `office@`, `contact@`, `sales@`)
  - Corporate telephone / switchboard
  - Physical headquarters / showroom address
- **Compliance & Legal (GDPR & Law 506/2004)**:
  - Strict data minimization: Only corporate/commercial contact points are collected.
  - Personal director/employee social profiles or private emails are never scraped or stored.
  - All contacts have explicit provenance (source URL, timestamp, confidence level).
  - Built-in Global Suppression List (DO NOT CONTACT).

---

## 3. Data Integration Priority & Architecture Plan

```
┌────────────────────────────────────────────────────────┐
│               RADAR INGESTION ORCHESTRATOR             │
└──────────────────────────┬─────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  ONRC Parser │   │  ANAF Client │   │ MinFin Parser│
│ (data.gov.ro)│   │  (REST v8/9) │   │ (Financials) │
└───────┬──────┘   └───────┬──────┘   └───────┬──────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│           CORE COMPANY INTELLIGENCE DATABASE           │
│   (Normalized SQLite / DuckDB / Parquet Warehouse)     │
├────────────────────────────────────────────────────────┤
│ - companies (cui, name, caen, status, address, etc.)   │
│ - tax_records (vat, inactive, split_vat, e_factura)    │
│ - financial_records (turnover, profit, employees, year)│
│ - contacts (email, phone, website, provenance, verified)│
│ - insurance_opportunities (product, trigger, rationale)│
│ - prospect_pipeline (status, notes, follow_ups)        │
│ - ingestion_jobs & audit_logs                          │
└────────────────────────────────────────────────────────┘
```
