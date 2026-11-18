#!/usr/bin/env python3
"""
Sequential, safe executor for Tranche 1 on Cloudflare D1.
Executes the 12 modular sub-batches (2,000 records each, total 23,082) with pre- and post-validation.
Halts immediately on any failure or quota warning.
"""

import subprocess
import glob
import sys
import os

BATCH_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "d1_tourism_batches")

def run_cmd(cmd):
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return res.returncode, res.stdout, res.stderr

def main():
    parts = sorted(glob.glob(f"{BATCH_DIR}/tranche1_part_*.sql"))
    print("================================================================================")
    print("CLOUDFLARE D1 — EXECUTIE CONTROLATĂ TRANȘA 1 (23.082 UNITĂȚI TURISTICE)")
    print(f"Număr sub-loturi de executat: {len(parts)}")
    print("================================================================================")

    if len(parts) != 12:
        print(f"EROARE: Sunt așteptate 12 sub-loturi, dar s-au găsit {len(parts)}!")
        sys.exit(1)

    for idx, part_file in enumerate(parts, 1):
        filename = os.path.basename(part_file)
        print(f"\n[{idx}/12] Executare sub-lot: {filename}...")
        
        cmd = ["npx", "wrangler", "d1", "execute", "businessradar-db", "--remote", f"--file={part_file}", "--yes"]
        code, stdout, stderr = run_cmd(cmd)

        if code != 0:
            print(f"EROARE la executarea {filename}! Cod ieșire: {code}")
            print("STDOUT:", stdout[:500])
            print("STDERR:", stderr[:500])
            if "7500" in stdout or "7500" in stderr:
                print("ATENȚIE: Cod 7500 detectat (Write quota exceeded). Oprire imediată conform procedurii!")
            sys.exit(code)

        # Check for success indicators
        if "7500" in stdout or "7500" in stderr:
            print("OPRIRE DE URGENȚĂ: Cod 7500 detectat!")
            sys.exit(1)

        # Extract rows written or query count
        for line in stdout.splitlines():
            if "Executed" in line or "queries" in line or "Rows written" in line:
                print(f"  -> {line.strip()}")

        print(f"[{idx}/12] Sub-lot {filename} finalizat cu succes.")

    print("\n================================================================================")
    print("TOATE CELE 12 SUB-LOTURI DIN TRANȘA 1 AU FOST EXECUTATE CU SUCCES!")
    print("================================================================================")

if __name__ == "__main__":
    main()
