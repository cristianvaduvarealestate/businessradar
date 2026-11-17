/**
 * NATIONAL TO OPERATIONAL PROMOTER
 * Safely promotes a company from the National Dataset into the Operational CRM workspace.
 * Prevents duplicate CUI identities and triggers automated ANAF verification.
 */

import { queryOne, executeRun } from '@/lib/db';
import { NationalDatabase } from './db';
import { NationalCompany } from './types';
import { anafConnector } from '@/lib/providers/anaf';

export interface PromotionResult {
  success: boolean;
  action: 'ALREADY_EXISTS' | 'PROMOTED_NEW';
  cui: number;
  companyId?: number;
  name: string;
  classification?: string;
  anafVerified: boolean;
  message: string;
}

export class NationalCompanyPromoter {
  /**
   * Promote a national company into the operational workspace
   */
  static async promoteToOperational(cui: number, options?: { autoVerifyAnaf?: boolean }): Promise<PromotionResult> {
    if (!cui || cui <= 0) {
      return {
        success: false,
        action: 'ALREADY_EXISTS',
        cui,
        name: '',
        anafVerified: false,
        message: 'CUI invalid pentru promovare.',
      };
    }

    // 1. Check if company already exists in operational D1 / companies
    const existing = await queryOne<{ id: number; cui: number; name: string; classification: string }>(
      'SELECT id, cui, name, classification FROM companies WHERE cui = ?',
      [cui]
    );

    if (existing) {
      return {
        success: true,
        action: 'ALREADY_EXISTS',
        cui: existing.cui,
        companyId: existing.id,
        name: existing.name,
        classification: existing.classification,
        anafVerified: false,
        message: 'Compania există deja în baza de date operațională.',
      };
    }

    // 2. Retrieve national company record from National Database
    const nat = NationalDatabase.getByCui(cui);
    if (!nat) {
      return {
        success: false,
        action: 'ALREADY_EXISTS',
        cui,
        name: '',
        anafVerified: false,
        message: 'Compania nu a fost găsită în Baza Națională de Date.',
      };
    }

    // 3. Insert into operational companies table
    const normalizedName = (nat.name || '').toUpperCase().trim();
    const primaryCaen = nat.primary_caen || '7022';
    const caenDesc = nat.caen_description || 'Activități de consultanță pentru afaceri și management';

    const insertResult = await executeRun(
      `INSERT INTO companies (
        cui, name, normalized_name, reg_com, euid, legal_form,
        incorporation_date, registration_date, country, county, city,
        street, postal_code, status, legal_status, fiscal_status,
        primary_caen, caen_description, classification, verification_state,
        discovery_source, first_observed_at, last_observed_at, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, 'ACTIVE', ?, 'UNKNOWN',
        ?, ?, 'HISTORICAL', 'DISCOVERED',
        'NATIONAL_DATABASE_PROMOTION', datetime('now'), datetime('now'), datetime('now'), datetime('now')
      )`,
      [
        nat.cui,
        nat.name,
        normalizedName,
        nat.reg_com || null,
        nat.euid || null,
        nat.legal_form || 'SRL',
        nat.registration_date || null,
        nat.registration_date || null,
        nat.country || 'România',
        nat.county || null,
        nat.city || null,
        nat.street || null,
        nat.postal_code || null,
        nat.legal_status || 'ACTIVE',
        primaryCaen,
        caenDesc,
      ]
    );

    const newCompanyId = insertResult?.lastInsertRowid || undefined;

    // 4. Staged ANAF verification if requested
    let anafVerified = false;
    if (options?.autoVerifyAnaf) {
      try {
        const anafBatch = await anafConnector.fetchBatchTaxStatus([cui]);
        if (anafBatch && anafBatch.length > 0) {
          const item = anafBatch[0];
          anafVerified = true;
          const fiscalStatus = item.statusInactivi ? 'FISCALLY_INACTIVE' : 'FISCALLY_ACTIVE';
          await executeRun(
            `UPDATE companies SET 
              fiscal_status = ?,
              last_status_check_at = datetime('now')
             WHERE cui = ?`,
            [fiscalStatus, cui]
          );
        }
      } catch (e: any) {
        console.warn(`Auto-ANAF lookup failed for promoted CUI ${cui}:`, e.message);
      }
    }

    return {
      success: true,
      action: 'PROMOTED_NEW',
      cui,
      companyId: newCompanyId,
      name: nat.name,
      classification: 'HISTORICAL',
      anafVerified,
      message: `Compania ${nat.name} (CUI ${cui}) a fost promovată cu succes în workspace-ul operațional.`,
    };
  }
}
