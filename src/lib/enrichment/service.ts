import { queryAll, queryOne, executeRun } from '../db';
import { AnafTaxConnector } from '../providers/anaf';
import { WebsiteContactScraper } from './website-scraper';
import { ContactNormalizer } from './normalizer';
import { DiscoveredContactItem, EnrichmentResult, EnrichmentProgress } from './types';
import { logAuditEvent } from '../audit';

// In-memory progress state for bulk operations
let activeProgress: EnrichmentProgress | null = null;
let stopRequested = false;

export class CompanyEnrichmentService {
  private static anafConnector = new AnafTaxConnector();

  /**
   * Check if a company or contact is on the suppression list.
   */
  static async isSuppressed(cui: number, email?: string, phone?: string): Promise<boolean> {
    try {
      const rows = await queryAll(
        `SELECT id FROM suppression_list 
         WHERE cui = ? 
            OR (email IS NOT NULL AND email = ?) 
            OR (phone IS NOT NULL AND phone = ?)`,
        [cui, email || '', phone || '']
      );
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Enriches a single company by CUI using ANAF and website extraction.
   */
  static async enrichCompany(
    cui: number,
    options: { forceRefresh?: boolean } = {}
  ): Promise<EnrichmentResult> {
    const errors: string[] = [];
    const sourcesChecked: string[] = [];
    const allDiscovered: DiscoveredContactItem[] = [];

    // 1. Check suppression list
    if (await this.isSuppressed(cui)) {
      return {
        cui,
        companyName: '',
        success: false,
        contactsDiscovered: [],
        errors: ['Compania se află în lista de supresie (DO NOT CONTACT).'],
        sourcesChecked: ['SUPPRESSION_LIST'],
      };
    }

    // 2. Query company record
    const company = await queryOne(
      `SELECT cui, name, county, city, website, primary_caen, status FROM companies WHERE cui = ?`,
      [cui]
    );

    if (!company) {
      return {
        cui,
        companyName: 'Necunoscută',
        success: false,
        contactsDiscovered: [],
        errors: [`Compania cu CUI ${cui} nu există în baza de date.`],
        sourcesChecked: [],
      };
    }

    const companyName = company.name;
    let validatedWebsite: string | undefined = undefined;

    // 3. Provider A: Official ANAF PlatitorTvaRest v9
    let taxResult: any = undefined;
    try {
      sourcesChecked.push('ANAF_OPEN_DATA');
      const anafBatch = await this.anafConnector.fetchBatchTaxStatus([cui]);
      if (anafBatch.length > 0) {
        const res = anafBatch[0];
        taxResult = {
          vatRegistered: res.scpTVA,
          active: !res.statusInactivi,
          eFacturaReady: res.statusRO_e_Factura,
          fiscalAddress: res.adresa,
          registrationState: res.stare_inregistrare,
          caenCode: res.cod_CAEN,
        };

        if (res.discoveredContacts && res.discoveredContacts.length > 0) {
          allDiscovered.push(...res.discoveredContacts);
        }
      }
    } catch (err: any) {
      errors.push(`ANAF error: ${err.message || 'Timeout sau indisponibil'}`);
    }

    // 4. Provider B: Company Website Investigation
    // Check if company has an existing website field
    let candidateUrl = company.website ? company.website.trim() : '';

    if (candidateUrl) {
      // Check if candidateUrl was accidentally an email or phone!
      const webCheck = ContactNormalizer.normalizeWebsite(candidateUrl);
      if (webCheck) {
        if (webCheck.detectedType === 'EMAIL') {
          allDiscovered.push({
            cui,
            contactType: 'EMAIL',
            originalValue: candidateUrl,
            normalizedValue: webCheck.normalized,
            label: 'OFFICE',
            sourceName: 'HISTORICAL_REGISTRY',
            provenanceUrl: 'data/radar_business.db',
            verificationMethod: 'REGISTRY_FIELD_EXTRACTION',
            verificationStatus: 'DECLARED_BY_COMPANY',
            confidenceScore: 0.8,
            notes: 'Email extras din câmpul istoric de date al companiei',
          });
        } else if (webCheck.detectedType === 'MOBILE' || webCheck.detectedType === 'LANDLINE') {
          allDiscovered.push({
            cui,
            contactType: webCheck.detectedType,
            originalValue: candidateUrl,
            normalizedValue: webCheck.normalized,
            label: 'COMMERCIAL',
            sourceName: 'HISTORICAL_REGISTRY',
            provenanceUrl: 'data/radar_business.db',
            verificationMethod: 'REGISTRY_FIELD_EXTRACTION',
            verificationStatus: 'DECLARED_BY_COMPANY',
            confidenceScore: 0.85,
            notes: 'Număr de telefon extras din câmpul istoric de date al companiei',
          });
        } else if (webCheck.detectedType === 'WEBSITE') {
          // Valid candidate website
          sourcesChecked.push('OFFICIAL_WEBSITE');
          try {
            const scrapeRes = await WebsiteContactScraper.scrapeWebsite(cui, webCheck.normalized, companyName);
            if (scrapeRes.isReachable) {
              validatedWebsite = scrapeRes.url;
              allDiscovered.push({
                cui,
                contactType: 'WEBSITE',
                originalValue: candidateUrl,
                normalizedValue: scrapeRes.url,
                label: 'OFFICE',
                sourceName: 'OFFICIAL_WEBSITE',
                provenanceUrl: scrapeRes.url,
                verificationMethod: 'HTTP_VERIFICATION',
                verificationStatus: 'OFFICIAL_WEBSITE',
                confidenceScore: 0.95,
                notes: 'Domeniu oficial verificat activ prin HTTP GET',
              });

              if (scrapeRes.contacts.length > 0) {
                allDiscovered.push(...scrapeRes.contacts);
              }
            } else {
              errors.push(`Website inaccesibil: ${scrapeRes.error || 'Timeout'}`);
            }
          } catch (err: any) {
            errors.push(`Website scraping error: ${err.message || 'Eroare conexiune'}`);
          }
        }
      }
    }

    // 5. Persist contacts in DB with strict provenance & deduplication
    for (const contact of allDiscovered) {
      // Check suppression for specific email/phone
      if (await this.isSuppressed(cui, contact.normalizedValue, contact.normalizedValue)) {
        continue;
      }

      // Check existing record
      const existing = await queryOne(
        `SELECT id, confidence_score, verification_status FROM contact_records 
         WHERE cui = ? AND contact_type = ? AND (normalized_value = ? OR contact_value = ?)`,
        [cui, contact.contactType, contact.normalizedValue, contact.normalizedValue]
      );

      if (existing) {
        // Only update if confidence score is >= existing
        if (contact.confidenceScore >= (existing.confidence_score || 0)) {
          await executeRun(
            `UPDATE contact_records SET
               verification_status = ?,
               confidence_score = MAX(confidence_score, ?),
               last_checked_at = CURRENT_TIMESTAMP,
               source_name = COALESCE(?, source_name),
               provenance_url = COALESCE(?, provenance_url),
               notes = COALESCE(?, notes)
             WHERE id = ?`,
            [
              contact.verificationStatus,
              contact.confidenceScore,
              contact.sourceName,
              contact.provenanceUrl || null,
              contact.notes || null,
              existing.id,
            ]
          );
        }
      } else {
        // Insert new record
        await executeRun(
          `INSERT INTO contact_records (
             cui, contact_type, contact_value, normalized_value, label,
             source_name, provenance_url, verification_method, verification_status,
             confidence_score, contact_person, contact_person_position, notes,
             discovered_at, last_checked_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            cui,
            contact.contactType,
            contact.originalValue,
            contact.normalizedValue,
            contact.label || 'OFFICE',
            contact.sourceName,
            contact.provenanceUrl || null,
            contact.verificationMethod,
            contact.verificationStatus,
            contact.confidenceScore,
            contact.contactPerson || null,
            contact.contactPersonPosition || null,
            contact.notes || null,
          ]
        );
      }
    }

    // 6. Update company record timestamps & validated website
    if (validatedWebsite) {
      await executeRun(
        `UPDATE companies SET 
           website = ?,
           last_verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE cui = ?`,
        [validatedWebsite, cui]
      );
    } else {
      await executeRun(
        `UPDATE companies SET 
           last_verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE cui = ?`,
        [cui]
      );
    }

    // 7. Audit log
    await logAuditEvent({
      action: 'COMPANY_ENRICHMENT_RUN',
      details: {
        cui,
        companyName,
        contactsDiscovered: allDiscovered.length,
        sourcesChecked,
        errors,
      },
      actor: 'myremaxclubcristianv@gmail.com',
    });

    return {
      cui,
      companyName,
      success: errors.length === 0 || allDiscovered.length > 0,
      contactsDiscovered: allDiscovered,
      websiteDiscovered: validatedWebsite,
      taxStatus: taxResult,
      errors,
      sourcesChecked,
    };
  }

  /**
   * Starts a batch enrichment operation.
   */
  static async startBatch(
    cuis?: number[],
    options: { batchSize?: number; limit?: number } = {}
  ): Promise<EnrichmentProgress> {
    stopRequested = false;

    let targetCuis: number[] = [];
    if (cuis && cuis.length > 0) {
      targetCuis = cuis;
    } else {
      // Find companies that haven't been verified recently or have 0 contacts
      const rows = await queryAll<{ cui: number }>(
        `SELECT c.cui FROM companies c
         LEFT JOIN contact_records cr ON c.cui = cr.cui
         WHERE cr.id IS NULL OR c.last_verified_at IS NULL
         GROUP BY c.cui
         ORDER BY c.opportunity_score DESC
         LIMIT ?`,
        [options.limit || 50]
      );
      targetCuis = rows.map((r) => r.cui);
    }

    activeProgress = {
      total: targetCuis.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      contactsFound: {
        mobile: 0,
        landline: 0,
        email: 0,
        website: 0,
      },
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
    };

    const batchSize = options.batchSize || 5;

    // Run asynchronously in chunks
    (async () => {
      for (let i = 0; i < targetCuis.length; i += batchSize) {
        if (stopRequested) {
          if (activeProgress) activeProgress.status = 'PAUSED';
          break;
        }

        const chunk = targetCuis.slice(i, i + batchSize);
        for (const cui of chunk) {
          if (stopRequested) break;

          try {
            if (activeProgress) activeProgress.currentCui = cui;
            const res = await this.enrichCompany(cui);

            if (activeProgress) {
              activeProgress.processed++;
              if (res.success && res.contactsDiscovered.length > 0) {
                activeProgress.successful++;
                for (const c of res.contactsDiscovered) {
                  if (c.contactType === 'MOBILE') activeProgress.contactsFound.mobile++;
                  else if (c.contactType === 'LANDLINE') activeProgress.contactsFound.landline++;
                  else if (c.contactType === 'EMAIL') activeProgress.contactsFound.email++;
                  else if (c.contactType === 'WEBSITE') activeProgress.contactsFound.website++;
                }
              } else if (res.errors.length > 0 && res.contactsDiscovered.length === 0) {
                activeProgress.failed++;
              } else {
                activeProgress.skipped++;
              }
            }
          } catch (err: any) {
            if (activeProgress) {
              activeProgress.processed++;
              activeProgress.failed++;
            }
          }

          // Polite pause between requests to respect external endpoints
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      if (activeProgress && !stopRequested) {
        activeProgress.status = 'COMPLETED';
        activeProgress.finishedAt = new Date().toISOString();
      }
    })();

    return activeProgress;
  }

  /**
   * Returns the current progress of the enrichment job.
   */
  static getProgress(): EnrichmentProgress {
    if (!activeProgress) {
      return {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        contactsFound: { mobile: 0, landline: 0, email: 0, website: 0 },
        status: 'IDLE',
      };
    }
    return activeProgress;
  }

  /**
   * Request stopping the current job.
   */
  static stopJob(): void {
    stopRequested = true;
    if (activeProgress) {
      activeProgress.status = 'PAUSED';
    }
  }
}
