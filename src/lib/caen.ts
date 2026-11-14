export interface IndustryCategory {
  id: string;
  name: string;
  nameRo: string;
  icon: string;
  description: string;
  caenPrefixes: string[];
}

export const INDUSTRY_CATEGORIES: Record<string, IndustryCategory> = {
  HOSPITALITY: {
    id: 'HOSPITALITY',
    name: 'Hospitality & Food Service',
    nameRo: 'Ospitalitate & HORECA',
    icon: 'Hotel',
    description: 'Hoteluri, restaurante, cafenele, baruri, pensiuni și servicii de catering.',
    caenPrefixes: ['5510', '5520', '5530', '5590', '5610', '5621', '5629', '5630'],
  },
  TOURISM: {
    id: 'TOURISM',
    name: 'Tourism & Travel Services',
    nameRo: 'Turism & Agenții de Voiaj',
    icon: 'Compass',
    description: 'Agenții de turism, touroperatori și servicii de rezervare.',
    caenPrefixes: ['7911', '7912', '7990'],
  },
  RENTAL: {
    id: 'RENTAL',
    name: 'Rental & Leasing',
    nameRo: 'Închirieri & Leasing Echipamente',
    icon: 'Key',
    description: 'Închirierea de autoturisme, camioane, utilaje de construcții și echipamente.',
    caenPrefixes: ['7711', '7712', '7721', '7731', '7732', '7733', '7739'],
  },
  AIRBNB_STR: {
    id: 'AIRBNB_STR',
    name: 'Short-Term Rentals & Property Management',
    nameRo: 'Regim Hotelier & Administrare Proprietăți',
    icon: 'Home',
    description: 'Facilități de cazare pe termen scurt, administrarea apartamentelor în regim hotelier.',
    caenPrefixes: ['5520', '6832', '5590'],
  },
  REAL_ESTATE: {
    id: 'REAL_ESTATE',
    name: 'Real Estate & Development',
    nameRo: 'Dezvoltare Imobiliară & Tranzacții',
    icon: 'Building2',
    description: 'Dezvoltare imobiliară, agenții imobiliare, închirierea și subînchirierea bunurilor proprii.',
    caenPrefixes: ['4110', '6810', '6820', '6831', '6832'],
  },
  CONSTRUCTION: {
    id: 'CONSTRUCTION',
    name: 'Construction & Civil Engineering',
    nameRo: 'Construcții & Instalații Specializate',
    icon: 'Hammer',
    description: 'Construcția de clădiri rezidențiale/nerezidențiale, infrastructură rutieră, instalații electrice și sanitare.',
    caenPrefixes: [
      '4120', '4211', '4212', '4213', '4221', '4222', '4291', '4299',
      '4311', '4312', '4321', '4322', '4329', '4331', '4332', '4333', '4334', '4339', '4391', '4399'
    ],
  },
  IT_TECH: {
    id: 'IT_TECH',
    name: 'Information Technology & Software',
    nameRo: 'Tehnologia Informației & Servicii Digitale',
    icon: 'Cpu',
    description: 'Dezvoltare software, consultanță IT, managementul infrastructurii, portaluri web și telecomunicații.',
    caenPrefixes: ['6201', '6202', '6203', '6209', '6311', '6312', '5829', '6110', '6120', '6130', '6190'],
  },
  AUTOMOTIVE: {
    id: 'AUTOMOTIVE',
    name: 'Automotive & Repair',
    nameRo: 'Comerț Auto & Service Mecanică',
    icon: 'Car',
    description: 'Comerțul cu autovehicule, întreținerea și repararea autovehiculelor, piese și accesorii.',
    caenPrefixes: ['4511', '4519', '4520', '4531', '4532', '4540', '2910', '2920', '2931', '2932'],
  },
  TRANSPORT: {
    id: 'TRANSPORT',
    name: 'Transport, Logistics & Couriers',
    nameRo: 'Transport Rutier, Logistică & Curierat',
    icon: 'Truck',
    description: 'Transporturi rutiere de mărfuri, transport călători, depozitări, expedierea mărfurilor și activități de curierat.',
    caenPrefixes: ['4941', '4942', '4931', '4932', '4939', '5210', '5221', '5224', '5229', '5310', '5320'],
  },
  HEALTHCARE: {
    id: 'HEALTHCARE',
    name: 'Healthcare & Medical Services',
    nameRo: 'Sănătate & Servicii Medicale Private',
    icon: 'Activity',
    description: 'Clinici private, asistență medicală generală și specializată, stomatologie, laboratoare și veterinari.',
    caenPrefixes: ['8610', '8621', '8622', '8623', '8690', '7500'],
  },
  MANUFACTURING: {
    id: 'MANUFACTURING',
    name: 'Industrial Manufacturing',
    nameRo: 'Industrie Prelucrătoare & Producție',
    icon: 'Factory',
    description: 'Industrie alimentară, prelucrarea metalelor, mobilier, mase plastice, mașini și echipamente.',
    caenPrefixes: [
      '1011', '1012', '1013', '1020', '1031', '1032', '1039', '1041', '1051', '1052', '1071', '1072',
      '1310', '1413', '1520', '1610', '1623', '2221', '2229', '2511', '2512', '2562', '2599', '2811', '3101', '3102', '3109'
    ],
  },
  RETAIL_ECOM: {
    id: 'RETAIL_ECOM',
    name: 'Retail & E-Commerce',
    nameRo: 'Comerț cu Amănuntul & Magazine Online',
    icon: 'ShoppingBag',
    description: 'Comerț cu amănuntul nespecializat, magazine fizice, comerț prin internet (e-commerce), comerț cu ridicata.',
    caenPrefixes: ['4711', '4719', '4791', '4611', '4619', '4631', '4639', '4641', '4649', '4673', '4690'],
  },
  FIN_PROF: {
    id: 'FIN_PROF',
    name: 'Financial & Professional Services',
    nameRo: 'Servicii Financiare & Consultanță',
    icon: 'Briefcase',
    description: 'Contabilitate, audit, consultanță fiscală, asistență juridică, management și intermedieri financiare.',
    caenPrefixes: ['6419', '6492', '6499', '6511', '6512', '6612', '6622', '6910', '6920', '7022', '7111', '7112'],
  },
  EDUCATION: {
    id: 'EDUCATION',
    name: 'Education & Training',
    nameRo: 'Educație & Formare Profesională',
    icon: 'GraduationCap',
    description: 'Școli private, grădinițe, centre de limbi străine, cursuri de perfecționare și formare profesională.',
    caenPrefixes: ['8510', '8520', '8531', '8532', '8541', '8542', '8551', '8552', '8559', '8560'],
  },
  AGRICULTURE: {
    id: 'AGRICULTURE',
    name: 'Agriculture & Farming',
    nameRo: 'Agricultură, Silvicultură & Zootehnie',
    icon: 'Tractor',
    description: 'Cultivarea cerealelor, legumicultură, pomicultură, creșterea animalelor și servicii anexe agriculturii.',
    caenPrefixes: ['0111', '0113', '0121', '0124', '0141', '0142', '0146', '0147', '0150', '0161', '0210', '0311'],
  },
  ENERGY: {
    id: 'ENERGY',
    name: 'Energy & Renewables',
    nameRo: 'Energie & Surse Regenerabile',
    icon: 'Zap',
    description: 'Producția de energie electrică (solar/fotovoltaic, eolian, hidro), distribuția și comercializarea energiei.',
    caenPrefixes: ['3511', '3512', '3513', '3514', '3521', '3522', '3523'],
  },
  BEAUTY_WELL: {
    id: 'BEAUTY_WELL',
    name: 'Beauty & Wellness',
    nameRo: 'Frumusețe, Spa & Întreținere Corporală',
    icon: 'Sparkles',
    description: 'Saloane de coafură, cosmetică, activități ale centrelor de fitness, spa-uri și întreținere corporală.',
    caenPrefixes: ['9602', '9604', '9313'],
  },
  EVENTS_ENT: {
    id: 'EVENTS_ENT',
    name: 'Events & Entertainment',
    nameRo: 'Organizare Evenimente & Spectacole',
    icon: 'Music',
    description: 'Organizarea de târguri, congrese, evenimente private, producție cinematografică și spectacole.',
    caenPrefixes: ['9001', '9002', '9003', '9004', '9321', '9329', '7420', '8230'],
  },
  OTHER_SERV: {
    id: 'OTHER_SERV',
    name: 'Business Support & Facility Management',
    nameRo: 'Servicii Suport & Administrare Clădiri',
    icon: 'ShieldCheck',
    description: 'Curățenie generală, protecție și gardă, servicii de peisagistică, plasarea forței de muncă și publicitate.',
    caenPrefixes: ['8110', '8121', '8122', '8129', '8010', '8020', '7810', '7820', '7830', '7311', '7312'],
  },
};

export function getCategoriesForCaen(caenCode: string): string[] {
  if (!caenCode) return [];
  const normalized = caenCode.trim().padStart(4, '0');
  const matchedCategories: string[] = [];

  for (const [catId, cat] of Object.entries(INDUSTRY_CATEGORIES)) {
    if (cat.caenPrefixes.some(prefix => normalized.startsWith(prefix))) {
      matchedCategories.push(catId);
    }
  }

  return matchedCategories;
}
