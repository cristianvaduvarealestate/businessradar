/**
 * BUSINESS RADAR — Insurance Intelligence & Sales Call Assistant Engine
 * Provides structured industry-specific risk analysis, product recommendations,
 * concrete financial consequence examples, phone screening questions, and natural Romanian scripts.
 */

export interface IndustryRiskProfile {
  profileKey: string;
  industryName: string;
  relevantCaenPrefixes: string[];
  recommendedProducts: Array<{
    productName: string;
    productCategory: string;
    whyRelevant: string;
    unprotectedRisks: string[];
    illustrativeLossExample: string;
    underwritingCaveat: string;
  }>;
  screeningQuestions: string[];
  openingScript: string;
  recommendedNextAction: string;
}

export const MANDATORY_INSURANCE_DISCLAIMER =
  'Recomandare orientativă bazată pe activitatea declarată și informațiile disponibile. Necesitatea și acoperirea trebuie confirmate în discuția cu reprezentantul firmei.';

export const INDUSTRY_PROFILES: Record<string, IndustryRiskProfile> = {
  TRANSPORT: {
    profileKey: 'TRANSPORT',
    industryName: 'Transporturi Rutiere de Mărfuri & Logistică',
    relevantCaenPrefixes: ['4941', '4942', '5229', '4931', '4932', '4939', '5210', '5221', '5224', '5320'],
    recommendedProducts: [
      {
        productName: 'Asigurare CMR (Răspunderea Cărăușului Rutier Național & Internațional)',
        productCategory: 'TRANSPORT',
        whyRelevant: 'Protejează transportatorul împotriva pretențiilor clienților pentru pierderea, avarierea sau furtul mărfurilor încredințate spre transport, conform Convenției CMR de la Geneva și legislației ARR.',
        unprotectedRisks: [
          'Avarierea totală sau parțială a mărfii transportate în caz de accident rutier',
          'Furtul mărfurilor din semiremorcă în parcări pe rute internaționale',
          'Răsturnarea vehiculului și împrăștierea mărfii pe carosabil',
          'Penalități de întârziere la livrare stipulate în contractul de transport',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Un camion încărcat cu componente industriale implicat într-un accident pe autostradă în Germania poate genera o daună de marfă de peste 180.000 EUR. Fără o poliță CMR validă cu clauze de cabotaj și furt, transportatorul este direct răspunzător cu întregul său patrimoniu.',
        underwritingCaveat: 'Acoperirea depinde de limitele per eveniment declarate, tipul mărfurilor (generale vs. ADR/perisabile) și respectarea parcărilor securizate pe timp de noapte.',
      },
      {
        productName: 'CASCO Flotă Auto & Asistență Rutieră Extinsă',
        productCategory: 'TRANSPORT',
        whyRelevant: 'Asigură protecția capetelor tractor, semiremorcilor și autoutilitarelor împotriva daunelor accidentale, vandalismului, incendiilor și asistență pentru tractare grea în România și spațiul SEE.',
        unprotectedRisks: [
          'Costuri uriașe de reparație la ansamblul cap-tractor după coliziuni',
          'Costuri de tractare și repatriere din străinătate (pot depăși 5.000 EUR per eveniment)',
          'Pierderea veniturilor pe perioada imobilizării capului tractor în service',
          'Distrugerea anvelopelor și daune cauzate de carosabil deteriorat',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: O avarie la motor sau cabina unui cap tractor nou poate costa peste 120.000 RON. Fără CASCO flotă, firma trebuie să acopere reparația din fluxul de numerar curent sau să abandoneze contractul de transport.',
        underwritingCaveat: 'Clauzele bonus-malus se calculează pe baza istoricului de daunalitate al flotei din ultimii 3 ani.',
      },
      {
        productName: 'Asigurare Cargo (Pentru Proprietarii de Marfă)',
        productCategory: 'TRANSPORT',
        whyRelevant: 'Acoperire All-Risks din depozit la depozit pentru firmele care transportă bunuri proprii sau doresc acoperire superioară limitelor standard CMR (8.33 DST/kg).',
        unprotectedRisks: [
          'Pierderea valorii integrale a bunurilor de mare valoare cu greutate redusă (electronice, farmaceutice)',
          'Daune provocate de forță majoră excluse de regulă din răspunderea cărăușului',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Transportul unui palet de echipamente IT de 200 kg în valoare de 50.000 EUR este despăgubit sub CMR doar în limita a aprox. 2.000 EUR. Diferența de 48.000 EUR este suportată integral de proprietar dacă nu deține poliță Cargo.',
        underwritingCaveat: 'Necesită declararea prealabilă a valorii de factură a fiecărui transport expediat.',
      },
    ],
    screeningQuestions: [
      'Câte autovehicule comerciale sau camioane aveți în parcul auto în prezent?',
      'Efectuați transporturi interne pe teritoriul României sau preponderent curse internaționale/comunitare?',
      'Transportați marfă generală sau și mărfuri cu regim special (temperatură controlată, ADR, valori ridicate)?',
      'Aveți poliță CMR activă și când expiră contractele actuale de asigurare ale flotei?',
      'Cine este persoana responsabilă de gestionarea polițelor și a dosarelor de daune în companie?',
    ],
    openingScript:
      'Bună ziua! Vă contactez în legătură cu activitatea de transport a companiei dumneavoastră. Lucrăm cu transportatori rutieri pentru optimizarea condițiilor de acoperire CMR și a costurilor CASCO pentru flote comerciale. Aș dori să vă adresez două-trei întrebări scurte pentru a verifica dacă există clauze importante care merită revizuite în programul dumneavoastră actual. Cine se ocupă la dumneavoastră de polițele flotei?',
    recommendedNextAction:
      'Solicitare listă parc auto (număr capete tractor/semiremorci, mărci, ani fabricație) și rute uzuale pentru ofertare comparativă CMR + CASCO.',
  },

  CONSTRUCTION: {
    profileKey: 'CONSTRUCTION',
    industryName: 'Construcții Civile, Industriale & Lucrări Speciale',
    relevantCaenPrefixes: [
      '4120', '4211', '4212', '4213', '4221', '4222', '4291', '4299',
      '4311', '4312', '4321', '4322', '4329', '4331', '4332', '4333', '4334', '4339', '4391', '4399',
    ],
    recommendedProducts: [
      {
        productName: 'CAR / EAR (Contractor\'s All Risks - Toate Riscurile Constructorului)',
        productCategory: 'CONSTRUCTION',
        whyRelevant: 'Protejează lucrările contractate pe durata execuției și a perioadei de garanție conform Legii 10/1995. Cerință obligatorie în majoritatea contractelor de antrepriză generală și achiziții publice.',
        unprotectedRisks: [
          'Prăbușiri de cofraje, grinzi sau elemente structurale în timpul turnării',
          'Incendii, furtuni sau inundații care distrug lucrările parțial finalizate pe șantier',
          'Furtul materialelor puse în operă sau depozitate pe șantier',
          'Daune provocate clădirilor sau terenurilor învecinate prin tasare sau trepidații',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: O furtună violentă care provoacă inundarea subsolurilor tehnice și degradarea instalațiilor electrice proaspăt montate la un bloc în execuție poate produce pagube de peste 70.000 EUR. Fără CAR, antreprenorul trebuie să refacă lucrările pe cheltuială proprie.',
        underwritingCaveat: 'Valoarea asigurată trebuie să reflecte valoarea totală a contractului de lucrări, inclusiv materialele furnizate de beneficiar.',
      },
      {
        productName: 'Garanții Financiare de Bună Execuție & Participare la Licitații (SEAP)',
        productCategory: 'CONSTRUCTION',
        whyRelevant: 'Înlocuiesc scrisoarea de garanție bancară sau reținerile din situațiile de plată, eliberând capitalul de lucru al constructorului fără blocarea colateralelor la bănci.',
        unprotectedRisks: [
          'Blocarea lichidităților financiare în conturi escrow de garanție la trezorerie',
          'Pierzarea participării la licitații publice din cauza depășirii plafoanelor bancare',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Pentru un contract de 5 milioane RON, reținerea unei garanții de 10% blochează 500.000 RON în trezorerie timp de 3-5 ani până la recepția finală. O poliță de garanție de asigurare deblochează complet această sumă contra unei prime reduse.',
        underwritingCaveat: 'Emiterea este condiționată de analiza situațiilor financiare anuale și experiența similară în execuția de lucrări.',
      },
      {
        productName: 'Asigurare Utilaje & Echipamente de Șantier (CPM)',
        productCategory: 'CONSTRUCTION',
        whyRelevant: 'Acoperire dedicată pentru buldoexcavatoare, macarale, betoniere, nacele împotriva răsturnării, căderilor, incendiilor și furtului pe șantier.',
        unprotectedRisks: [
          'Răsturnarea utilajului pe teren instabil în timpul excavării',
          'Furtul componentelor scumpe (calculatoare de bord, pompe hidraulice)',
          'Avarii produse de căderi de pietre sau coliziuni accidentale',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Răsturnarea unui excavator de 20 de tone într-un șanț poate genera costuri de scoatere și reparație hidraulică de peste 40.000 EUR, neacoperite de nicio poliță auto standard.',
        underwritingCaveat: 'Necesită evidențierea utilajelor în registrul de mijloace fixe și respectarea instrucțiunilor producătorului.',
      },
    ],
    screeningQuestions: [
      'Ce proiecte de construcții sau lucrări de execuție aveți în derulare în prezent?',
      'Aveți contracte în curs care vă solicită expres polițe CAR de șantier sau răspundere civilă terți?',
      'Participați la proceduri de achiziție publică (SEAP) unde utilizați scrisori de garanție de asigurare?',
      'Ce valoare aproximativă au utilajele și echipamentele mobile pe care le dețineți pe șantiere?',
      'Cine gestionează în cadrul firmei dosarele de ofertare și asigurările de proiect?',
    ],
    openingScript:
      'Bună ziua! Vă contactez în legătură cu activitatea de construcții a companiei dumneavoastră. Lucrăm cu antreprenori generali și constructori pentru asigurarea șantierelor prin polițe CAR și eliberarea lichidităților prin garanții de bună execuție. Cine este responsabilul tehnic sau financiar care decide asupra programului de asigurări al proiectelor?',
    recommendedNextAction:
      'Identificare șantiere curente, valori de contract și necesar de garanții SEAP pentru transmiterea unui pachet avantajos CAR + Garanții.',
  },

  MANUFACTURING: {
    profileKey: 'MANUFACTURING',
    industryName: 'Producție Industrială, Prelucrare & Fabricare',
    relevantCaenPrefixes: [
      '10', '11', '13', '14', '15', '16', '17', '18', '20', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33',
    ],
    recommendedProducts: [
      {
        productName: 'Proprietate Industrială: Clădiri, Hale, Linii Tehnologice & Stocuri',
        productCategory: 'PROPERTY',
        whyRelevant: 'Protejează patrimoniul operațional împotriva incendiilor, exploziilor, căderilor de grindină, avariilor produse de apă și dezastrelor naturale.',
        unprotectedRisks: [
          'Incendiu distructiv în secția de fabricație sau depozitul de materii prime',
          'Avarii produse de inundații sau descărcări electrice atmosferice',
          'Distrugerea stocurilor de produse finite gata de livrare',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Un incendiu într-un atelier de debitare poate mistui utilaje CNC și materii prime în valoare de sute de mii de euro. Fără o acoperire flexibilă la valoare de reconstituire, producția este oprită definitiv.',
        underwritingCaveat: 'Inspecția de risc evaluează existența hidranților, a detectoarelor de fum și a autorizației ISU.',
      },
      {
        productName: 'Avarii Accidentale Mașini & Utilaje (Machinery Breakdown)',
        productCategory: 'PROPERTY',
        whyRelevant: 'Acoperă defectarea bruscă a echipamentelor industriale cauzată de supratensiune, erori de operare, rupere de piese sau defecte ascunse de material.',
        unprotectedRisks: [
          'Griparea sau distrugerea axelor motoarelor sau a roboților industriali',
          'Scurtcircuite în tablourile electronice de comandă automatizată',
          'Costul de înlocuire a componentelor unicat comandate de la producător extern',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Blocarea unui compresor de mare capacitate sau a unei linii de ambalare automată poate genera un cost direct de înlocuire de 45.000 EUR plus costurile transportului de urgență.',
        underwritingCaveat: 'Utilajele trebuie să fie în stare de funcționare și să aibă reviziile periodice consemnate în cartea tehnică.',
      },
      {
        productName: 'Întreruperea Activității de Producție (Business Interruption)',
        productCategory: 'BUSINESS_INTERRUPTION',
        whyRelevant: 'Asigură plata profitului net nerealizat și a cheltuielilor fixe (salarii, chirii, rate de leasing) pe perioada în care fabrica este oprită din cauza unui sinistru asigurat.',
        unprotectedRisks: [
          'Incapacitatea de a plăti salariile angajaților când producția este paralizată',
          'Pierderea contractelor comerciale din cauza întârzierilor de producție',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Oprirea unei fabrici timp de 6 săptămâni după o avarie produce pierderi fixe de salarii și profit de peste 100.000 RON, chiar dacă reparația utilajului a fost plătită.',
        underwritingCaveat: 'Se stabilește o perioadă de indemnizare (uzual 6, 12 sau 18 luni) și o franșiză temporală (uzual 2-3 zile).',
      },
      {
        productName: 'Răspunderea Civilă a Producătorului (Product Liability)',
        productCategory: 'LIABILITY',
        whyRelevant: 'Acoperă daunele materiale sau vătămările corporale provocate terților de produsele cu defecte livrate pe piață.',
        unprotectedRisks: [
          'Pretenții de daune din partea clienților cărora produsul le-a afectat alte bunuri',
          'Costuri de retragere a produsului de pe piață în caz de neconformitate gravă',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Un lot de componente defecte integrate de client în alte instalații poate duce la defectarea acestora și litigii comerciale de zeci de mii de euro.',
        underwritingCaveat: 'Este necesară prezentarea certificatelor de conformitate și a standardelor de calitate aplicate (ex: ISO 9001).',
      },
    ],
    screeningQuestions: [
      'Ce valoare aproximativă au utilajele, clădirile și stocurile de materii prime ale fabricii?',
      'Aveți acoperire pentru avarii accidentale la utilajele principale de producție?',
      'Polița dumneavoastră include compensarea pierderilor prin întreruperea activității (Business Interruption)?',
      'Produsele dumneavoastră sunt vândute exclusiv în România sau ajung și pe piețe externe?',
      'Cine răspunde de managementul riscurilor și reînnoirea polițelor industriale în companie?',
    ],
    openingScript:
      'Bună ziua! Vă contactez în legătură cu activitatea de producție a companiei dumneavoastră. Lucrăm cu producători industriali pentru protejarea utilajelor critice și prevenirea pierderilor financiare în caz de întrerupere a activității. Aș dori să vă adresez două întrebări scurte legate de programul dumneavoastră de asigurare. Cu cine din conducerea tehnică sau executivă putem discuta?',
    recommendedNextAction:
      'Transmitere chestionar tehnic de producție și programare întâlnire pentru evaluarea pachetului Proprietate + Avarii Utilaje.',
  },

  IT: {
    profileKey: 'IT',
    industryName: 'Tehnologia Informației, Software & Servicii Cloud',
    relevantCaenPrefixes: ['6201', '6202', '6203', '6209', '6311', '5829', '6312'],
    recommendedProducts: [
      {
        productName: 'Tech Professional Indemnity (E&O - Errors & Omissions)',
        productCategory: 'IT_CYBER',
        whyRelevant: 'Protejează compania de software împotriva cererilor de despăgubire din partea clienților pentru erori de codare, nerespectarea specificațiilor sau pierderi financiare cauzate de aplicație.',
        unprotectedRisks: [
          'Pretenții financiare de la clienți enterprise pentru bug-uri software majore',
          'Nedeliverarea la termen a modulelor convenite în acorduri SLA stricte',
          'Acuzații de neglijență profesională sau încălcare neintenționată a drepturilor de autor',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Un client din Germania solicită despăgubiri de 150.000 EUR pentru întreruperea vânzărilor online cauzată de un release software defectuos. O poliță Tech E&O acoperă atât asistența juridică de specialitate, cât și daunele negociate.',
        underwritingCaveat: 'Trebuie declarată jurisdicția contractelor (clienții din SUA/Canada necesită clauze speciale și limite mai mari).',
      },
      {
        productName: 'Cyber Risk & Data Breach Insurance',
        productCategory: 'IT_CYBER',
        whyRelevant: 'Acoperă costurile de răspuns la incidente de securitate: investigație forensics, recuperare date, notificare GDPR, negocieri ransomware și amenzi administrative unde este permis.',
        unprotectedRisks: [
          'Atac ransomware care criptează bazele de date și serverele clienților',
          'Scurgeri de date confidențiale sau credențiale ale utilizatorilor',
          'Costuri juridice și de comunicare de criză impuse de autoritățile de protecție a datelor',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Un atac cibernetic asupra unei infrastructuri SaaS costă în medie 60.000 - 100.000 EUR doar pentru investigația experților de securitate și refacerea integrității datelor.',
        underwritingCaveat: 'Condiționată de existența autentificării cu doi factori (MFA) și copii de rezervă izolate offline (air-gapped).',
      },
      {
        productName: 'Directors & Officers Liability (D&O)',
        productCategory: 'LIABILITY',
        whyRelevant: 'Protejează patrimoniul personal al fondatorilor și administratorilor în fața cererilor de chemare în judecată din partea investitorilor, partenerilor sau autorităților.',
        unprotectedRisks: [
          'Litigii cu privire la deciziile de alocare a fondurilor sau diluarea participațiilor',
          'Răspunderea personală a administratorului pentru obligații ale societății în dispută',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: O acțiune în instanță a unui acționar minoritar privind gestionarea defectuoasă a fondurilor poate atrage popriri pe conturile personale ale administratorului până la clarificarea litigiului.',
        underwritingCaveat: 'Polița acoperă cheltuielile de apărare chiar dacă acuzațiile se dovedesc ulterior nefondate.',
      },
    ],
    screeningQuestions: [
      'Dezvoltați software custom pentru clienți internaționali sau dețineți propriile produse SaaS?',
      'Contractele comerciale cu clienții vă impun niveluri minime de asigurare E&O (ex: 1M EUR sau 2M USD)?',
      'Aveți o poliță dedicată de risc cibernetic (Cyber Insurance) pentru protecția datelor clienților?',
      'Când ați auditat ultima dată limitele de răspundere stipulate în acordurile SLA semnate?',
      'Cine coordonează la dumneavoastră aspectele juridice, contractuale și de asigurare?',
    ],
    openingScript:
      'Bună ziua! Vă contactez în legătură cu activitatea de dezvoltare software a companiei dumneavoastră. Lucrăm cu firme IT din România pentru acoperiri internaționale de Tech E&O și Cyber Risk, solicitate frecvent în contractele cu parteneri din vestul Europei sau SUA. Cine este persoana din conducere responsabilă de contractele comerciale și riscurile de conformitate?',
    recommendedNextAction:
      'Solicitare draft cerințe de asigurare din contractele internaționale pentru plasarea unei oferte E&O conforme cu piețele externe.',
  },

  HEALTHCARE: {
    profileKey: 'HEALTHCARE',
    industryName: 'Servicii Medicale, Clinici, Cabinete & Diagnostic',
    relevantCaenPrefixes: ['8610', '8621', '8622', '8623', '8690', '7500'],
    recommendedProducts: [
      {
        productName: 'Răspundere Civilă Malpraxis Medical (Medici & Unitate Sanitară)',
        productCategory: 'HEALTHCARE',
        whyRelevant: 'Obligație legală strictă conform Legii 95/2006 pentru autorizarea clinicii și a fiecărui medic/asistent în parte în fața Colegiului Medicilor și DSP.',
        unprotectedRisks: [
          'Pretenții de despăgubire ale pacienților pentru erori de diagnostic sau tratament',
          'Răspunderea persoanei juridice (clinica) pentru actele personalului medical angajat/colaborator',
          'Cheltuieli de judecată și onorarii de expertiză medico-legală',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: O cerere de daune morale și materiale formulată de un pacient pentru o complicație post-operatorie poate ajunge la zeci de mii de euro. Fără o poliță de malpraxis pentru clinică cu limite adecvate, fondurile operaționale ale cabinetului pot fi blocate.',
        underwritingCaveat: 'Polița individuală a medicului nu acoperă întotdeauna răspunderea persoanei juridice (clinica privată).',
      },
      {
        productName: 'Asigurare Echipamente Medicale Specializate (Avarii Accidentale)',
        productCategory: 'HEALTHCARE',
        whyRelevant: 'Protecție All-Risks pentru ecografe, unituri stomatologice, lasere, aparatură radiologică și de laborator împotriva căderilor, supratensiunilor și erorilor de manipulare.',
        unprotectedRisks: [
          'Arderea circuitelor electronice fine la tomografe sau ecografe prin fluctuații de rețea',
          'Avarii cauzate de scăparea sondelor scumpe sau a pieselor de mână stomatologice',
          'Blocarea activității clinicii din cauza lipsei pieselor de schimb asigurate',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Înlocuirea unei sonde pentru un ecograf 4D de înaltă performanță costă între 8.000 și 15.000 EUR. Fără o poliță tehnică adecvată, clinica trebuie să suporte acest cost imediat.',
        underwritingCaveat: 'Aparatura trebuie să fie deservită de personal instruit și să aibă contracte de service autorizat.',
      },
    ],
    screeningQuestions: [
      'Câți medici și specialiști colaborează în prezent în cadrul clinicii dumneavoastră?',
      'Pe lângă polițele individuale ale medicilor, dețineți o poliță de malpraxis la nivel de clinică (persoană juridică)?',
      'Cum sunt asigurate echipamentele medicale scumpe împotriva fluctuațiilor de tensiune sau a avariilor?',
      'Cine monitorizează datele de reînnoire ale polițelor obligatorii pentru autorizația DSP?',
      'Cu cine putem discuta din conducerea medicală sau administrativă a clinicii?',
    ],
    openingScript:
      'Bună ziua! Vă contactez în legătură cu clinica dumneavoastră medicală. Asistăm furnizori privați de servicii medicale pentru optimizarea pachetelor de malpraxis (atât pentru personal, cât și pentru persoana juridică) și protejarea echipamentelor speciale de diagnostic. Cine coordonează la dumneavoastră aspectele administrative și de asigurare?',
    recommendedNextAction:
      'Centralizare număr medici pe specialități și listă aparatură medicală de valoare pentru ofertare integrată clinică.',
  },

  HORECA: {
    profileKey: 'HORECA',
    industryName: 'Ospitalitate, Restaurante, Hoteluri & Evenimente',
    relevantCaenPrefixes: ['5510', '5520', '5530', '5610', '5621', '5629', '5630'],
    recommendedProducts: [
      {
        productName: 'Proprietate Comercială, Incendiu & Întreruperea Afacerii (Business Interruption)',
        productCategory: 'HOSPITALITY',
        whyRelevant: 'Protejează spațiile de cazare, restaurantele, bucătăriile profesionale și mobilierul împotriva incendiilor, exploziilor și inundațiilor, garantând plata veniturilor nerealizate în perioada reparațiilor.',
        unprotectedRisks: [
          'Incendiu izbucnit în bucătărie la echipamentele de gătit cu ulei sau gaz',
          'Inundații provenite de la conducte de apă care degradează finisajele hotelului',
          'Pierderea profitului zilnic pe durata lunilor de renovare forțată',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Un incendiu la hota unei bucătării de restaurant produce daune de 50.000 EUR și închide unitatea timp de 2 luni. O poliță de Business Interruption plătește salariile angajaților și marja de profit care s-ar fi realizat.',
        underwritingCaveat: 'Măsurile de securitate la incendiu (autorizație ISU, stingătoare verificate, mentenanță hote) sunt obligatorii.',
      },
      {
        productName: 'Răspundere Civilă Față de Oaspeți & Siguranță Alimentară',
        productCategory: 'HOSPITALITY',
        whyRelevant: 'Despăgubește daunele cauzate clienților în incinta unității: căzături, alunecări pe pardoseli umede sau incidente legate de toxiinfecții alimentare.',
        unprotectedRisks: [
          'Vătămări corporale ale clienților pe teritoriul restaurantului sau al piscinei',
          'Acuzații de contaminare alimentară sau nerespectare a regimului alergenilor',
          'Deteriorarea bunurilor lăsate în camerele de hotel sau parcarea privată',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Un client care alunecă pe o scară umedă și suferă o fractură gravă poate solicita daune morale și cheltuieli medicale de peste 30.000 RON în instanță.',
        underwritingCaveat: 'Unitatea trebuie să aibă implementat planul de igienă și siguranță alimentară HACCP.',
      },
    ],
    screeningQuestions: [
      'Ce capacitate are unitatea dumneavoastră și ce valoare aproximativă au amenajările interioare și stocurile?',
      'Aveți poliță de incendiu care include compensarea întreruperii activității (pierdere de profit)?',
      'Polița dumneavoastră include răspunderea civilă față de clienți și oaspeți?',
      'Când expiră asigurările actuale ale locației?',
      'Cine ia deciziile operaționale și de asigurare în cadrul societății?',
    ],
    openingScript:
      'Bună ziua! Vă contactez în legătură cu locația dumneavoastră HoReCa. Lucrăm cu proprietari și manageri de restaurante și unități de cazare pentru optimizarea polițelor de incendiu, echipamente și acoperirea răspunderii față de oaspeți. Cu cine dintre administratori sau managerul de locație putem discuta?',
    recommendedNextAction:
      'Programare discuție de 10 minute pentru identificarea suprafeței, dotărilor din bucătărie și transmiterea unei cotații HoReCa.',
  },

  REAL_ESTATE: {
    profileKey: 'REAL_ESTATE',
    industryName: 'Dezvoltare Imobiliară, Închirieri & Administrare Proprietăți',
    relevantCaenPrefixes: ['6810', '6820', '6831', '6832', '4110'],
    recommendedProducts: [
      {
        productName: 'Asigurare Clădiri Rezidențiale / Comerciale & Bunuri (Property All Risks)',
        productCategory: 'REAL_ESTATE',
        whyRelevant: 'Protejează imobilele aflate în proprietate sau administrare împotriva cutremurelor, incendiilor, inundațiilor și fenomenelor meteo extreme.',
        unprotectedRisks: [
          'Distrugerea structurii clădirii sau a fațadelor în caz de calamitate',
          'Avarii produse la instalațiile comune (centrale termice, lifturi, pompe)',
          'Distrugeri provocate de chiriași neacoperite de garanțiile contractuale',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: O avarie la hidroforul unei clădiri de birouri poate inunda arhivele și instalațiile de la subsol, generând reparații de peste 80.000 RON.',
        underwritingCaveat: 'Suma asigurată trebuie actualizată conform valorii de reconstrucție la prețurile pieței actuale de construcții.',
      },
      {
        productName: 'Răspunderea Civilă a Proprietarului & Pierdere Chirii',
        productCategory: 'REAL_ESTATE',
        whyRelevant: 'Protejează proprietarul împotriva pretențiilor terților pentru daune produse de imobil și compensează chiria pierdută dacă spațiul devine nelocuibil după un incendiu sau inundație.',
        unprotectedRisks: [
          'Căderi de bucăți de tencuială, țigle sau gheață pe mașinile parcate sau trecători',
          'Pierderea veniturilor din chirii timp de mai multe luni în urma unui sinistru',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Un incendiu parțial la un etaj oprește încasarea unei chirii de 6.000 EUR/lună pe o perioadă de 6 luni, reprezentând o pierdere netă de 36.000 EUR pentru proprietar.',
        underwritingCaveat: 'Valoarea chiriei asigurate trebuie dovedită prin contractele de închiriere active la data producerii evenimentului.',
      },
    ],
    screeningQuestions: [
      'Câte imobile sau spații comerciale/rezidențiale dețineți sau aveți în administrare?',
      'Sunt actualizate sumele asigurate ale clădirilor în raport cu scumpirea materialelor de construcții?',
      'Aveți polițe care acoperă răspunderea proprietarului față de chiriași și riscul de pierdere a chiriilor?',
      'Cine gestionează centralizat asigurările portofoliului imobiliar?',
      'Când expiră polițele actuale pe proprietăți?',
    ],
    openingScript:
      'Bună ziua! Vă contactez în legătură cu proprietățile imobiliare pe care le gestionați. Lucrăm cu proprietari și administratori de portofolii imobiliare pentru evaluarea corectă a sumelor asigurate și protecția chiriilor împotriva riscurilor majore. Cine este persoana responsabilă de administrarea clădirilor în cadrul firmei?',
    recommendedNextAction:
      'Transmitere listă proprietăți (suprafețe, destinație, chirii lunare) pentru realizarea unui audit gratuit al polițelor imobiliare.',
  },

  GENERAL_BUSINESS: {
    profileKey: 'GENERAL_BUSINESS',
    industryName: 'Servicii Comerciale, Comerț & Afaceri Generale',
    relevantCaenPrefixes: [], // Fallback for all other CAEN codes
    recommendedProducts: [
      {
        productName: 'Asigurare de Sănătate de Grup & Accidente pentru Angajați',
        productCategory: 'EMPLOYEE_BENEFITS',
        whyRelevant: 'Beneficiu extra-salarial apreciat, deductibil fiscal până la 400 EUR per angajat pe an (Codul Fiscal Art. 76). Asigură acces rapid la servicii medicale private, analize și spitalizare.',
        unprotectedRisks: [
          'Fluctuația de personal și pierderea angajaților cheie în favoarea concurenților',
          'Concedii medicale prelungite din cauza accesului lent la investigații medicale',
          'Cheltuieli neprevăzute suportate de companie în caz de accident de muncă',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Înlocuirea unui angajat calificat costă în medie echivalentul a 3-4 salarii lunare. O asigurare privată de sănătate de 150 RON/lună oferă stabilitate echipei și reduce absenteismul.',
        underwritingCaveat: 'Polițele de grup pot fi contractate de regulă pentru echipe de minimum 3-5 angajați.',
      },
      {
        productName: 'Asigurare Bunuri, Sediu Social & Echipamente de Birou',
        productCategory: 'PROPERTY',
        whyRelevant: 'Protejează echipamentele IT, mobilierul, stocurile din depozit și sediul împotriva incendiilor, furtului prin efracție și avariilor accidentale la conducte de apă.',
        unprotectedRisks: [
          'Scurtcircuit sau incendiu la tabloul electric al sediului',
          'Furtul calculatoarelor, serverelor și echipamentelor de birou',
          'Inundație de la instalația sanitară a spațiului',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: O inundație de weekend de la un robinet defect poate distruge echipamente IT și arhive în valoare de 40.000 RON.',
        underwritingCaveat: 'Spațiile trebuie să fie dotate cu încuietori adecvate sau sistem de alarmă monitorizat.',
      },
      {
        productName: 'Răspundere Civilă Generală Legală Față de Terți',
        productCategory: 'LIABILITY',
        whyRelevant: 'Acoperă prejudiciile cauzate terților (clienți, furnizori, parteneri) din culpa companiei pe parcursul desfășurării activității curente.',
        unprotectedRisks: [
          'Accidentarea unui vizitator în sediul companiei',
          'Avarierea bunurilor unui client pe durata prestării serviciului',
        ],
        illustrativeLossExample: 'Exemplu ilustrativ: Vătămarea unui partener de afaceri în timpul unei vizite la sediu poate genera pretenții judiciare de despăgubire a cheltuielilor de tratament.',
        underwritingCaveat: 'Exclude de regulă faptele intenționate sau nerespectarea gravă a normelor de protecție a muncii.',
      },
    ],
    screeningQuestions: [
      'Câți salariați activează în prezent în echipa dumneavoastră?',
      'Oferiți în prezent echipei beneficii de sănătate sau asigurări private deductibile fiscal (până la 400 EUR/an)?',
      'Aveți asigurare pentru sediul social, echipamentele IT sau spațiile de depozitare?',
      'Aveți o poliță de răspundere civilă comercială față de clienți și parteneri?',
      'Cine ia decizia în companie în privința beneficiilor pentru echipă și a asigurărilor patrimoniale?',
    ],
    openingScript:
      'Bună ziua! Vă contactez în legătură cu activitatea companiei dumneavoastră. Lucrăm cu firme din sectorul comercial pentru optimizarea pachetelor de asigurare de sănătate pentru angajați (complet deductibile fiscal) și protejarea activelor de birou. Cu cine din conducerea executivă putem discuta câteva minute despre aceste oportunități?',
    recommendedNextAction:
      'Identificare număr de angajați și transmitere ofertă comparativă de asigurare de sănătate de grup deductibilă fiscal.',
  },
};

export class InsuranceIntelligenceService {
  /**
   * Determine the most relevant industry profile based on CAEN code
   */
  static getProfileForCaen(caen?: string | null): IndustryRiskProfile {
    if (!caen) {
      return INDUSTRY_PROFILES.GENERAL_BUSINESS;
    }

    const cleanCaen = caen.trim().padStart(4, '0');

    for (const [key, profile] of Object.entries(INDUSTRY_PROFILES)) {
      if (key === 'GENERAL_BUSINESS') continue;
      for (const prefix of profile.relevantCaenPrefixes) {
        if (cleanCaen.startsWith(prefix)) {
          return profile;
        }
      }
    }

    return INDUSTRY_PROFILES.GENERAL_BUSINESS;
  }

  /**
   * Build complete insurance recommendations and sales assistant briefing for a company
   */
  static generateBriefing(company: {
    cui: number;
    name: string;
    primaryCaen?: string | null;
    caenDescription?: string | null;
    legalStatus?: string | null;
    fiscalStatus?: string | null;
    employeesAvg?: number | null;
    turnover?: number | null;
    latestFinancialYear?: number | null;
  }) {
    const profile = this.getProfileForCaen(company.primaryCaen);

    return {
      cui: company.cui,
      companyName: company.name,
      caen: company.primaryCaen || 'Nespecificat',
      caenDescription: company.caenDescription || profile.industryName,
      profileKey: profile.profileKey,
      industryName: profile.industryName,
      recommendedProducts: profile.recommendedProducts,
      screeningQuestions: profile.screeningQuestions,
      openingScript: profile.openingScript,
      recommendedNextAction: profile.recommendedNextAction,
      disclaimer: MANDATORY_INSURANCE_DISCLAIMER,
    };
  }
}
