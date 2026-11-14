# SYSTEM ARCHITECTURE SPECIFICATION
## RADAR BUSINESS ROMÂNIA — Autonomous National Business Intelligence Platform

### 1. High-Level Architecture

Radar Business România is constructed around an event-driven, decoupled data engineering and intelligence pipeline.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION & DASHBOARD LAYER                  │
│                     Next.js 14 (App Router) + Tailwind                 │
├────────────────────────────────┬───────────────────────────────────────┤
│ - National Database Search     │ - 20 CAEN Industry Category Hubs      │
│ - New Companies 90-Day Radar   │ - Real-time Provenance Profile Pages  │
│ - Insurance Opportunity Engine │ - Lead CRM & Follow-Up Sales Pipeline │
└────────────────────────────────┴───────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         CORE APPLICATION LAYER                         │
│                     TypeScript / Node.js API Routes                    │
├────────────────────────────────┬───────────────────────────────────────┤
│ - Query & Filtering Engine     │ - Export Pipeline (CSV / XLSX)        │
│ - Opportunity Scoring Logic    │ - Suppression List Validator          │
│ - Telegram Digest Dispatcher   │ - Manual CRM Pipeline Controller      │
└────────────────────────────────┴───────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA PERSISTENCE LAYER                          │
│               SQLite (WAL Mode) + FTS5 Full-Text Search                │
├────────────────────────────────┬───────────────────────────────────────┤
│ - Master `companies` table     │ - `financial_records` (Multi-Year)    │
│ - `tax_records` (ANAF state)   │ - `insurance_opportunities`           │
│ - `contact_records`            │ - `ingestion_jobs` & `audit_log`      │
└────────────────────────────────┴───────────────────────────────────────┘
                                 ▲
                                 │
┌────────────────────────────────┴───────────────────────────────────────┐
│                      INGESTION & AUTOMATION LAYER                      │
│             Scheduled Workers (GitHub Actions / Cloud Crons)           │
├────────────────────────────────┬───────────────────────────────────────┤
│ - `OnrcCkanConnector`          │ - `AnafTaxConnector`                  │
│ - `MinFinFinancialConnector`   │ - `ContactDiscoveryConnector`         │
│ - `WatchdogMonitor`            │ - `TelegramNotificationService`       │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

### 2. Component Design Principles

1. **Connector Fault Isolation**: If the ANAF API is temporarily rate-limiting or down, ONRC dataset synchronization and internal opportunity processing continue unabated.
2. **CUI as Canonical Key**: Every record across tax, financial, and contact domains connects to a verified Romanian CUI.
3. **Data Immutability & Provenance**: Raw incoming data retains source tags, timestamps, and confidence scores.
4. **Desktop-First & Responsive UX**: Designed for high-density business analysis with titanium/graphite aesthetics, rapid filtering, and deep profile drill-downs.
