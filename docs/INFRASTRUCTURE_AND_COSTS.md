# INFRASTRUCTURE & COSTS AUDIT
## RADAR BUSINESS ROMÂNIA — €0/Month Free-Tier Architecture Specification

### 1. Cost & Infrastructure Summary

The Radar Business România platform is engineered to achieve enterprise-grade business intelligence and lead discovery with an initial infrastructure operating cost of **€0.00 / month**, utilizing high-capacity free tiers from leading cloud infrastructure and open-data providers.

| Component | Technology / Provider | Free Tier Allocation | Estimated Monthly Usage (MVP) | Projected Monthly Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Web Application & API** | Next.js 14+ (App Router) on Vercel / Cloudflare Pages | Unlimited deployments, 100k req/day | ~5,000 req/day | **€0.00** |
| **Operational Database** | SQLite (WAL mode) / Cloudflare D1 | 5 GB storage, 5M reads/day, 100k writes/day | 1.2 GB DB, ~200k reads/day | **€0.00** |
| **Analytical & Bulk ETL** | DuckDB + Parquet (in-process / GitHub Actions) | Embedded local compute / GitHub Actions | 12 ETL runs/month | **€0.00** |
| **Object & Raw Dataset Storage** | Cloudflare R2 | 10 GB storage, 1M write ops, 10M read ops, €0 egress | 4.5 GB raw datasets | **€0.00** |
| **Ingestion Workers & Crons** | GitHub Actions + Cloudflare Workers Cron Triggers | 2,000 free runner mins/mo + 3 free cron triggers | ~350 runner mins/mo | **€0.00** |
| **Notifications & Alerting** | Telegram Bot API | Unlimited messages (30 msgs/sec rate limit) | ~150 msgs/day | **€0.00** |
| **Public Data Ingestion** | ONRC / data.gov.ro / ANAF | Open Government Data / Public REST API | ~5 GB downloads/month | **€0.00** |
| **Domain & DNS** | Cloudflare Free DNS (`radar.cristianvaduva.com`) | Free DNS, DDoS protection, SSL certificate | Global Edge CDN | **€0.00** (existing domain) |
| **Total Monthly Cost** | | | | **€0.00 / month** |

---

### 2. Scalability Architecture: Hybrid Embedded + Distributed Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                          EDGE CDN / CLOUDFLARE                         │
│                    radar.cristianvaduva.com (SSL/DDoS)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
      ┌───────────────────────┐           ┌───────────────────────┐
      │  Next.js 14 Frontend  │           │ Telegram Bot Dispatch │
      │  UI & BI Dashboard    │           │ (Alerts, Daily Brief) │
      └───────────┬───────────┘           └───────────▲───────────┘
                  │                                   │
                  ▼                                   │
      ┌───────────────────────┐                       │
      │ Core SQLite Database  │                       │
      │  - Companies          │                       │
      │  - Tax & Financials   │                       │
      │  - Opportunities      │                       │
      │  - CRM Leads & Notes  │                       │
      └───────────▲───────────┘                       │
                  │                                   │
                  └─────────────────┐                 │
                                    │                 │
┌───────────────────────────────────┴─────────────────┴──────────────────┐
│                    SCHEDULED INGESTION ENGINE                          │
│             (GitHub Actions Cron / Cloudflare Workers)                 │
├─────────────────────────┬───────────────────────┬──────────────────────┤
│      ONRC Sync Engine   │   ANAF Fiscal Sync    │  Contact Discovery   │
│  - data.gov.ro CKAN API │ - Batch VAT / e-Fact  │ - Website validator  │
│  - Streaming CSV Parser │ - Status verification │ - Corporate contacts │
└─────────────────────────┴───────────────────────┴──────────────────────┘
```

#### 2.1 Multi-Tier Storage Strategy
1. **Raw Tier (Cloudflare R2 / Local cache)**:
   - Stores raw downloaded ONRC dumps (`OD_FIRME.CSV`, `OD_CAEN_AUTORIZAT.CSV`, `OD_STARE_FIRMA.CSV`), nomenclatures, and checksums.
   - Preserves original files for provenance verification and audit compliance.
2. **Analytical Stream (DuckDB)**:
   - Capable of scanning 200MB-1GB CSV files in < 3 seconds using vector execution.
   - Extracts delta records (new incorporations, status transitions) into compressed Parquet or directly executes upserts.
3. **Operational Tier (SQLite with WAL & Full-Text Search)**:
   - Pragmas tuned for high-concurrency read performance (`journal_mode = WAL`, `synchronous = NORMAL`, `cache_size = -64000`, `temp_store = MEMORY`).
   - SQLite FTS5 (Full-Text Search) virtual tables indexed on `name`, `cui`, `reg_com`, `county`, `city`, and `keywords` for sub-5ms search latency across hundreds of thousands of records.
   - Directly migratable to Cloudflare D1 or PostgreSQL (Supabase / Neon free tier) with zero code rewrite due to standard SQL abstraction.

---

### 3. Rate Limits & Quota Safeguards

1. **ANAF Public API**:
   - Limit: ~1-2 requests/sec per IP.
   - Batching: Up to 500 CUIs per HTTP POST payload.
   - Strategy: Ingestion runs chunked requests with an adaptive delay (1.5s backoff) to strictly prevent HTTP 429 / connection resets.
2. **data.gov.ro CKAN API**:
   - Limit: 60 requests/minute.
   - Strategy: Cache dataset metadata for 6 hours; only query package metadata during scheduled synchronization windows.
3. **Telegram Bot API**:
   - Limit: 30 messages/second globally; 1 message/second to individual chats.
   - Strategy: Batch new company announcements into grouped digest messages with clickable deep links (`radar.cristianvaduva.com/companies/{cui}`).
