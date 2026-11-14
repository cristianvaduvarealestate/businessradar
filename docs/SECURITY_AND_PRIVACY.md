# SECURITY, PRIVACY & LEGAL COMPLIANCE
## RADAR BUSINESS ROMÂNIA — GDPR, Data Minimization & Security Architecture

### 1. Legal Basis & Permitted Processing

Radar Business România processes publicly accessible Romanian commercial enterprise data in accordance with:
- **Regulation (EU) 2016/679 (GDPR)**: Legal basis under Article 6(1)(f) (Legitimate Interest) for business-to-business (B2B) commercial intelligence, risk assessment, and insurance brokerage market analysis.
- **Directive (EU) 2019/1024** on open data and the re-use of public sector information.
- **Romanian Law no. 506/2004** on the processing of personal data and the protection of privacy in the electronic communications sector.

#### 1.1 Scope of Data Collection
- The platform strictly focuses on legal entities (societăți cu răspundere limitată, societăți pe acțiuni, etc.) and authorized business operators.
- **No Personal Profiling**: Personal social media accounts, personal phone numbers, or private director emails are excluded.
- **Commercial Points of Contact**: Only corporate communication coordinates (`office@`, `contact@`, public switchboard telephone numbers) designated for general business inquiries are processed.

#### 1.2 Global Suppression List (DO NOT CONTACT)
- Companies or individuals who request exclusion are instantly entered into the `suppression_list` table.
- Suppressed entities are automatically:
  1. Filtered out from all sales opportunity views.
  2. Blocked from Telegram alert dispatches.
  3. Excluded from CSV/XLSX export pipelines.

---

### 2. Platform Security Architecture

1. **Zero Secret Leakage**:
   - All external keys (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, optional `APIFIRME_API_KEY`) are managed exclusively via environment variables on the server side.
   - Secrets are never bundled into client-side Next.js JavaScript artifacts or exposed via public REST endpoints.

2. **Input Validation & SQL Injection Prevention**:
   - All database queries use parameterized SQL statements via SQLite prepared statements.
   - Search parameters and CUI queries undergo numeric sanitization.

3. **Rate Limiting & Anti-Abuse**:
   - Global rate limiter on public search and API endpoints to prevent abusive scraping.
   - Strict adherence to external provider limits (ANAF backoff, data.gov.ro caching).

4. **Auditability & Provenance**:
   - Every single record stored contains immutable provenance metadata (`source`, `collected_at`, `confidence_score`, `last_verified_at`).
