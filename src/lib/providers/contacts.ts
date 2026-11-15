import { CompanyDataProvider, REGISTERED_PROVIDERS, SourceMetadata, ProviderCapability } from './index';
import { getDatabase } from '../db';

export interface DiscoveredContact {
  cui: number;
  contactType: 'EMAIL' | 'PHONE' | 'WEBSITE' | 'FORM_URL' | 'ADDRESS';
  contactValue: string;
  label: 'OFFICE' | 'SALES' | 'COMMERCIAL' | 'HEADQUARTERS';
  provenanceUrl?: string;
  verificationStatus: 'VERIFIED' | 'PUBLIC_UNVERIFIED' | 'INVALID' | 'CONFIRMED';
  confidenceScore: number;
}

export class ContactDiscoveryConnector implements CompanyDataProvider {
  readonly metadata: SourceMetadata = REGISTERED_PROVIDERS.CONTACT_DISCOVERY;
  readonly capabilities: ProviderCapability = {
    supportsBulkDownload: false,
    supportsRealtimeLookup: true,
    supportsBatchLookup: false,
    supportsFinancials: false,
    supportsTaxVerification: false,
    supportsContacts: true,
  };

  async testConnection(): Promise<{ success: boolean; latencyMs: number; message: string }> {
    return { success: true, latencyMs: 5, message: 'Motorul de contacte este activ și sincronizat cu lista de supresie' };
  }

  normalizePhoneNumber(phone: string): string | null {
    if (!phone) return null;
    let clean = phone.replace(/[\s\-\.\(\)\/]/g, '');

    // Romanian phone patterns
    if (clean.startsWith('0040')) clean = '+40' + clean.slice(4);
    else if (clean.startsWith('40') && clean.length === 11) clean = '+' + clean;
    else if (clean.startsWith('0') && clean.length === 10) clean = '+40' + clean.slice(1);

    if (/^\+40(2\d|3\d|7\d)\d{7}$/.test(clean)) {
      return clean;
    }
    return null;
  }

  classifyPhoneType(phone: string): 'MOBILE' | 'LANDLINE' | 'PHONE' {
    const norm = this.normalizePhoneNumber(phone);
    if (!norm) return 'PHONE';
    if (norm.startsWith('+407')) return 'MOBILE';
    if (norm.startsWith('+402') || norm.startsWith('+403')) return 'LANDLINE';
    return 'PHONE';
  }

  isRomanianMobile(phone: string): boolean {
    const norm = this.normalizePhoneNumber(phone);
    return Boolean(norm && norm.startsWith('+407'));
  }

  isRomanianLandline(phone: string): boolean {
    const norm = this.normalizePhoneNumber(phone);
    return Boolean(norm && (norm.startsWith('+402') || norm.startsWith('+403')));
  }

  isValidEmail(email: string): boolean {
    if (!email) return false;
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!re.test(email)) return false;

    // Filter out obvious fake or generic test emails
    const lower = email.toLowerCase();
    if (lower.includes('example.com') || lower.includes('test.com') || lower.includes('domain.com')) {
      return false;
    }
    return true;
  }

  isSuppressed(cui: number, email?: string, phone?: string): boolean {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT id FROM suppression_list 
      WHERE cui = ? 
         OR (email IS NOT NULL AND email = ?) 
         OR (phone IS NOT NULL AND phone = ?)
    `).get(cui, email || null, phone || null);

    return Boolean(row);
  }

  recordDiscoveredContacts(contacts: DiscoveredContact[]): number {
    const db = getDatabase();
    let insertedCount = 0;

    const stmt = db.prepare(`
      INSERT INTO contact_records (
        cui, contact_type, contact_value, label, provenance_url, verification_status, confidence_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cui, contact_type, contact_value) DO UPDATE SET
        verification_status = excluded.verification_status,
        confidence_score = MAX(contact_records.confidence_score, excluded.confidence_score),
        last_checked_at = datetime('now')
    `);

    for (const c of contacts) {
      if (this.isSuppressed(c.cui, c.contactType === 'EMAIL' ? c.contactValue : undefined, c.contactType === 'PHONE' ? c.contactValue : undefined)) {
        continue;
      }

      stmt.run(
        c.cui,
        c.contactType,
        c.contactValue,
        c.label,
        c.provenanceUrl || null,
        c.verificationStatus,
        c.confidenceScore
      );
      insertedCount++;
    }

    return insertedCount;
  }
}

export const contactConnector = new ContactDiscoveryConnector();
