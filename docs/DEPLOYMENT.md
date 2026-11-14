# PRODUCTION DEPLOYMENT GUIDE
## RADAR BUSINESS ROMÂNIA — radar.cristianvaduva.com

### 1. Prerequisites & Secrets

Deploying Radar Business România requires the following environment variables:

| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_PATH` | Path to persistent SQLite database | Yes | `./data/radar_business.db` |
| `NEXT_PUBLIC_APP_URL` | Public canonical base URL | Yes | `https://radar.cristianvaduva.com` |
| `TELEGRAM_BOT_TOKEN` | Token obtained from @BotFather | Optional | `123456789:ABCdefGHIjklMNOpqrs` |
| `TELEGRAM_CHAT_ID` | Telegram chat ID for notifications | Optional | `-1001234567890` or `123456789` |
| `APIFIRME_API_KEY` | Commercial aggregator fallback key | Optional | `api_key_xyz` |

---

### 2. Zero-Cost Production Hosting Options

#### Option A: Vercel + GitHub Actions + R2 (Recommended)
1. **Frontend / API**: Push code to GitHub repository and connect to Vercel. Set environment variables.
2. **Database & Ingestion**:
   - Automated ingestion runs via `.github/workflows/scheduled-ingestion.yml`.
   - SQLite DB stored in persistent storage or committed to private data branch / synced to Cloudflare R2 bucket.
3. **Domain Configuration**:
   - Add CNAME `radar` pointing to `cname.vercel-dns.com` in Cloudflare DNS for `cristianvaduva.com`.
   - Enable Cloudflare SSL/TLS Full (Strict).

#### Option B: Standalone Docker / VPS
1. Build container: `docker build -t radar-business-ro .`
2. Run container: `docker run -d -p 3000:3000 -v $(pwd)/data:/app/data --env-file .env radar-business-ro`
3. Caddy / Nginx reverse proxy with automatic Let's Encrypt SSL certificate.

---

### 3. Verification & Smoke Testing
Run automated production verification:
```bash
npm run test:e2e
npm run test:connectors
```
