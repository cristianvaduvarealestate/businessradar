import zipfile
import xml.etree.ElementTree as ET
import json
import re
from collections import Counter

XLSM_PATH = 'data/lista_structuri_turistice_clasificate.xlsm'
OUT_JSON = 'data/tourism_audit_summary.json'

print(f"Auditing {XLSM_PATH}...")

with zipfile.ZipFile(XLSM_PATH) as z:
    # 1. Sheets in workbook
    wb_tree = ET.fromstring(z.read('xl/workbook.xml'))
    sheets = []
    for s in wb_tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheets/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet'):
        sheets.append(s.attrib.get('name'))
    print("Sheets in workbook:", sheets)

    # 2. Shared strings
    strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        print("Reading shared strings...")
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
            # Text can be in <t> or in multiple <r><t> runs
            t_elem = si.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
            if t_elem is not None and t_elem.text:
                strings.append(t_elem.text)
            else:
                runs = si.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}r/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
                if runs:
                    strings.append(''.join([r.text for r in runs if r.text]))
                else:
                    strings.append('')
    print(f"Loaded {len(strings)} shared strings.")

    # 3. Stream parse sheet1.xml
    print("Stream parsing sheet1.xml...")
    header_row = None
    headers = []
    total_xml_rows = 0
    data_rows_count = 0
    empty_rows_count = 0

    stats = {
        'total_xml_rows': 0,
        'data_rows_count': 0,
        'empty_rows_count': 0,
        'with_cui': 0,
        'cui_na_or_invalid': 0,
        'without_cui': 0,
        'with_email': 0,
        'with_web': 0,
        'with_email_or_web': 0,
        'with_both_email_and_web': 0,
        'without_contact': 0,
        'unique_operators': 0,
        'unique_cuis': 0,
        'unit_types': Counter(),
        'categories': Counter(),
        'counties': Counter(),
        'top_operators': Counter(),
    }

    all_operators = set()
    all_cuis = set()
    sample_records = []

    with z.open('xl/worksheets/sheet1.xml') as f:
        for event, elem in ET.iterparse(f, events=('end',)):
            if elem.tag.endswith('row'):
                total_xml_rows += 1
                row_idx = int(elem.attrib.get('r', total_xml_rows))
                
                # Extract cell values mapped by column letters (A, B, C...)
                row_cells = {}
                for c in elem.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                    r_ref = c.attrib.get('r', '')
                    col_letters = ''.join([ch for ch in r_ref if ch.isalpha()])
                    val = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                    t_attr = c.attrib.get('t')
                    cell_val = ''
                    if val is not None and val.text:
                        if t_attr == 's':
                            try:
                                cell_val = strings[int(val.text)]
                            except IndexError:
                                cell_val = ''
                        else:
                            cell_val = val.text
                    row_cells[col_letters] = cell_val.strip()

                if row_idx == 3:
                    # Header row
                    # Map standard columns A through P (16 columns)
                    cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P']
                    headers = [row_cells.get(col, '') for col in cols]
                    header_row = row_cells
                    print("Detected headers (A-P):", headers)
                elif row_idx > 3:
                    # Data row
                    # 1. Tip unitate: A
                    # 2. Nume unitate: B
                    # 3. Tip categorie: C
                    # 4. Numar spatii: D
                    # 5. Numar locuri: E
                    # 6. Alte detalii adresa: F
                    # 7. Tip localitate: G
                    # 8. Localitate componenta: H
                    # 9. Localitate: I
                    # 10. Judet: J
                    # 11. Email: K
                    # 12. Web: L
                    # 13. Tip Operator Economic: M
                    # 14. Operator Economic: N
                    # 15. Numar Inregistrare: O
                    # 16. Cod Unic Inregistrare (CUI): P

                    tip_unitate = row_cells.get('A', '')
                    nume_unitate = row_cells.get('B', '')
                    tip_categorie = row_cells.get('C', '')
                    numar_spatii = row_cells.get('D', '')
                    numar_locuri = row_cells.get('E', '')
                    alte_detalii_adresa = row_cells.get('F', '')
                    tip_localitate = row_cells.get('G', '')
                    localitate_componenta = row_cells.get('H', '')
                    localitate = row_cells.get('I', '')
                    judet = row_cells.get('J', '')
                    email = row_cells.get('K', '')
                    web = row_cells.get('L', '')
                    tip_operator = row_cells.get('M', '')
                    operator = row_cells.get('N', '')
                    nr_inreg = row_cells.get('O', '')
                    cui = row_cells.get('P', '')

                    # Check if row is completely empty
                    has_content = any([
                        tip_unitate, nume_unitate, tip_categorie, alte_detalii_adresa,
                        localitate, judet, email, web, operator, cui
                    ])

                    if not has_content:
                        empty_rows_count += 1
                    else:
                        data_rows_count += 1
                        
                        # CUI audit
                        clean_cui = cui.strip()
                        if clean_cui and clean_cui.upper() not in ('#N/A', '-', 'N/A', '0', ''):
                            stats['with_cui'] += 1
                            all_cuis.add(clean_cui)
                        elif clean_cui.upper() in ('#N/A', 'N/A'):
                            stats['cui_na_or_invalid'] += 1
                        else:
                            stats['without_cui'] += 1

                        # Contact audit
                        has_email = bool(email and email.strip() and email.strip() != '-' and '@' in email)
                        has_web = bool(web and web.strip() and web.strip() != '-' and len(web.strip()) > 3)

                        if has_email:
                            stats['with_email'] += 1
                        if has_web:
                            stats['with_web'] += 1
                        if has_email or has_web:
                            stats['with_email_or_web'] += 1
                        if has_email and has_web:
                            stats['with_both_email_and_web'] += 1
                        if not has_email and not has_web:
                            stats['without_contact'] += 1

                        if operator:
                            all_operators.add(operator)
                            stats['top_operators'][operator] += 1

                        if tip_unitate:
                            stats['unit_types'][tip_unitate] += 1
                        if tip_categorie:
                            stats['categories'][tip_categorie] += 1
                        if judet:
                            stats['counties'][judet] += 1

                        if len(sample_records) < 5:
                            sample_records.append({
                                'row_idx': row_idx,
                                'tip_unitate': tip_unitate,
                                'nume_unitate': nume_unitate,
                                'tip_categorie': tip_categorie,
                                'spatii': numar_spatii,
                                'locuri': numar_locuri,
                                'adresa': alte_detalii_adresa,
                                'localitate': localitate,
                                'judet': judet,
                                'email': email,
                                'web': web,
                                'operator': operator,
                                'cui': cui,
                            })

                elem.clear()

    stats['total_xml_rows'] = total_xml_rows
    stats['data_rows_count'] = data_rows_count
    stats['empty_rows_count'] = empty_rows_count
    stats['unique_operators'] = len(all_operators)
    stats['unique_cuis'] = len(all_cuis)
    stats['headers'] = headers
    stats['sheets'] = sheets
    stats['sample_records'] = sample_records
    stats['unit_types'] = dict(stats['unit_types'].most_common(25))
    stats['categories'] = dict(stats['categories'].most_common(20))
    stats['counties'] = dict(stats['counties'].most_common(50))
    stats['top_operators'] = dict(stats['top_operators'].most_common(20))

    with open(OUT_JSON, 'w', encoding='utf-8') as out:
        json.dump(stats, out, indent=2, ensure_ascii=False)

    print("=== AUDIT SUMMARY ===")
    print(f"Total XML Rows: {total_xml_rows}")
    print(f"Data Rows: {data_rows_count}")
    print(f"Empty Rows: {empty_rows_count}")
    print(f"With Valid CUI: {stats['with_cui']} (Unique CUIs: {stats['unique_cuis']})")
    print(f"CUI with #N/A or invalid: {stats['cui_na_or_invalid']}")
    print(f"Without CUI: {stats['without_cui']}")
    print(f"With Email: {stats['with_email']}")
    print(f"With Web: {stats['with_web']}")
    print(f"With Email OR Web: {stats['with_email_or_web']}")
    print(f"Without Direct Contact: {stats['without_contact']}")
    print(f"Unique Operators: {stats['unique_operators']}")
    print(f"Saved full audit JSON to {OUT_JSON}")
