export interface InsuranceOpportunity {
  cui: number;
  productCategory: string;
  productName: string;
  triggerEvent: string;
  supportingEvidence: string;
  rationale: string;
  additionalInfoNeeded: string;
  confidenceLevel: number;
  estimatedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface CompanyEvaluationContext {
  cui: number;
  name: string;
  primaryCaen: string;
  caenDescription?: string;
  secondaryCaens?: string[];
  legalForm?: string;
  employeesAvg?: number;
  turnover?: number;
  hasWebsite?: boolean;
  isNewCompany?: boolean;
}

export function evaluateInsuranceOpportunities(ctx: CompanyEvaluationContext): InsuranceOpportunity[] {
  const opportunities: InsuranceOpportunity[] = [];
  const caen = ctx.primaryCaen ? ctx.primaryCaen.trim().padStart(4, '0') : '';
  const secondary = (ctx.secondaryCaens || []).map(c => c.trim().padStart(4, '0'));
  const allCaens = [caen, ...secondary].filter(Boolean);

  const hasCaen = (...prefixes: string[]) => allCaens.some(c => prefixes.some(p => c.startsWith(p)));

  // 1. CONSTRUCTION & CIVIL ENGINEERING
  if (hasCaen('4120', '4211', '4212', '4213', '4221', '4222', '4291', '4299', '4399')) {
    opportunities.push({
      cui: ctx.cui,
      productCategory: 'CONSTRUCTION',
      productName: "CAR (Constructor's All Risks) & Răspundere Civilă Față de Terți",
      triggerEvent: `Activitate autorizată în domeniul construcțiilor (CAEN ${caen})`,
      supportingEvidence: `Companie de construcții și inginerie civilă: ${ctx.name}`,
      rationale: 'Obligatoriu conform Legii 10/1995 privind calitatea în construcții pentru participarea la licitații și șantiere rezidențiale/comerciale. Acoperă daune la lucrare, furt de materiale și vătămarea terților.',
      additionalInfoNeeded: 'Valoarea șantierelor curente, tipul proiectelor (rezidențial/infrastructură), subcontractori utilizați.',
      confidenceLevel: 0.95,
      estimatedPriority: 'URGENT',
    });

    opportunities.push({
      cui: ctx.cui,
      productCategory: 'CONSTRUCTION',
      productName: 'Garanții Financiare de Bună Execuție și Participare la Licitații (SEAP)',
      triggerEvent: 'Capacitate tehnică de execuție lucrări publice și private',
      supportingEvidence: `Operator economic eligibil pentru achiziții publice: ${ctx.name}`,
      rationale: 'Scrisoare de garanție de asigurare care deblochează colateralele bancare și permite participarea la licitații publice fără blocarea lichidităților financiare în trezorerie.',
      additionalInfoNeeded: 'Plafonul de garanții solicitat, cifra de afaceri recentă, contractele atribuite.',
      confidenceLevel: 0.90,
      estimatedPriority: 'HIGH',
    });
  }

  // 2. TRANSPORT & LOGISTICS
  if (hasCaen('4941', '4942', '5229')) {
    opportunities.push({
      cui: ctx.cui,
      productCategory: 'TRANSPORT',
      productName: 'Asigurare CMR (Răspunderea Cărăușului Rutier Național & Internațional)',
      triggerEvent: `Transport rutier de mărfuri (CAEN ${caen})`,
      supportingEvidence: `Transportator autorizat: ${ctx.name}`,
      rationale: 'Obligatorie conform Convenției CMR de la Geneva (1956) pentru transportul internațional de marfă și reglementărilor ARR. Protejează contra avarierii sau furtului mărfii încredințate spre transport.',
      additionalInfoNeeded: 'Număr capete tractor / semiremorci, rute tranzitate (Europa Vest / Balcani / Național), mărfuri perisabile/periculoase (ADR).',
      confidenceLevel: 0.98,
      estimatedPriority: 'URGENT',
    });

    opportunities.push({
      cui: ctx.cui,
      productCategory: 'TRANSPORT',
      productName: 'CASCO Flotă Auto & Asistență Rutieră Extinsă',
      triggerEvent: 'Operare parc vehicule comerciale',
      supportingEvidence: `Activitate de transport/logistică cu expunere rutieră ridicată`,
      rationale: 'Asigurare de tip flotă cu clauze speciale de daună totală, furt, vandalism și despăgubire fără depreciere pentru camioane și vehicule comerciale.',
      additionalInfoNeeded: 'Listă de șasiuri, vechimea parcului auto, istoric daune (bonus-malus).',
      confidenceLevel: 0.92,
      estimatedPriority: 'HIGH',
    });
  }

  // 3. INFORMATION TECHNOLOGY & SOFTWARE
  if (hasCaen('6201', '6202', '6203', '6209', '6311', '5829')) {
    opportunities.push({
      cui: ctx.cui,
      productCategory: 'IT_CYBER',
      productName: 'Tech Professional Indemnity (E&O - Errors & Omissions)',
      triggerEvent: `Servicii de dezvoltare software și consultanță tehnologică (CAEN ${caen})`,
      supportingEvidence: `Companie de tehnologie: ${ctx.name}`,
      rationale: 'Cerință contractuală obligatorie impusă de clienți enterprise din SUA și Europa de Vest. Despăgubește pierderi financiare ale clienților cauzate de bug-uri software, erori de arhitectură sau nedeliverare la termen.',
      additionalInfoNeeded: 'Jurisdicția contractelor clienților (SUA/Canada vs. UE), valoarea medie a contractelor, limite de răspundere solicitate.',
      confidenceLevel: 0.94,
      estimatedPriority: 'HIGH',
    });

    opportunities.push({
      cui: ctx.cui,
      productCategory: 'IT_CYBER',
      productName: 'Cyber Risk & Data Breach Insurance',
      triggerEvent: 'Procesare de date, baze de date și infrastructură digitală',
      supportingEvidence: `Companie digitală cu risc de securitate cibernetică`,
      rationale: 'Acoperă costurile de investigație medico-legală (forensics), recuperare date după atacuri ransomware, amenzi GDPR și asistență juridică de criză.',
      additionalInfoNeeded: 'Politici de backup, standarde de conformitate (ISO 27001, SOC2), date personale stocate.',
      confidenceLevel: 0.88,
      estimatedPriority: 'MEDIUM',
    });
  }

  // 4. HOSPITALITY (HORECA)
  if (hasCaen('5510', '5520', '5610', '5621')) {
    opportunities.push({
      cui: ctx.cui,
      productCategory: 'HOSPITALITY',
      productName: 'Proprietate Comercială, Incendiu & Întreruperea Afacerii (Business Interruption)',
      triggerEvent: `Operare facilități hoteliere sau restaurant (CAEN ${caen})`,
      supportingEvidence: `Unitate HoReCa: ${ctx.name}`,
      rationale: 'Acoperire completă pentru clădiri, amenajări interioare, echipamente de bucătărie profesionale, pierderi cauzate de incendiu, inundație și compensarea profitului net nerealizat pe perioada reparațiilor.',
      additionalInfoNeeded: 'Suprafață utilă, capacitate clienți, autorizație securitate la incendiu (ISU), valoarea stocurilor.',
      confidenceLevel: 0.95,
      estimatedPriority: 'HIGH',
    });

    opportunities.push({
      cui: ctx.cui,
      productCategory: 'HOSPITALITY',
      productName: 'Răspundere Civilă Față de Terți & Siguranță Alimentară',
      triggerEvent: 'Flux public de clienți în spațiul comercial',
      supportingEvidence: `Activitate cu deservire directă a publicului larg`,
      rationale: 'Despăgubește vătămările corporale ale clienților pe teritoriul unității (alunecări, accidente) și incidente cauzate de toxiinfecții alimentare.',
      additionalInfoNeeded: 'Flux mediu de clienți zilnic, evenimente organizate, protocoale HACCP.',
      confidenceLevel: 0.90,
      estimatedPriority: 'HIGH',
    });
  }

  // 5. HEALTHCARE & MEDICAL
  if (hasCaen('8610', '8621', '8622', '8623', '8690')) {
    opportunities.push({
      cui: ctx.cui,
      productCategory: 'HEALTHCARE',
      productName: 'Răspundere Civilă Malpraxis Medical & Clinică',
      triggerEvent: `Servicii medicale / clinice / stomatologice (CAEN ${caen})`,
      supportingEvidence: `Furnizor de servicii medicale: ${ctx.name}`,
      rationale: 'Obligație legală strictă conform Legii 95/2006 pentru autorizarea funcționării unității medicale și a personalului de specialitate (medici, asistenți).',
      additionalInfoNeeded: 'Număr medici angajați/colaboratori, specialități clinice (chirurgie, stomatologie, obstetrică etc.).',
      confidenceLevel: 0.98,
      estimatedPriority: 'URGENT',
    });

    opportunities.push({
      cui: ctx.cui,
      productCategory: 'HEALTHCARE',
      productName: 'Asigurare Echipamente Medicale Specializate (Avarii Accidentale)',
      triggerEvent: 'Utilizare aparatură medicală de diagnostic și tratament',
      supportingEvidence: `Dotare cu tehnologie medicală de înaltă precizie`,
      rationale: 'Protecție all-risks pentru aparate radiologice, ecografe, unituri stomatologice, lasere împotriva supratensiunii electrice, erorilor de operare și căderilor.',
      additionalInfoNeeded: 'Inventar echipamente, an fabricație, contracte de service autorizat.',
      confidenceLevel: 0.89,
      estimatedPriority: 'HIGH',
    });
  }

  // 6. REAL ESTATE & SHORT TERM RENTALS
  if (hasCaen('6810', '6820', '6831', '6832', '4110')) {
    opportunities.push({
      cui: ctx.cui,
      productCategory: 'REAL_ESTATE',
      productName: 'Asigurare Clădiri Rezidențiale / Comerciale & Răspundere Proprietar',
      triggerEvent: `Administrare sau închiriere portofoliu imobiliar (CAEN ${caen})`,
      supportingEvidence: `Operator imobiliar: ${ctx.name}`,
      rationale: 'Protecție structurală împotriva dezastrelor naturale (cutremur, inundații, alunecări de teren) și răspundere pentru daune produse chiriașilor sau spațiilor vecine.',
      additionalInfoNeeded: 'Număr imobile, an construcție, destinație (birouri, retail, apartamente).',
      confidenceLevel: 0.91,
      estimatedPriority: 'HIGH',
    });
  }

  // 7. EMPLOYEE BENEFITS (When Headcount >= 5)
  if (ctx.employeesAvg && ctx.employeesAvg >= 5) {
    opportunities.push({
      cui: ctx.cui,
      productCategory: 'EMPLOYEE_BENEFITS',
      productName: 'Asigurare de Sănătate de Grup & Accidente Angajați',
      triggerEvent: `Echipă consolidată cu ${ctx.employeesAvg} salariați raportați`,
      supportingEvidence: `Număr mediu de salariați confirmat din datele oficiale: ${ctx.employeesAvg}`,
      rationale: 'Beneficiu extra-salarial deductibil fiscal până la 400 EUR/angajat/an conform Codului Fiscal Art. 76(4). Asigură acces la rețele private de clinici și spitale.',
      additionalInfoNeeded: 'Distribuția pe vârste a personalului, pachet de servicii dorit (ambulatoriu vs. spitalizare/chirurgie).',
      confidenceLevel: 0.92,
      estimatedPriority: ctx.employeesAvg >= 20 ? 'HIGH' : 'MEDIUM',
    });
  }

  // 8. DIRECTORS & OFFICERS (D&O)
  const isLargeOrCorporate = ctx.legalForm === 'SA' || (ctx.turnover && ctx.turnover > 5000000) || hasCaen('6201', '6419', '7022');
  if (isLargeOrCorporate) {
    opportunities.push({
      cui: ctx.cui,
      productCategory: 'LIABILITY',
      productName: 'Directors & Officers Liability (D&O - Răspunderea Administratorilor)',
      triggerEvent: 'Conducere corporativă cu expunere decizională comercială și financiară',
      supportingEvidence: `Entitate corporativă: ${ctx.name} (Formă: ${ctx.legalForm || 'SRL'})`,
      rationale: 'Protejează patrimoniul personal al administratorilor, directorilor generali și membrilor consiliului de administrație împotriva cererilor de despăgubire din partea acționarilor, organelor fiscale sau creditorilor.',
      additionalInfoNeeded: 'Structura acționariatului, litigii anterioare, limite de răspundere vizate (1M - 5M EUR).',
      confidenceLevel: 0.85,
      estimatedPriority: 'HIGH',
    });
  }

  // 9. NEW INCORPORATION PACK
  if (ctx.isNewCompany) {
    opportunities.push({
      cui: ctx.cui,
      productCategory: 'LIABILITY',
      productName: 'Pachet Start-Up: Răspundere Civilă Generală & Bunuri de Bază',
      triggerEvent: 'Firmă nou înființată pe piața din România',
      supportingEvidence: `Înmatriculare recentă în registrul comerțului: ${ctx.name}`,
      rationale: 'Pachet starter de asigurare la cost accesibil pentru protejarea sediului social, echipamentelor de birou și acoperirea răspunderii civile față de primii clienți.',
      additionalInfoNeeded: 'Locație sediu / punct de lucru, investiție inițială în echipamente.',
      confidenceLevel: 0.88,
      estimatedPriority: 'MEDIUM',
    });
  }

  return opportunities;
}
