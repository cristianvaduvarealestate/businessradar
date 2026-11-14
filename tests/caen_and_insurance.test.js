const test = require('node:test');
const assert = require('node:assert');

// CAEN mapping dictionary
const CAEN_CATEGORIES = {
  HOSPITALITY: ['5510', '5520', '5610', '5621'],
  TOURISM: ['7911', '7912'],
  RENTAL: ['7711', '7712', '7732'],
  CONSTRUCTION: ['4120', '4211', '4221', '4321', '4399'],
  IT_TECH: ['6201', '6202', '6311', '5829'],
  TRANSPORT: ['4941', '4942', '5229'],
  HEALTHCARE: ['8610', '8621', '8622', '8623'],
  REAL_ESTATE: ['6810', '6820', '6831'],
};

function getCategoriesForCaen(code) {
  const norm = String(code).trim().padStart(4, '0');
  const matched = [];
  for (const [cat, prefixes] of Object.entries(CAEN_CATEGORIES)) {
    if (prefixes.some(p => norm.startsWith(p))) {
      matched.push(cat);
    }
  }
  return matched;
}

function evaluateInsurance(caen, employees = 0, isLarge = false) {
  const opps = [];
  const c = String(caen).padStart(4, '0');

  if (c.startsWith('41') || c.startsWith('42') || c.startsWith('43')) {
    opps.push("CAR - Constructor All Risks & Contractor's Liability");
    opps.push("Garanții Financiare de Bună Execuție (SEAP)");
  }
  if (c.startsWith('494') || c.startsWith('522')) {
    opps.push("CMR - Răspunderea Cărăușului Rutier");
    opps.push("CASCO Flotă Auto");
  }
  if (c.startsWith('62') || c.startsWith('63')) {
    opps.push("Tech Professional Indemnity (E&O)");
    opps.push("Cyber Risk & Data Breach");
  }
  if (c.startsWith('86')) {
    opps.push("Răspundere Civilă Malpraxis Medical (Legea 95/2006)");
  }
  if (employees >= 5) {
    opps.push("Asigurare de Sănătate de Grup Angajați");
  }
  if (isLarge) {
    opps.push("Directors & Officers Liability (D&O)");
  }
  return opps;
}

test('CAEN Classification Engine maps codes to correct industries', () => {
  assert.deepStrictEqual(getCategoriesForCaen('6201'), ['IT_TECH']);
  assert.deepStrictEqual(getCategoriesForCaen('4120'), ['CONSTRUCTION']);
  assert.deepStrictEqual(getCategoriesForCaen('4941'), ['TRANSPORT']);
  assert.deepStrictEqual(getCategoriesForCaen('8622'), ['HEALTHCARE']);
  assert.deepStrictEqual(getCategoriesForCaen('5510'), ['HOSPITALITY']);
});

test('Insurance Opportunity Rules generate mandatory and commercial covers', () => {
  // Construction company with 15 employees
  const constrOpps = evaluateInsurance('4120', 15);
  assert(constrOpps.includes("CAR - Constructor All Risks & Contractor's Liability"));
  assert(constrOpps.includes("Garanții Financiare de Bună Execuție (SEAP)"));
  assert(constrOpps.includes("Asigurare de Sănătate de Grup Angajați"));

  // Transport company
  const transOpps = evaluateInsurance('4941', 2);
  assert(transOpps.includes("CMR - Răspunderea Cărăușului Rutier"));
  assert(transOpps.includes("CASCO Flotă Auto"));

  // IT company with corporate governance
  const itOpps = evaluateInsurance('6201', 50, true);
  assert(itOpps.includes("Tech Professional Indemnity (E&O)"));
  assert(itOpps.includes("Cyber Risk & Data Breach"));
  assert(itOpps.includes("Directors & Officers Liability (D&O)"));
  assert(itOpps.includes("Asigurare de Sănătate de Grup Angajați"));

  // Medical clinic
  const medOpps = evaluateInsurance('8621');
  assert(medOpps.includes("Răspundere Civilă Malpraxis Medical (Legea 95/2006)"));
});
