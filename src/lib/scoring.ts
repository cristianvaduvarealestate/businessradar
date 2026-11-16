export interface ScoringInput {
  cui: number;
  name?: string;
  regCom?: string;
  county?: string;
  city?: string;
  street?: string;
  primaryCaen?: string;
  status?: string;
  legalStatus?: string;
  fiscalStatus?: string;
  commercialEvidenceStatus?: string;
  isCallingEligible?: boolean;
  vatRegistered?: number | boolean;
  hasFinancials?: boolean;
  financialHistoryYears?: number;
  hasWebsite?: boolean;
  hasEmail?: boolean;
  hasPhone?: boolean;
  opportunitiesCount?: number;
  urgentOpportunitiesCount?: number;
  isNewCompany?: boolean;
  turnoverRecent?: number;
  turnoverPrevious?: number;
  profitRecent?: number;
  profitPrevious?: number;
}

export type ProspectPriority = 'EXCLUDED' | 'REVIEW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'STANDARD' | 'LOW';

export interface ScoringResult {
  dataCompletenessScore: number; // 0 - 100
  opportunityScore: number;      // 0 - 100
  prospectPriority: ProspectPriority;
  financialTrend: 'GROWING' | 'STABLE' | 'DECLINING' | 'UNKNOWN';
  explanation: {
    completenessReasons: string[];
    opportunityReasons: string[];
    priorityReasons: string[];
  };
}

export function calculateCompanyScores(input: ScoringInput): ScoringResult {
  const completenessReasons: string[] = [];
  const opportunityReasons: string[] = [];
  const priorityReasons: string[] = [];

  // 1. Data Completeness (Max 100 points)
  let completeness = 0;
  if (input.cui) { completeness += 10; completenessReasons.push('CUI oficial valid (+10%)'); }
  if (input.name) { completeness += 10; completenessReasons.push('Denumire legală identificată (+10%)'); }
  if (input.regCom) { completeness += 10; completenessReasons.push('Nr. Registrul Comerțului (+10%)'); }
  if (input.county && input.city) { completeness += 10; completenessReasons.push('Sediu geografic complet (+10%)'); }
  if (input.primaryCaen) { completeness += 15; completenessReasons.push('Obiect de activitate CAEN clasificat (+15%)'); }
  if (input.status || input.legalStatus) { completeness += 10; completenessReasons.push('Stare juridică confirmată (+10%)'); }
  if (input.vatRegistered !== undefined || input.fiscalStatus) { completeness += 10; completenessReasons.push('Statut fiscal ANAF verificat (+10%)'); }
  if (input.hasFinancials || input.commercialEvidenceStatus === 'ACTIVE_COMMERCIAL_EVIDENCE') { completeness += 15; completenessReasons.push('Bilanț financiar depus (+15%)'); }
  if (input.hasWebsite) { completeness += 5; completenessReasons.push('Website comercial validat (+5%)'); }
  if (input.hasEmail || input.hasPhone) { completeness += 5; completenessReasons.push('Date de contact identificate (+5%)'); }

  // 2. Opportunity Score (Max 100 points)
  let oppScore = 20; // Base score for any registered business
  opportunityReasons.push('Entitate activă în circuitul economic (+20)');

  const oppCount = input.opportunitiesCount || 0;
  const urgentCount = input.urgentOpportunitiesCount || 0;

  if (oppCount > 0) {
    const oppPoints = Math.min(oppCount * 15, 45);
    oppScore += oppPoints;
    opportunityReasons.push(`${oppCount} oportunități de asigurare identificate (+${oppPoints})`);
  }

  if (urgentCount > 0) {
    oppScore += 15;
    opportunityReasons.push(`${urgentCount} polițe de asigurare cu prioritate urgentă / legală (+15)`);
  }

  if (input.isNewCompany) {
    oppScore += 10;
    opportunityReasons.push('Firmă nou-înființată: moment optim pentru contractare pachet inițial (+10)');
  }

  if (input.hasEmail || input.hasPhone || input.hasWebsite) {
    oppScore += 10;
    opportunityReasons.push('Canal de contact comercial accesibil (+10)');
  }

  oppScore = Math.min(oppScore, 100);

  // 3. Prospecting Priority
  let priority: ProspectPriority = 'STANDARD';

  // Check exclusion first
  const isExcluded =
    input.isCallingEligible === false ||
    input.legalStatus === 'RADIATED' ||
    input.legalStatus === 'SUSPENDED' ||
    input.legalStatus === 'DISSOLVED' ||
    input.legalStatus === 'IN_LIQUIDATION' ||
    input.fiscalStatus === 'FISCALLY_INACTIVE' ||
    input.status === 'RADIATED' ||
    input.status === 'DISSOLVED';

  if (isExcluded) {
    priority = 'EXCLUDED';
    priorityReasons.push('Companie exclusă: statut juridic/fiscal neeligibil sau radiată');
  } else if (
    input.legalStatus === 'UNKNOWN' ||
    input.fiscalStatus === 'UNKNOWN' ||
    input.legalStatus === 'VERIFICATION_ERROR'
  ) {
    priority = 'REVIEW';
    priorityReasons.push('Necesită verificare oficială suplimentară');
  } else if (
    urgentCount > 0 &&
    (input.hasEmail || input.hasPhone) &&
    input.commercialEvidenceStatus === 'ACTIVE_COMMERCIAL_EVIDENCE'
  ) {
    priority = 'URGENT';
    priorityReasons.push('Poliță urgentă/legală, activitate confirmată și contact disponibil');
  } else if (
    (oppScore >= 65 || (input.isNewCompany && input.hasPhone)) &&
    (input.hasPhone || input.hasEmail)
  ) {
    priority = 'HIGH';
    priorityReasons.push('Eligibilă verificată, oportunități identificate și contact valid');
  } else if (input.hasPhone || input.hasEmail) {
    priority = 'MEDIUM';
    priorityReasons.push('Eligibilă verificată cu date de contact standard');
  } else {
    priority = 'STANDARD';
    priorityReasons.push('Companie eligibilă pentru campanii periodice');
  }

  // 4. Financial Trend
  let trend: 'GROWING' | 'STABLE' | 'DECLINING' | 'UNKNOWN' = 'UNKNOWN';
  if (input.turnoverRecent && input.turnoverPrevious) {
    const growth = (input.turnoverRecent - input.turnoverPrevious) / input.turnoverPrevious;
    if (growth > 0.05) {
      trend = 'GROWING';
    } else if (growth < -0.05) {
      trend = 'DECLINING';
    } else {
      trend = 'STABLE';
    }
  }

  return {
    dataCompletenessScore: completeness,
    opportunityScore: oppScore,
    prospectPriority: priority,
    financialTrend: trend,
    explanation: {
      completenessReasons,
      opportunityReasons,
      priorityReasons,
    },
  };
}
