# RADAR BUSINESS ROMÂNIA
## Autonomous National Business Intelligence, Company Discovery & Insurance Lead Generation Platform

**Domain**: `radar.cristianvaduva.com`  
**License**: Open Government License (OGL-RO) / Directive (EU) 2019/1024  
**Target Infrastructure Cost**: **€0.00 / month** (Within standard cloud free-tier allocations)

---

## 1. Executive Summary

**RADAR BUSINESS ROMÂNIA** is an autonomous, production-ready enterprise intelligence engine and insurance lead prospecting platform built specifically for the Romanian market.

The platform continuously discovers, consolidates, classifies, enriches, and monitors Romanian economic entities using legally accessible open data, official registries (ONRC, ANAF, Ministerul Finanțelor, data.gov.ro), and commercial channels.

Its core business mission is to identify actionable commercial insurance leads (CAR/EAR, CMR carrier liability, Tech E&O, Cyber risk, Medical malpractice, Commercial property, D&O, and employee benefits) through an explainable, deterministic rules engine.

---

## 2. Core Capabilities & Architecture

- **National Company Database**: High-performance SQLite engine running in WAL mode with FTS5 (Full-Text Search) across millions of entities. CUI is the universal unique identifier.
- **Continuous Ingestion Engine**: Automated CKAN API connector discovering the latest ONRC datasets (`firme-04-11-2026`) and streaming updates.
- **20 Industry Classification Hubs**: Complete CAEN Rev. 2 / Rev. 3 mapping covering Hospitality, Tourism, Rental, Short-Term Rentals, Real Estate, Construction, IT, Automotive, Transport, Healthcare, Manufacturing, Retail, Financial Services, Education, Agriculture, Energy, Beauty, Events, and Facility Services.
- **Deterministic Insurance Engine**: Auditable business logic matching official CAEN codes, headcount, and asset footprints to concrete insurance products with broker talking points and legal justifications.
- **Manual Prospecting CRM**: 7-stage sales pipeline (Nou Descoperit, În Verificare, De Contactat, Contactat, Interesat, Ofertă Trimisă, Client Semnat).
- **Telegram Automation**: Real-time Telegram Bot API integration delivering new company alerts, daily digests, watchdog health reports, and duplicate prevention via SHA-256 payload hashing.
- **Fail-Safe Watchdog**: Independent monitor tracking database freshness, connector latency, and automated alerts if scheduled jobs miss their execution window.
- **GDPR & Suppression List**: Strict data minimization focused on corporate B2B entities, with built-in exclusion (DO NOT CONTACT) filtering.

---

## 3. Technology Stack

- **Full-Stack Application**: Next.js 14+ (App Router), React 18, Tailwind CSS, TypeScript
- **Database Engine**: SQLite 3.51 (WAL mode, memory cache 64MB, FTS5 virtual tables) via `better-sqlite3`
- **Automation & Ingestion**: Python 3.9+ / Node.js scheduled via GitHub Actions (`.github/workflows/scheduled-ingestion.yml`)
- **Notification Engine**: Telegram Bot API (HTML formatted messages)
- **Deployment**: Vercel / Cloudflare Pages / Standalone Node Docker container

---

## 4. Quick Start & Local Execution

### 4.1 Prerequisites
- Node.js 20+
- Python 3.9+

### 4.2 Installation
```bash
# Clone and enter directory
cd "BUSSINESS RADAR"

# Install dependencies
npm install

# Initialize Database Schema
python3 scripts/init_database.py

# Ingest Real ONRC Company Records (2,900+ entities)
python3 scripts/ingest_from_csv.py

# Run Automated Test Suite
npm test
```

### 4.3 Running Development Server
```bash
npm run dev
# Open http://localhost:3000 in your browser
```

---

## 5. Technical Documentation Directory

Comprehensive technical specifications are documented in the `docs/` folder:

1. [`docs/ARCHITECTURE.md`](file:///Users/cristianvaduva/Projects/BUSSINESS%20RADAR/docs/ARCHITECTURE.md) — System Architecture, Data Flow & Component Design
2. [`docs/DATA_SOURCE_AUDIT.md`](file:///Users/cristianvaduva/Projects/BUSSINESS%20RADAR/docs/DATA_SOURCE_AUDIT.md) — Comprehensive Audit Matrix of Romanian & European Data Sources
3. [`docs/DATABASE_SCHEMA.md`](file:///Users/cristianvaduva/Projects/BUSSINESS%20RADAR/docs/DATABASE_SCHEMA.md) — DDL SQL Schemas, Tables, Indexes, and Constraints
4. [`docs/CAEN_CLASSIFICATION.md`](file:///Users/cristianvaduva/Projects/BUSSINESS%20RADAR/docs/CAEN_CLASSIFICATION.md) — 20 Economic Sectors Taxonomy & CAEN Mappings
5. [`docs/INSURANCE_RULES.md`](file:///Users/cristianvaduva/Projects/BUSSINESS%20RADAR/docs/INSURANCE_RULES.md) — Deterministic Rules Engine, Confidence Scores & Rationale
6. [`docs/INFRASTRUCTURE_AND_COSTS.md`](file:///Users/cristianvaduva/Projects/BUSSINESS%20RADAR/docs/INFRASTRUCTURE_AND_COSTS.md) — €0/Month Free-Tier Strategy & Cloud Scaling Limits
7. [`docs/SECURITY_AND_PRIVACY.md`](file:///Users/cristianvaduva/Projects/BUSSINESS%20RADAR/docs/SECURITY_AND_PRIVACY.md) — GDPR, Law 506/2004, Data Minimization & Secret Isolation
8. [`docs/API_CONNECTORS.md`](file:///Users/cristianvaduva/Projects/BUSSINESS%20RADAR/docs/API_CONNECTORS.md) — Standardized `CompanyDataProvider` Adapter Interfaces
9. [`docs/SCHEDULING_AND_MONITORING.md`](file:///Users/cristianvaduva/Projects/BUSSINESS%20RADAR/docs/SCHEDULING_AND_MONITORING.md) — Cron Pipeline, Ingestion State Machine & Watchdog
10. [`docs/DEPLOYMENT.md`](file:///Users/cristianvaduva/Projects/BUSSINESS%20RADAR/docs/DEPLOYMENT.md) — Cloudflare DNS, Vercel & Docker Deployment Instructions
11. [`docs/TEST_REPORT.md`](file:///Users/cristianvaduva/Projects/BUSSINESS%20RADAR/docs/TEST_REPORT.md) — Automated Test Suite Results & Production Smoke Tests
12. [`docs/IMPLEMENTATION_STATUS.md`](file:///Users/cristianvaduva/Projects/BUSSINESS%20RADAR/docs/IMPLEMENTATION_STATUS.md) — 20-Phase Completion Audit & Metric Verification
13. [`docs/DATA_DICTIONARY.md`](file:///Users/cristianvaduva/Projects/BUSSINESS%20RADAR/docs/DATA_DICTIONARY.md) — Field Definitions, Units, Types & Provenance Trail
