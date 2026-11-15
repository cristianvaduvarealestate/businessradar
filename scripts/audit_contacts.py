import sqlite3
import json

db = sqlite3.connect('data/radar_business.db')
db.row_factory = sqlite3.Row

cursor = db.cursor()

total_companies = cursor.execute("SELECT count(*) FROM companies").fetchone()[0]
total_contacts = cursor.execute("SELECT count(*) FROM contact_records").fetchone()[0]

mobiles = cursor.execute("SELECT count(*) FROM contact_records WHERE contact_type = 'MOBILE'").fetchone()[0]
landlines = cursor.execute("SELECT count(*) FROM contact_records WHERE contact_type = 'LANDLINE'").fetchone()[0]
phones = cursor.execute("SELECT count(*) FROM contact_records WHERE contact_type = 'PHONE'").fetchone()[0]
emails = cursor.execute("SELECT count(*) FROM contact_records WHERE contact_type = 'EMAIL'").fetchone()[0]
websites_in_contacts = cursor.execute("SELECT count(*) FROM contact_records WHERE contact_type = 'WEBSITE'").fetchone()[0]

companies_with_website_field = cursor.execute("SELECT count(*) FROM companies WHERE website IS NOT NULL AND website != ''").fetchone()[0]

# Inspect existing 11 website records in companies table
website_records = cursor.execute("SELECT cui, name, website FROM companies WHERE website IS NOT NULL AND website != ''").fetchall()

print("==================================================")
print("           REALITY AUDIT BASELINE REPORT          ")
print("==================================================")
print(f"Total Companies in Database: {total_companies}")
print(f"Total Contact Records in Table: {total_contacts}")
print(f"  - Mobile Numbers: {mobiles}")
print(f"  - Landline Numbers: {landlines}")
print(f"  - Generic Phone Numbers: {phones}")
print(f"  - Email Addresses: {emails}")
print(f"  - Websites in contact_records: {websites_in_contacts}")
print(f"Companies with website field populated: {companies_with_website_field}")
print("--------------------------------------------------")
print("Inspection of the 11 companies.website records:")
for r in website_records:
    print(f"  CUI: {r['cui']} | Name: {r['name']} | Field: '{r['website']}'")
print("==================================================")

db.close()
