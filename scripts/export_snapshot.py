#!/usr/bin/env python3
"""
Exports tables from data/radar_business.db into src/lib/data-snapshot.json
Used to provide real data to Cloudflare Workers edge environment.
"""
import sqlite3
import json
import os
import sys

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(root, 'data', 'radar_business.db')
    out_path = os.path.join(root, 'src', 'lib', 'data-snapshot.json')

    if not os.path.exists(db_path):
        print(f"Error: {db_path} does not exist", file=sys.stderr)
        sys.exit(1)

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    tables = [
        'companies',
        'contact_records',
        'insurance_opportunities',
        'tax_records',
        'financial_records',
        'prospect_pipeline',
        'suppression_list',
        'ingestion_jobs',
        'audit_log',
        'company_secondary_caen'
    ]

    data = {}
    for t in tables:
        cur.execute(f"SELECT * FROM {t}")
        data[t] = [dict(r) for r in cur.fetchall()]

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

    size_mb = os.path.getsize(out_path) / 1024 / 1024
    print(f"Exported {len(data['companies'])} companies and {len(data['insurance_opportunities'])} opportunities to {out_path} ({size_mb:.2f} MB)")

if __name__ == '__main__':
    main()
