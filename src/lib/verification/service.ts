/**
 * BUSINESS RADAR — Official Company Verification & Eligibility Engine
 * Implements strict legal status parsing, fiscal activity verification,
 * commercial activity evidence assessment and central calling eligibility decisions.
 */

export type LegalStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DISSOLVED'
  | 'IN_LIQUIDATION'
  | 'RADIATED'
  | 'UNKNOWN'
  | 'VERIFICATION_ERROR';

export type FiscalStatus =
  | 'FISCALLY_ACTIVE'
  | 'FISCALLY_INACTIVE'
  | 'REACTIVATED'
  | 'UNKNOWN'
  | 'VERIFICATION_ERROR';

export type CommercialEvidenceStatus =
  | 'ACTIVE_COMMERCIAL_EVIDENCE'
  | 'LIMITED_COMMERCIAL_EVIDENCE'
  | 'HISTORICAL_ACTIVITY_ONLY'
  | 'NO_FINANCIAL_EVIDENCE'
  | 'NEW_COMPANY'
  | 'COMMERCIAL_ACTIVITY_UNKNOWN';

export interface LegalStatusResult {
  status: LegalStatus;
  description: string;
  date?: string;
  rawText?: string;
}

export interface FiscalStatusResult {
  status: FiscalStatus;
  inactivationDate?: string;
  reactivationDate?: string;
  isRoEFactura?: boolean;
  scpTVA?: boolean;
}

export interface CommercialEvidenceResult {
  status: CommercialEvidenceStatus;
  latestYear?: number;
  turnover?: number;
  employeesAvg?: number;
  netProfit?: number;
  netLoss?: number;
  details: string;
}

export interface CompanyEligibilityResult {
  isEligible: boolean;
  ineligibilityReasons: string[];
  legalStatus: LegalStatus;
  fiscalStatus: FiscalStatus;
  commercialEvidenceStatus: CommercialEvidenceStatus;
  reasonsText: string;
}

export class CompanyVerificationService {
  /**
   * Parse official ONRC / ANAF stare_inregistrare into standard LegalStatus
   */
  static parseLegalStatus(rawStare?: string | null): LegalStatusResult {
    if (!rawStare || typeof rawStare !== 'string' || !rawStare.trim()) {
      return {
        status: 'UNKNOWN',
        description: 'Stare juridică nespecificată / neverificată',
        rawText: rawStare || undefined,
      };
    }

    const norm = rawStare.trim().toUpperCase();

    // Extract optional date if format is "din data DD.MM.YYYY" or "din DD.MM.YYYY"
    let statusDate: string | undefined;
    const dateMatch = norm.match(/(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})/);
    if (dateMatch) {
      statusDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }

    if (norm.includes('RADIERE') || norm.includes('RADIAT')) {
      return {
        status: 'RADIATED',
        description: rawStare.trim(),
        date: statusDate,
        rawText: rawStare.trim(),
      };
    }

    if (norm.includes('SUSPENDARE') || norm.includes('SUSPENDAT')) {
      return {
        status: 'SUSPENDED',
        description: rawStare.trim(),
        date: statusDate,
        rawText: rawStare.trim(),
      };
    }

    if (norm.includes('DIZOLVARE') || norm.includes('DIZOLVAT')) {
      return {
        status: 'DISSOLVED',
        description: rawStare.trim(),
        date: statusDate,
        rawText: rawStare.trim(),
      };
    }

    if (
      norm.includes('LICHIDARE') ||
      norm.includes('FALIMENT') ||
      norm.includes('INSOLVENT') ||
      norm.includes('REORGANIZARE')
    ) {
      return {
        status: 'IN_LIQUIDATION',
        description: rawStare.trim(),
        date: statusDate,
        rawText: rawStare.trim(),
      };
    }

    if (
      norm.includes('INREGISTRAT') ||
      norm.includes('FUNCTIONARE') ||
      norm.includes('AUTORIZAT') ||
      norm.includes('ACTIVA')
    ) {
      return {
        status: 'ACTIVE',
        description: rawStare.trim(),
        date: statusDate,
        rawText: rawStare.trim(),
      };
    }

    // Unrecognized string format
    return {
      status: 'UNKNOWN',
      description: `Format necunoscut: ${rawStare.trim()}`,
      rawText: rawStare.trim(),
    };
  }

  /**
   * Parse ANAF stare_inactiv into standard FiscalStatus
   */
  static parseFiscalStatus(inactivData?: {
    statusInactivi?: boolean;
    dataInactivare?: string | null;
    dataReactivare?: string | null;
    statusRO_e_Factura?: boolean;
    scpTVA?: boolean;
  } | null): FiscalStatusResult {
    if (!inactivData) {
      return { status: 'UNKNOWN' };
    }

    const isInactiv = Boolean(inactivData.statusInactivi);
    const dataInactivare = inactivData.dataInactivare?.trim() || undefined;
    const dataReactivare = inactivData.dataReactivare?.trim() || undefined;

    if (isInactiv) {
      // If marked inactive, check if reactivated after inactivation
      if (dataInactivare && dataReactivare && dataReactivare > dataInactivare) {
        return {
          status: 'REACTIVATED',
          inactivationDate: dataInactivare,
          reactivationDate: dataReactivare,
          isRoEFactura: inactivData.statusRO_e_Factura,
          scpTVA: inactivData.scpTVA,
        };
      }
      return {
        status: 'FISCALLY_INACTIVE',
        inactivationDate: dataInactivare,
        reactivationDate: dataReactivare,
        isRoEFactura: inactivData.statusRO_e_Factura,
        scpTVA: inactivData.scpTVA,
      };
    }

    // Not inactive
    if (dataReactivare) {
      return {
        status: 'REACTIVATED',
        inactivationDate: dataInactivare,
        reactivationDate: dataReactivare,
        isRoEFactura: inactivData.statusRO_e_Factura,
        scpTVA: inactivData.scpTVA,
      };
    }

    return {
      status: 'FISCALLY_ACTIVE',
      isRoEFactura: inactivData.statusRO_e_Factura,
      scpTVA: inactivData.scpTVA,
    };
  }

  /**
   * Assess commercial activity evidence based on official financial filings and incorporation date
   */
  static evaluateCommercialEvidence(
    financialRecord?: {
      fiscal_year?: number;
      turnover?: number;
      employees_avg?: number;
      net_profit?: number;
      net_loss?: number;
    } | null,
    incorporationDate?: string | null
  ): CommercialEvidenceResult {
    if (financialRecord && financialRecord.fiscal_year) {
      const year = financialRecord.fiscal_year;
      const turnover = financialRecord.turnover || 0;
      const employees = financialRecord.employees_avg ?? 0;
      const netProfit = financialRecord.net_profit || 0;
      const netLoss = financialRecord.net_loss || 0;

      // Recent filings threshold (year 2022 or newer)
      if (year >= 2022) {
        if (turnover > 0) {
          return {
            status: 'ACTIVE_COMMERCIAL_EVIDENCE',
            latestYear: year,
            turnover,
            employeesAvg: employees,
            netProfit,
            netLoss,
            details: `Bilanț oficial raportat pentru anul ${year}: Cifră de afaceri ${turnover.toLocaleString('ro-RO')} RON, ${employees} salariați.`,
          };
        } else {
          return {
            status: 'LIMITED_COMMERCIAL_EVIDENCE',
            latestYear: year,
            turnover,
            employeesAvg: employees,
            netProfit,
            netLoss,
            details: `Bilanț depus pentru anul ${year}, dar cifra de afaceri este zero sau număr salariați zero.`,
          };
        }
      } else {
        // Historical filings only (< 2022)
        return {
          status: 'HISTORICAL_ACTIVITY_ONLY',
          latestYear: year,
          turnover,
          employeesAvg: employees,
          netProfit,
          netLoss,
          details: `Date financiare disponibile doar pentru anul istoric ${year} (anterior anului 2022). Fără raportări recente.`,
        };
      }
    }

    // No financial record available - check incorporation recency
    if (incorporationDate) {
      const incYearMatch = incorporationDate.match(/(\d{4})/);
      if (incYearMatch) {
        const incYear = parseInt(incYearMatch[1], 10);
        // If incorporated in the last 3 years (e.g. 2022-2026)
        if (incYear >= 2022) {
          return {
            status: 'NEW_COMPANY',
            details: `Companie înființată recent (${incorporationDate}). Nu are încă obligația depunerii bilanțului anual pe exerciții închise.`,
          };
        }
      }
    }

    return {
      status: 'NO_FINANCIAL_EVIDENCE',
      details: 'Nu există bilanțuri financiare raportate la Ministerul Finanțelor.',
    };
  }

  /**
   * Central Prospecting & Calling Queue Eligibility Decision Function
   * Strictly evaluates whether Cristian should see this company in the active calling list.
   * Requires:
   * 1. Legally ACTIVE
   * 2. Fiscally ACTIVE
   * 3. ACTIVE_COMMERCIAL_EVIDENCE
   * 4. Usable, operational phone (not wrong number / invalid / outdated)
   * 5. Non-suppressed
   * 6. No status conflict
   * 7. Fresh verification within threshold (default 90 days)
   */
  static evaluateCompanyEligibility(input: {
    legalStatus: LegalStatus;
    fiscalStatus: FiscalStatus;
    commercialEvidenceStatus?: CommercialEvidenceStatus;
    hasValidContact: boolean;
    contactVerificationStatus?: string;
    isSuppressed?: boolean;
    hasConflict?: boolean;
    lastStatusCheckAt?: string | null;
    freshnessMaxDays?: number;
  }): CompanyEligibilityResult {
    const reasons: string[] = [];

    // 1. Legal Status Check
    if (input.legalStatus === 'RADIATED') {
      reasons.push('Companie radiată din registrul oficial');
    } else if (input.legalStatus === 'SUSPENDED') {
      reasons.push('Activitate suspendată');
    } else if (input.legalStatus === 'DISSOLVED') {
      reasons.push('Companie dizolvată');
    } else if (input.legalStatus === 'IN_LIQUIDATION') {
      reasons.push('Companie în procedură de lichidare, faliment sau insolvență');
    } else if (input.legalStatus === 'UNKNOWN') {
      reasons.push('Stare juridică neverificată');
    } else if (input.legalStatus === 'VERIFICATION_ERROR') {
      reasons.push('Eroare tehnică la verificarea stării juridice');
    }

    // 2. Fiscal Status Check
    if (input.fiscalStatus === 'FISCALLY_INACTIVE') {
      reasons.push('Companie inactivă fiscal în evidențele ANAF');
    } else if (input.fiscalStatus === 'UNKNOWN') {
      reasons.push('Stare fiscală neverificată la ANAF');
    } else if (input.fiscalStatus === 'VERIFICATION_ERROR') {
      reasons.push('Eroare la interogarea bazei de date fiscale ANAF');
    }

    // 3. Commercial Activity Evidence Check (MANDATORY)
    const commStatus = input.commercialEvidenceStatus || 'COMMERCIAL_ACTIVITY_UNKNOWN';
    if (commStatus !== 'ACTIVE_COMMERCIAL_EVIDENCE') {
      if (commStatus === 'NEW_COMPANY') {
        reasons.push('Companie nou înființată (înregistrată în coada de startup-uri)');
      } else if (commStatus === 'LIMITED_COMMERCIAL_EVIDENCE') {
        reasons.push('Evidență comercială limitată (cifră de afaceri 0 sau 0 salariați)');
      } else if (commStatus === 'HISTORICAL_ACTIVITY_ONLY') {
        reasons.push('Doar evidență financiară istorică (fără bilanț recent post-2022)');
      } else {
        reasons.push('Lipsă bilanț financiar recent la Ministerul Finanțelor');
      }
    }

    // 4. Status Conflict Check
    if (input.hasConflict) {
      reasons.push('Conflict între evidențele oficiale (STATUS_CONFLICT)');
    }

    // 5. Suppression List Check
    if (input.isSuppressed) {
      reasons.push('Companie sau contact inclus în lista de suprimare (Do Not Contact)');
    }

    // 6. Usable Contact Check
    if (!input.hasValidContact) {
      reasons.push('Fără număr de telefon sau canal de contact valid');
    } else if (input.contactVerificationStatus && ['WRONG_NUMBER', 'INVALID_NUMBER', 'CONFIRMED_INVALID', 'OUTDATED'].includes(input.contactVerificationStatus)) {
      reasons.push(`Număr de telefon nefuncțional (${input.contactVerificationStatus})`);
    }

    // 7. Freshness Check
    if (input.lastStatusCheckAt) {
      const checkDate = new Date(input.lastStatusCheckAt).getTime();
      const maxAgeMs = (input.freshnessMaxDays || 90) * 24 * 60 * 60 * 1000;
      if (!isNaN(checkDate) && (Date.now() - checkDate > maxAgeMs)) {
        reasons.push('Verificare expirată (mai veche de 90 de zile)');
      }
    }

    const isEligible = reasons.length === 0;

    return {
      isEligible,
      ineligibilityReasons: reasons,
      legalStatus: input.legalStatus,
      fiscalStatus: input.fiscalStatus,
      commercialEvidenceStatus: commStatus,
      reasonsText: reasons.join('; '),
    };
  }
}
