# SCHEDULING, AUTOMATION & WATCHDOG SPECIFICATION
## RADAR BUSINESS ROMÂNIA — Autonomous Pipeline & Fail-Safe Architecture

### 1. Ingestion Scheduling Model

Radar Business România is engineered to run completely autonomously without requiring the user's local machine to remain active.

```
┌────────────────────────────────────────────────────────┐
│             GITHUB ACTIONS WORKFLOW (Cron)             │
│        .github/workflows/scheduled-ingestion.yml       │
└──────────────────────────┬─────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Every 4h:   │   │  Daily 06:00 │   │ Daily 08:00  │
│  ONRC Sync   │   │   ANAF Sync  │   │  Heartbeat   │
└───────┬──────┘   └───────┬──────┘   └───────┬──────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│             INDEPENDENT SYSTEM WATCHDOG                │
│    - Verifies last successful run age < 24 hours       │
│    - Checks connector health & database integrity      │
│    - Dispatches Telegram alert if pipeline is stalled  │
└────────────────────────────────────────────────────────┘
```

---

### 2. Job Status Lifecycle

Every execution record in `ingestion_jobs` conforms to the state machine:
- `PENDING`: Scheduled and queued.
- `RUNNING`: Worker actively acquiring data or executing upserts.
- `SUCCESS`: Ingestion finished with new or updated records.
- `NO_NEW_DATA`: Connector executed successfully, verified no updates published by remote source. (Distinct from failure).
- `PARTIAL_SUCCESS`: Some batches succeeded; non-fatal rate limits encountered.
- `FAILED`: Connector raised unhandled exception, network reset, or fatal parsing error.
- `SKIPPED`: Job bypassed due to active lock or missing optional credentials.

---

### 3. Fail-Safe Watchdog & Telegram Alerting

The Watchdog runs daily at 08:00 (Europe/Bucharest time):
1. **Heartbeat Verification**: Inspects `ingestion_jobs` over the trailing 24 hours.
2. **Connector Availability**: Pings ONRC and data.gov.ro CKAN endpoints.
3. **Delivery**: Sends operational heartbeat to Telegram:
   ```
   ⚡ RADAR BUSINESS ROMÂNIA — DAILY SYSTEM REPORT
   📅 2026-11-14 08:00 EET
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Status: OPERATIONAL ✅
   Database Companies: 1,428,520
   New Today: 342
   ANAF Verification: OK
   ONRC Connector: OK
   Scheduled Jobs (24h): 6 / 6 Success
   Next Run: Today at 12:00 EET
   ```
4. **Stall Alerting**: If no successful sync has completed within 36 hours, an immediate `🚨 CRITICAL WATCHDOG ALERT` is sent with error logs.
