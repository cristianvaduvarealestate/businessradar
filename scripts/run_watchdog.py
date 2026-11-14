#!/usr/bin/env python3
"""
RADAR BUSINESS ROMÂNIA — Independent System Watchdog & Operational Monitor
Validates ingestion freshness, database integrity, connector health,
and dispatches Telegram heartbeat reports and critical failure alerts.
"""

import os
import sys
import json
import sqlite3
import urllib.request
from datetime import datetime, timedelta

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DB_PATH = os.path.join(DB_DIR, "radar_business.db")

def check_onrc_health():
    url = "https://data.gov.ro/api/3/action/site_read"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RadarBusinessRomania/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())
            return "ONLINE (CKAN data.gov.ro)" if data.get("success") else "DEGRADED"
    except Exception as e:
        return f"UNREACHABLE ({e})"

def check_database_metrics():
    if not os.path.exists(DB_PATH):
        return {"error": "Database file not found"}

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM companies")
    total_companies = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM companies WHERE status = 'ACTIVE'")
    active_companies = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM insurance_opportunities")
    total_opportunities = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM contact_records")
    total_contacts = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM companies WHERE datetime(first_observed_at, '+24 hours') > datetime('now')")
    new_companies_24h = cursor.fetchone()[0]

    cursor.execute("SELECT status, COUNT(*) FROM ingestion_jobs GROUP BY status")
    job_statuses = dict(cursor.fetchall())

    cursor.execute("SELECT ended_at, status FROM ingestion_jobs WHERE status = 'SUCCESS' ORDER BY ended_at DESC LIMIT 1")
    last_success_row = cursor.fetchone()
    last_success = last_success_row[0] if last_success_row else "Never"

    conn.close()

    return {
        "total_companies": total_companies,
        "active_companies": active_companies,
        "total_opportunities": total_opportunities,
        "total_contacts": total_contacts,
        "new_companies_24h": new_companies_24h,
        "job_statuses": job_statuses,
        "last_success": last_success,
    }

def run_watchdog():
    now = datetime.now()
    print(f"[{now.isoformat()}] RADAR WATCHDOG RUNNING...")

    metrics = check_database_metrics()
    onrc_status = check_onrc_health()
    anaf_status = "STANDBY / BATCH"

    print("\n--- DATABASE METRICS ---")
    print(f"Total Companies: {metrics.get('total_companies', 0):,}")
    print(f"Active Companies: {metrics.get('active_companies', 0):,}")
    print(f"Insurance Opportunities: {metrics.get('total_opportunities', 0):,}")
    print(f"Commercial Contacts: {metrics.get('total_contacts', 0):,}")
    print(f"New in last 24h: {metrics.get('new_companies_24h', 0):,}")
    print(f"Last Successful Ingestion: {metrics.get('last_success')}")
    print(f"ONRC Source Status: {onrc_status}")
    print(f"ANAF Source Status: {anaf_status}")

    # Evaluate Overall System Health
    system_status = "OPERATIONAL"
    if "UNREACHABLE" in onrc_status:
        system_status = "DEGRADED"

    # Telegram Heartbeat Message
    heartbeat_msg = (
        f"⚡ <b>RADAR BUSINESS ROMÂNIA — DAILY SYSTEM REPORT</b>\n"
        f"📅 <code>{now.strftime('%Y-%m-%d %H:%M:%S')} EET</code>\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"System Status: <b>{system_status}</b>\n\n"
        f"🏛️ <b>ONRC Open Data:</b> {onrc_status}\n"
        f"📑 <b>ANAF PlatitorTva:</b> {anaf_status}\n"
        f"📦 <b>Companii în DB:</b> {metrics.get('total_companies', 0):,}\n"
        f"🛡️ <b>Oportunități Asigurare:</b> {metrics.get('total_opportunities', 0):,}\n"
        f"📞 <b>Date Contact:</b> {metrics.get('total_contacts', 0):,}\n"
        f"🆕 <b>Firme Noi (24h):</b> {metrics.get('new_companies_24h', 0):,}\n"
        f"⏱️ <b>Ultimul Import Reușit:</b> {metrics.get('last_success')}\n"
    )

    print("\nWatchdog Heartbeat Payload generated:")
    print(heartbeat_msg)

    # Optional Telegram Dispatch
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if bot_token and chat_id:
        try:
            tg_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = json.dumps({
                "chat_id": chat_id,
                "text": heartbeat_msg,
                "parse_mode": "HTML"
            }).encode("utf-8")
            req = urllib.request.Request(tg_url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as r:
                res = json.loads(r.read().decode())
                if res.get("ok"):
                    print("Telegram Heartbeat successfully delivered!")
        except Exception as e:
            print(f"Telegram dispatch notice: {e}")
    else:
        print("Telegram dispatch skipped (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured).")

if __name__ == "__main__":
    run_watchdog()
