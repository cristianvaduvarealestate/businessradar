#!/usr/bin/env python3
"""
Controlled, Step-by-Step Executor for Tranche 2 on Cloudflare D1.
Enforces all preflight checks, verifies write quota with a reversible probe,
checks counts after every single sub-lot, halts immediately on error 7500,
and verifies all final invariants (30,874 TOURISM_UNITS, 304 GENERAL, 25 NICHE, 10,251 COMPANIES).
"""

import subprocess
import glob
import json
import sys
import os

BATCH_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "d1_tourism_batches")

def run_cmd(cmd):
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return res.returncode, res.stdout, res.stderr

def run_d1_query(sql):
    cmd = ["npx", "wrangler", "d1", "execute", "businessradar-db", "--remote", f"--command={sql}", "--json"]
    code, stdout, stderr = run_cmd(cmd)
    if code != 0:
        return code, None, stdout + "\n" + stderr
    try:
        data = json.loads(stdout)
        return 0, data[0].get("results", []), None
    except Exception as e:
        return 1, None, f"JSON parse error: {str(e)}\nRaw: {stdout}"

def main():
    print("================================================================================")
    print("CLOUDFLARE D1 — EXECUTOR CONTROLAT TRANȘA 2 (UNITĂȚI TURISTICE)")
    print("================================================================================")

    # 1. VERIFICARE EFECTIVĂ DISPONIBILITATE COTE D1 (Reversible probe)
    print("\n[Pasul 1] Testare disponibilitate cotă scriere D1 printr-o operațiune reversibilă...")
    probe_sql = "CREATE TABLE IF NOT EXISTS _d1_quota_probe (id INTEGER PRIMARY KEY, ts TEXT); INSERT INTO _d1_quota_probe VALUES (1, datetime('now')); DROP TABLE IF EXISTS _d1_quota_probe;"
    code, stdout, stderr = run_cmd(["npx", "wrangler", "d1", "execute", "businessradar-db", "--remote", f"--command={probe_sql}"])
    
    if code != 0 or "7500" in stdout or "7500" in stderr:
        print("\n✘ OPRIRE DE SIGURANȚĂ: Cota zilnică de scriere D1 NU este disponibilă!")
        print("Răspuns API Cloudflare:")
        if "7500" in stdout or "7500" in stderr:
            print("  -> Cod 7500 detectat (Write quota exceeded). Cota nu s-a resetat încă.")
        else:
            print("  STDOUT:", stdout[:300])
            print("  STDERR:", stderr[:300])
        print("Procedură: Așteptați resetarea la 00:00:00 UTC (02:00 ora locală) înainte de reluare.")
        sys.exit(7500)
    
    print("✔ Succes: Cota de scriere D1 este activă și disponibilă (proba reversibilă a reușit).")

    # 2. VERIFICARE STARE REMOTE ÎNAINTE DE IMPORT (Exact 23.082 TOURISM_UNITS)
    print("\n[Pasul 2] Verificare număr curent înregistrări remote...")
    code, results, err = run_d1_query("SELECT portfolio_type, count(*) as count FROM prospect_records GROUP BY portfolio_type;")
    if code != 0 or not results:
        print(f"✘ EROARE la citire prospect_records remote: {err}")
        sys.exit(1)

    counts = {r["portfolio_type"]: r["count"] for r in results}
    current_tourism = counts.get("TOURISM_UNITS", 0)
    current_general = counts.get("GENERAL", 0)
    current_niche = counts.get("NICHE_HORECA_AUTO_CONSTRUCT", 0)

    print(f"  - TOURISM_UNITS               : {current_tourism:,} (Așteptat: 23,082)")
    print(f"  - GENERAL                     : {current_general:,} (Așteptat: 304)")
    print(f"  - NICHE_HORECA_AUTO_CONSTRUCT : {current_niche:,} (Așteptat: 25)")

    if current_tourism != 23082:
        print(f"✘ OPRIRE: Numărul de unități turistice ({current_tourism}) diferă de 23,082!")
        sys.exit(1)

    if current_general != 304 or current_niche != 25:
        print("✘ OPRIRE: Portofoliile existente au fost modificate!")
        sys.exit(1)

    print("✔ Baza remote este validată și pregătită pentru Tranșa 2.")

    # 3. EXECUTARE SUB-LOTURI TRANȘA 2 (4 fișiere: 2000, 2000, 2000, 1792)
    t2_batches = [
        ("tranche2_part_01.sql", 2000, 25082),
        ("tranche2_part_02.sql", 2000, 27082),
        ("tranche2_part_03.sql", 2000, 29082),
        ("tranche2_part_04.sql", 1792, 30874),
    ]

    print("\n[Pasul 3] Executare sub-loturi Tranșa 2 cu verificare după fiecare lot...")

    for idx, (filename, expected_insert, expected_cumulative) in enumerate(t2_batches, 1):
        filepath = os.path.join(BATCH_DIR, filename)
        if not os.path.exists(filepath):
            print(f"✘ EROARE: Fișierul {filepath} lipsește!")
            sys.exit(1)

        print(f"\n--- Sub-lot {idx}/4: {filename} ({expected_insert:,} înregistrări) ---")
        code, stdout, stderr = run_cmd(["npx", "wrangler", "d1", "execute", "businessradar-db", "--remote", f"--file={filepath}", "--yes"])

        if code != 0 or "7500" in stdout or "7500" in stderr:
            print(f"✘ EROARE la sub-lotul {filename}!")
            if "7500" in stdout or "7500" in stderr:
                print("  -> Cod 7500 detectat (Write quota exceeded). OPRIRE IMEDIATĂ.")
            else:
                print("STDOUT:", stdout[:400])
                print("STDERR:", stderr[:400])
            sys.exit(1)

        # Verificare imediată remote după acest sub-lot
        code, results, err = run_d1_query("SELECT count(*) as count FROM prospect_records WHERE portfolio_type = 'TOURISM_UNITS';")
        if code != 0 or not results:
            print(f"✘ EROARE la interogare verificare intermediară: {err}")
            sys.exit(1)

        new_count = results[0]["count"]
        print(f"  ✔ Verificare remote după {filename}: TOURISM_UNITS = {new_count:,} (Așteptat: {expected_cumulative:,})")

        if new_count != expected_cumulative:
            print(f"✘ NEPOTRIVIRE: Numărul ({new_count}) diferă de valoarea așteptată ({expected_cumulative})! OPRIRE.")
            sys.exit(1)

    # 4. RECONCILIERE FINALĂ ȘI VERIFICAREA INVARIANȚILOR
    print("\n================================================================================")
    print("RECONCILIERE FINALĂ REMOTE D1")
    print("================================================================================")

    code, results, err = run_d1_query("SELECT portfolio_type, count(*) as count FROM prospect_records GROUP BY portfolio_type;")
    final_counts = {r["portfolio_type"]: r["count"] for r in results}

    code, comp_results, _ = run_d1_query("SELECT count(*) as count FROM companies;")
    final_companies = comp_results[0]["count"] if comp_results else 0

    print(f"TOURISM_UNITS               : {final_counts.get('TOURISM_UNITS', 0):,} (Țintă: 30,874)")
    print(f"GENERAL                     : {final_counts.get('GENERAL', 0):,} (Țintă: 304)")
    print(f"NICHE_HORECA_AUTO_CONSTRUCT : {final_counts.get('NICHE_HORECA_AUTO_CONSTRUCT', 0):,} (Țintă: 25)")
    print(f"Total prospect_records      : {sum(final_counts.values()):,} (Țintă: 31,203)")
    print(f"Companii istorice           : {final_companies:,} (Țintă: 10,251)")

    if (final_counts.get('TOURISM_UNITS') == 30874 and
        final_counts.get('GENERAL') == 304 and
        final_counts.get('NICHE_HORECA_AUTO_CONSTRUCT') == 25 and
        final_companies == 10251):
        print("\n✔ SUCCES TOTAL: Toate cele 30.874 de unități turistice sunt sincronizate remote!")
        print("Toți invarianții au fost protejați cu succes.")
    else:
        print("\n✘ AVERTISMENT: Reconcilierea finală nu este 100% identică cu valorile țintă!")
        sys.exit(1)

if __name__ == "__main__":
    main()
