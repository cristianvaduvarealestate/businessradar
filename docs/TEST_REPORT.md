# TEST REPORT & VERIFICATION AUDIT
## RADAR BUSINESS ROMÂNIA — Autonomous National Business Intelligence Platform

Date: 2026-11-14
Platform: Node.js v20.20.2 / SQLite 3.51.0 (WAL) / Python 3.9.6
Test Framework: Native Node.js Test Runner (`node --test`)
Status: **12 / 12 PASSED (100%)**

---

### 1. Test Suite Results Summary

| Test Suite | Tests Run | Result | Execution Duration |
| :--- | :--- | :--- | :--- |
| **`tests/caen_and_insurance.test.js`** | 2 | **PASSED** | 1.04 ms |
| **`tests/database_and_cui.test.js`** | 4 | **PASSED** | 18.15 ms |
| **`tests/telegram_and_watchdog.test.js`** | 3 | **PASSED** | 7.79 ms |
| **`tests/connectors.test.js`** | 3 | **PASSED** | 0.85 ms |
| **Total Automated Tests** | **12** | **ALL PASSED** | **82.02 ms** |

---

### 2. Verified Ingestion & Production Operations

1. **Official ONRC Open Dataset Ingestion**:
   - Source: data.gov.ro Package `firme-04-11-2026`
   - Real companies imported: **2,908 entities**
   - Active state confirmed: **2,908 entities**
   - Insurance opportunities deterministically generated: **2,640 records**
   - Provenance trail: `CUI`, `reg_com`, `euid`, `incorporation_date`, `county`, `city`, `street`, `primary_caen`
   - Duration: **52 ms** batch processing time.

2. **CUI Deduplication & Conflict Prevention**:
   - Verified: Duplicate insertion attempts on existing CUIs execute idempotent `ON CONFLICT DO UPDATE` without record multiplication.

3. **Full-Text Search (FTS5)**:
   - Verified sub-5ms query response searching across Romanian counties, cities, company names, and CAEN descriptions.

4. **Deterministic Insurance Engine**:
   - Verified CAR/EAR generation for construction companies (CAEN `4120`, `4211`).
   - Verified CMR Carrier liability for freight haulers (CAEN `4941`).
   - Verified Tech E&O and Cyber Risk for software companies (CAEN `6201`).
   - Verified Medical Malpractice for clinics under Law 95/2006 (CAEN `8621`).

5. **Watchdog & Fail-Safe Heartbeat**:
   - Verified `scripts/run_watchdog.py` queries database health, monitors last successful sync timestamp, compiles HTML digest, and handles Telegram dispatch.

6. **Next.js Production Build**:
   - `npx next build` compiled 12 static/dynamic routes with zero TypeScript or lint errors.
