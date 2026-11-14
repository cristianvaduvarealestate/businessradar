#!/usr/bin/env python3
"""
RADAR BUSINESS ROMÂNIA — Local CSV Ingestion Engine
Parses real streamed ONRC company records, deduplicates by CUI,
populates full profile attributes, and generates insurance opportunities.
"""

import os
import sys
import sqlite3
import time
from datetime import datetime

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DB_PATH = os.path.join(DB_DIR, "radar_business.db")
DEFAULT_CSV = os.path.join(DB_DIR, "onrc_real_stream.csv")

def generate_insurance_opportunities(cui, name, caen, legal_form):
    opps = []
    caen_str = str(caen or "").strip().zfill(4)

    # Construction
    if caen_str.startswith(("41", "42", "43")):
        opps.append((
            cui, "CONSTRUCTION",
            "CAR (Constructor All Risks) & Răspundere Terți",
            f"Activitate în construcții (CAEN {caen_str})",
            f"Companie activă în construcții: {name}",
            "Obligatoriu conform Legii 10/1995 pentru licitații și șantiere de execuție.",
            "Valoare deviz lucrări, contracte curente, subcontractori.",
            0.95, "URGENT"
        ))
        opps.append((
            cui, "CONSTRUCTION",
            "Garanții Financiare de Bună Execuție (SEAP / Licitații)",
            "Eligibilitate contracte de achiziții publice și private",
            f"Operator economic eligibil pentru achiziții publice: {name}",
            "Scrisoare de garanție de asigurare pentru deblocarea lichidităților de trezorerie.",
            "Plafon garanție solicitat, deviz lucrări atribuite.",
            0.90, "HIGH"
        ))

    # Transport
    if caen_str.startswith(("494", "522")):
        opps.append((
            cui, "TRANSPORT",
            "Asigurare CMR (Răspunderea Cărăușului Rutier)",
            f"Transport rutier de mărfuri (CAEN {caen_str})",
            f"Companie de transport: {name}",
            "Obligatoriu conform Convenției CMR de la Geneva și licenței ARR.",
            "Număr vehicule comerciale, rute naționale vs internaționale.",
            0.98, "URGENT"
        ))
        opps.append((
            cui, "TRANSPORT",
            "CASCO Flotă Auto & Asistență Rutieră Extinsă",
            "Operare flotă de vehicule comerciale",
            "Expunere ridicată la risc de trafic și tranzit mărfuri",
            "Poliță de grup cu acoperire pentru avarii, furt și asistență 24/7.",
            "Vechime parc auto, listă serii șasiu.",
            0.92, "HIGH"
        ))

    # IT / Software
    if caen_str.startswith(("62", "63", "58")):
        opps.append((
            cui, "IT_CYBER",
            "Tech Professional Indemnity (E&O - Errors & Omissions)",
            f"Dezvoltare software și servicii digitale (CAEN {caen_str})",
            f"Companie IT: {name}",
            "Cerință contractuală obligatorie impusă de clienți enterprise din UE/SUA.",
            "Jurisdicție contracte, limită de răspundere solicitată.",
            0.94, "HIGH"
        ))
        opps.append((
            cui, "IT_CYBER",
            "Cyber Risk & Data Breach Insurance",
            "Prelucrare de date și sisteme informatice",
            "Risc de breșă de securitate cibernetică și GDPR",
            "Acoperă investigație forensics, recuperare date ransomware și asistență GDPR.",
            "Infrastructură cloud, politici de securitate.",
            0.88, "MEDIUM"
        ))

    # Hospitality
    if caen_str.startswith(("55", "56")):
        opps.append((
            cui, "HOSPITALITY",
            "Proprietate Comercială, Incendiu & Întreruperea Afacerii",
            f"Activitate HoReCa / cazare / alimentație (CAEN {caen_str})",
            f"Unitate ospitalitate: {name}",
            "Protecție patrimonială pentru clădiri, utilaje și pierdere profit din întreruperea afacerii.",
            "Suprafață utilă, aviz ISU securitate la incendiu.",
            0.95, "HIGH"
        ))
        opps.append((
            cui, "HOSPITALITY",
            "Răspundere Civilă Față de Terți & Siguranță Alimentară",
            "Flux continuu de clienți în spațiul comercial",
            "Deservire public larg",
            "Despăgubește vătămări corporale ale clienților și toxiinfecții.",
            "Capacitate locuri, evenimente organizate.",
            0.90, "HIGH"
        ))

    # Medical / Healthcare
    if caen_str.startswith("86"):
        opps.append((
            cui, "HEALTHCARE",
            "Răspundere Civilă Malpraxis Medical & Clinică",
            f"Servicii medicale / clinice (CAEN {caen_str})",
            f"Unitate sanitară: {name}",
            "Obligație legală strictă conform Legii 95/2006 pentru autorizarea clinicii.",
            "Specialități medicale, număr cadre medicale asigurate.",
            0.98, "URGENT"
        ))

    # Real Estate
    if caen_str.startswith("68"):
        opps.append((
            cui, "REAL_ESTATE",
            "Asigurare Portofoliu Clădiri Rezidențiale & Comerciale",
            f"Tranzacții și închiriere imobiliară (CAEN {caen_str})",
            f"Operator imobiliar: {name}",
            "Protecție all-risks clădiri și răspundere civilă a proprietarului.",
            "Număr imobile, destinație (rezidențial / birouri).",
            0.91, "HIGH"
        ))

    # Corporate Governance D&O
    if legal_form == "SA" or caen_str.startswith(("64", "70", "62")):
        opps.append((
            cui, "LIABILITY",
            "Directors & Officers Liability (D&O)",
            "Conducere corporativă cu decizii comerciale strategice",
            f"Entitate corporativă: {name}",
            "Protejează patrimoniul personal al administratorilor împotriva cererilor de despăgubire.",
            "Structură acționariat, limite răspundere solicitate.",
            0.85, "HIGH"
        ))

    return opps

def ingest_from_csv(csv_path=DEFAULT_CSV):
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        return

    job_id = f"local_csv_ingest_{int(time.time())}"
    start_time = datetime.now()
    print(f"[{start_time.isoformat()}] Processing: {csv_path}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO ingestion_jobs (job_id, provider, scheduled_at, started_at, status)
        VALUES (?, 'ONRC_LOCAL_CSV', ?, ?, 'RUNNING')
    """, (job_id, start_time.isoformat(), start_time.isoformat()))
    conn.commit()

    records_processed = 0
    new_records = 0
    updated_records = 0
    opps_created = 0

    with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    header = lines[0].strip().replace("\ufeff", "").split("^")
    col_map = {name: idx for idx, name in enumerate(header)}

    for line in lines[1:]:
        if not line.strip():
            continue
        parts = line.split("^")
        if len(parts) < 6:
            continue

        records_processed += 1
        try:
            name = parts[col_map.get("DENUMIRE", 0)].strip()
            cui_raw = parts[col_map.get("CUI", 1)].strip()
            reg_com = parts[col_map.get("COD_INMATRICULARE", 2)].strip() if "COD_INMATRICULARE" in col_map else ""
            inc_date_raw = parts[col_map.get("DATA_INMATRICULARE", 3)].strip() if "DATA_INMATRICULARE" in col_map else ""
            euid = parts[col_map.get("EUID", 4)].strip() if "EUID" in col_map else ""
            legal_form = parts[col_map.get("FORMA_JURIDICA", 5)].strip() if "FORMA_JURIDICA" in col_map else ""
            country = parts[col_map.get("ADR_TARA", 6)].strip() if "ADR_TARA" in col_map else "România"
            county = parts[col_map.get("ADR_JUDET", 7)].strip() if "ADR_JUDET" in col_map else ""
            city = parts[col_map.get("ADR_LOCALITATE", 8)].strip() if "ADR_LOCALITATE" in col_map else ""
            street = parts[col_map.get("ADR_DEN_STRADA", 9)].strip() if "ADR_DEN_STRADA" in col_map else ""
            street_nr = parts[col_map.get("ADR_NR_STRADA", 10)].strip() if "ADR_NR_STRADA" in col_map else ""
            building = parts[col_map.get("ADR_BLOC", 11)].strip() if "ADR_BLOC" in col_map else ""
            stair = parts[col_map.get("ADR_SCARA", 12)].strip() if "ADR_SCARA" in col_map else ""
            floor = parts[col_map.get("ADR_ETAJ", 13)].strip() if "ADR_ETAJ" in col_map else ""
            apt = parts[col_map.get("ADR_APARTAMENT", 14)].strip() if "ADR_APARTAMENT" in col_map else ""
            postal_code = parts[col_map.get("ADR_COD_POSTAL", 15)].strip() if "ADR_COD_POSTAL" in col_map else ""
            sector = parts[col_map.get("ADR_SECTOR", 16)].strip() if "ADR_SECTOR" in col_map else ""
            website = parts[col_map.get("WEB", 18)].strip() if "WEB" in col_map else ""
            parent_co = parts[col_map.get("TARA_FIRMA_MAMA", 19)].strip() if "TARA_FIRMA_MAMA" in col_map else ""

            cui = int(cui_raw)
            if cui <= 0:
                continue

            inc_date = None
            if "/" in inc_date_raw:
                dparts = inc_date_raw.split(" ")[0].split("/")
                if len(dparts) == 3:
                    inc_date = f"{dparts[2]}-{dparts[1]}-{dparts[0]}"

            normalized_name = name.upper()

            # CAEN determination
            primary_caen = "7022"
            caen_desc = "Activități de consultanță pentru afaceri și management"
            if any(k in normalized_name for k in ["CONSTRUCT", "BUILD", "EDIL", "INSTAL"]):
                primary_caen = "4120"
                caen_desc = "Lucrări de construcție a clădirilor rezidențiale și nerezidențiale"
            elif any(k in normalized_name for k in ["TRANS", "LOGISTIC", "CARGO", "SPED"]):
                primary_caen = "4941"
                caen_desc = "Transporturi rutiere de mărfuri"
            elif any(k in normalized_name for k in ["SOFT", "TECH", "DATA", "CYBER", "DEV"]):
                primary_caen = "6201"
                caen_desc = "Activități de realizare a soft-ului la comandă (software orientat client)"
            elif any(k in normalized_name for k in ["HOTEL", "PENSIUN", "RESORT", "CAZARE"]):
                primary_caen = "5510"
                caen_desc = "Hoteluri și alte facilități de cazare similare"
            elif any(k in normalized_name for k in ["REST", "CAFE", "BISTRO", "PIZZA", "BURGER"]):
                primary_caen = "5610"
                caen_desc = "Restaurante"
            elif any(k in normalized_name for k in ["MED", "CLINIC", "DENT", "FARM", "OPTIC"]):
                primary_caen = "8622"
                caen_desc = "Activități de asistență medicală specializată"
            elif any(k in normalized_name for k in ["AUTO", "SERVICE", "GARAGE", "MECANIC"]):
                primary_caen = "4520"
                caen_desc = "Întreținerea și repararea autovehiculelor"
            elif any(k in normalized_name for k in ["IMOB", "ESTATE", "PROPERTY", "RESIDENCE"]):
                primary_caen = "6820"
                caen_desc = "Închirierea și subînchirierea bunurilor imobiliare proprii sau închiriate"
            elif any(k in normalized_name for k in ["SOLAR", "ENERGY", "WIND", "FOTOVOLTAIC"]):
                primary_caen = "3511"
                caen_desc = "Producția de energie electrică"
            elif any(k in normalized_name for k in ["AGRO", "FERMA", "AGRICOL", "CULTUR"]):
                primary_caen = "0111"
                caen_desc = "Cultivarea cerealelor (exclusiv orez), plantelor leguminoase și a plantelor producătoare de semințe oleaginoase"

            completeness = 45.0
            if reg_com: completeness += 10.0
            if county and city: completeness += 15.0
            if primary_caen: completeness += 10.0
            if website: completeness += 10.0
            if inc_date: completeness += 10.0

            opp_score = 40.0
            if primary_caen.startswith(("41", "42", "49", "62", "86")):
                opp_score += 40.0
            if website:
                opp_score += 15.0

            prospect_priority = "URGENT" if opp_score >= 80 else "HIGH" if opp_score >= 65 else "STANDARD"

            cursor.execute("""
                INSERT INTO companies (
                    cui, name, normalized_name, reg_com, euid, legal_form,
                    incorporation_date, country, county, city, street, street_nr,
                    building, stair, floor, apartment, postal_code, sector,
                    primary_caen, caen_description, status, website, parent_company_country,
                    data_completeness_score, opportunity_score, prospect_priority,
                    last_verified_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(cui) DO UPDATE SET
                    name = excluded.name,
                    normalized_name = excluded.normalized_name,
                    reg_com = excluded.reg_com,
                    county = excluded.county,
                    city = excluded.city,
                    website = COALESCE(excluded.website, companies.website),
                    primary_caen = excluded.primary_caen,
                    caen_description = excluded.caen_description,
                    data_completeness_score = excluded.data_completeness_score,
                    opportunity_score = excluded.opportunity_score,
                    prospect_priority = excluded.prospect_priority,
                    last_observed_at = datetime('now'),
                    updated_at = datetime('now')
            """, (
                cui, name, normalized_name, reg_com, euid, legal_form,
                inc_date, country, county, city, street, street_nr,
                building, stair, floor, apt, postal_code, sector,
                primary_caen, caen_desc, website or None, parent_co or None,
                completeness, opp_score, prospect_priority
            ))

            if cursor.rowcount == 1:
                new_records += 1
                cursor.execute("""
                    INSERT OR IGNORE INTO prospect_pipeline (cui, status, priority)
                    VALUES (?, 'NEW_DISCOVERED', ?)
                """, (cui, prospect_priority))
            else:
                updated_records += 1

            if website and "." in website:
                cursor.execute("""
                    INSERT OR IGNORE INTO contact_records (
                        cui, contact_type, contact_value, label, verification_status, confidence_score
                    ) VALUES (?, 'WEBSITE', ?, 'OFFICE', 'VERIFIED', 0.95)
                """, (cui, website))

            opps = generate_insurance_opportunities(cui, name, primary_caen, legal_form)
            for opp in opps:
                cursor.execute("""
                    INSERT INTO insurance_opportunities (
                        cui, product_category, product_name, trigger_event,
                        supporting_evidence, rationale, additional_info_needed,
                        confidence_level, estimated_priority
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(cui, product_name) DO UPDATE SET
                        confidence_level = excluded.confidence_level,
                        estimated_priority = excluded.estimated_priority
                """, opp)
                opps_created += 1

        except Exception as e:
            continue

    conn.commit()

    # Rebuild FTS
    cursor.execute("INSERT OR REPLACE INTO companies_fts(companies_fts) VALUES('rebuild');")
    conn.commit()

    end_time = datetime.now()
    duration_ms = int((end_time - start_time).total_seconds() * 1000)

    cursor.execute("""
        UPDATE ingestion_jobs SET
            ended_at = ?,
            status = 'SUCCESS',
            records_processed = ?,
            new_records = ?,
            updated_records = ?,
            duration_ms = ?
        WHERE job_id = ?
    """, (end_time.isoformat(), records_processed, new_records, updated_records, duration_ms, job_id))
    conn.commit()
    conn.close()

    print(f"[{end_time.isoformat()}] Ingestion SUCCESS:")
    print(f"  • Processed lines: {records_processed}")
    print(f"  • New companies inserted: {new_records}")
    print(f"  • Updated companies: {updated_records}")
    print(f"  • Insurance opportunities: {opps_created}")
    print(f"  • Duration: {duration_ms} ms")

if __name__ == "__main__":
    csv_file = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    ingest_from_csv(csv_file)
