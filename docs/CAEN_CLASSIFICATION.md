# CAEN CLASSIFICATION & INDUSTRY MAPPING SPECIFICATION
## RADAR BUSINESS ROMÂNIA — CAEN Rev. 2 / Rev. 3 Taxonomy Engine

### 1. Overview
Romanian companies report business activities using the CAEN classification (Clasificarea Activităților din Economia Națională), aligned with the European NACE standard.

Radar Business România implements a multi-category classification engine where a single company can belong to multiple high-level strategic sectors depending on its primary and authorized secondary CAEN codes.

---

### 2. Category Taxonomy & CAEN Mapping Matrix

| Category ID | Sector Name | Primary CAEN Codes (Rev. 2) | Target Insurance Opportunities |
| :--- | :--- | :--- | :--- |
| **HOSPITALITY** | Hospitality (HORECA) | 5510, 5520, 5530, 5590, 5610, 5621, 5629, 5630 | Property Fire & Disaster, Public Liability, Business Interruption, Food Contamination |
| **TOURISM** | Tourism & Travel Agencies | 7911, 7912, 7990 | Travel Agency Insolvency Bond, Professional Indemnity, Tour Operator Liability |
| **RENTAL** | Vehicle & Equipment Rental | 7711, 7712, 7721, 7731, 7732, 7733, 7739 | Equipment Breakdown, Fleet CASCO / RCA, Inland Transit |
| **AIRBNB_STR** | Short-Term Rentals & Property Mgmt | 5520, 6832, 5590, 6820 | Property All-Risks, Host Liability, Loss of Rental Income |
| **REAL_ESTATE** | Real Estate Developers & Agencies | 4110, 6810, 6820, 6831, 6832 | Latent Defect (Decenal), E&O Broker Liability, Property All-Risks |
| **CONSTRUCTION** | General & Specialized Contractors | 4120, 4211, 4212, 4213, 4221, 4222, 4291, 4299, 4311, 4312, 4321, 4322, 4329, 4331, 4332, 4333, 4334, 4339, 4391, 4399 | CAR / EAR (Constructor All Risks), Performance Bond, Worker Accident, Third-Party Liability |
| **IT_TECH** | Software, Cloud, SaaS, Cybersecurity | 6201, 6202, 6203, 6209, 6311, 6312, 5829, 6110, 6120, 6130, 6190 | Tech E&O (Errors & Omissions), Cyber Risk, D&O Liability |
| **AUTOMOTIVE** | Auto Dealers, Repair & Servicing | 4511, 4519, 4520, 4531, 4532, 4540, 2910, 2920, 2931, 2932 | Garage Keepers Liability, Motor Trade Fleet, Property & Equipment |
| **TRANSPORT** | Freight, Passenger, Warehousing, Courier | 4941, 4942, 4931, 4932, 4939, 5210, 5221, 5224, 5229, 5310, 5320 | CMR Carrier Liability, Goods in Transit (Cargo), Fleet CASCO/RCA, Warehouse Legal Liability |
| **HEALTHCARE** | Clinics, Dental, Labs, Diagnostics | 8610, 8621, 8622, 8623, 8690, 7500 | Medical Malpractice, Professional Indemnity, Medical Equipment Breakdown, Cyber Healthcare |
| **MANUFACTURING**| Industrial Production, Metal, Food, Wood | 1011-3320 (Divisions 10 through 33) | Industrial Property & Fire, Machinery Breakdown, Product Liability, Environmental Impairment |
| **RETAIL_ECOM** | Retail Stores, Online Shops, Wholesale | 4711, 4719, 4791, 4611-4690 | Stock & Goods in Transit, Product Liability, Commercial Property, Cyber e-Commerce |
| **FIN_PROF** | Accounting, Legal, Consulting, Brokerage | 6419, 6499, 6511, 6512, 6612, 6622, 6910, 6920, 7022, 7111, 7112 | Professional Indemnity (E&O), Directors & Officers (D&O), Cyber |
| **EDUCATION** | Private Schools, Academies, Training | 8510, 8520, 8531, 8532, 8541, 8542, 8551, 8552, 8559, 8560 | Public Liability, Student Accident & Health, Property |
| **AGRICULTURE** | Crop Cultivation, Livestock, Greenhouses | 0111-0164, 0210, 0311, 0322 | Crop Insurance (Hail, Frost, Drought), Farm Machinery, Livestock Mortality |
| **ENERGY** | Renewables, Photovoltaic, Grid, Utilities| 3511, 3512, 3513, 3514, 3521, 3522, 3523, 4321, 4222 | Solar Park All-Risks, Business Interruption, Environmental Liability |
| **BEAUTY_WELL** | Salons, Spas, Aesthetic Clinics, Gyms | 9602, 9604, 9313 | Treatment Liability, Public Liability, Premises Property |
| **EVENTS_ENT** | Event Planners, Concerts, Audiovisual | 9001, 9002, 9003, 9004, 9321, 9329, 7420, 8230 | Event Cancellation, Venue Public Liability, Audiovisual Equipment |
| **OTHER_SERV** | Facility Mgmt, Security, Cleaning, HR | 8110, 8121, 8122, 8129, 8010, 8020, 7810, 7820, 7830, 7311, 7312 | Guard Service Liability, Janitorial Liability, Employer Liability |
| **SEGMENTATION**| Micro, SME, Large Corporate, Tenderers | Derived by metrics (Turnover, Headcount, Age) | Key Person, Group Health/Life, Performance Guarantees |

---

### 3. Business Size Segmentation Logic

Conforms to EU Recommendation 2003/361/EC and Romanian Law 346/2004:
- **Microenterprise**: < 10 employees AND Turnover ≤ €2 Million (approx. 10,000,000 RON).
- **Small Enterprise**: 10 to 49 employees AND Turnover ≤ €10 Million (approx. 50,000,000 RON).
- **Medium Enterprise**: 50 to 249 employees AND Turnover ≤ €50 Million (approx. 250,000,000 RON).
- **Large Corporate**: ≥ 250 employees OR Turnover > €50 Million.
- **New Incorporation**: Incorporated within the last 180 days (or observed within 90 days of registration).
