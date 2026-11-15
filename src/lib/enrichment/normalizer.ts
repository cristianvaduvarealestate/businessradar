import { ContactType } from './types';

export class ContactNormalizer {
  /**
   * Normalizes Romanian phone numbers into E.164 (+40...) format.
   * Recognizes Bucharest old 01 prefix (mapped to +4021...).
   */
  static normalizePhone(input: string): {
    normalized: string;
    type: 'MOBILE' | 'LANDLINE' | 'PHONE';
  } | null {
    if (!input) return null;
    let clean = input.trim().replace(/[\s\-\.\(\)\/]/g, '');

    // Strip leading '+' or '00'
    if (clean.startsWith('0040')) clean = '+40' + clean.slice(4);
    else if (clean.startsWith('40') && clean.length >= 11) clean = '+' + clean;
    else if (clean.startsWith('+40')) {
      // already has +40
    } else if (clean.startsWith('01') && clean.length === 9) {
      // Old Bucharest prefix: 01xxxxxxx -> +4021xxxxxxx
      clean = '+4021' + clean.slice(2);
    } else if (clean.startsWith('0') && clean.length === 10) {
      clean = '+40' + clean.slice(1);
    }

    // Validate Romanian standard numbers (+40 followed by 9 digits)
    if (!/^\+40[237]\d{8}$/.test(clean)) {
      // Also support 10 digit landlines if area code was matched
      return null;
    }

    let type: 'MOBILE' | 'LANDLINE' | 'PHONE' = 'PHONE';
    if (clean.startsWith('+407')) {
      type = 'MOBILE';
    } else if (clean.startsWith('+402') || clean.startsWith('+403')) {
      type = 'LANDLINE';
    }

    return { normalized: clean, type };
  }

  /**
   * Validates and cleans email addresses.
   */
  static normalizeEmail(input: string): string | null {
    if (!input) return null;
    let clean = input.trim().toLowerCase();

    // Strip 'mailto:' if present
    if (clean.startsWith('mailto:')) {
      clean = clean.slice(7).trim();
    }

    // Check for malformed emails like 'www.ofice@algida.ro' or 'www.office@...'
    if (clean.startsWith('www.')) {
      const parts = clean.split('@');
      if (parts.length === 2) {
        let userPart = parts[0].replace(/^www\./, '');
        if (userPart === 'ofice') userPart = 'office';
        clean = `${userPart}@${parts[1]}`;
      }
    }

    // Regex check
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    if (!emailRegex.test(clean)) return null;

    // Filter out blacklisted/generic dummy domains
    const blacklisted = [
      'example.com',
      'domain.com',
      'test.com',
      'sentry.io',
      'schema.org',
      'w3.org',
      'wordpress.org',
      'wix.com',
    ];
    if (blacklisted.some((b) => clean.includes(b))) {
      return null;
    }

    return clean;
  }

  /**
   * Validates and cleans website URLs.
   * Detects if the value is accidentally an email or phone number.
   */
  static normalizeWebsite(input: string): {
    normalized: string;
    detectedType: ContactType;
  } | null {
    if (!input) return null;
    let clean = input.trim();

    // 1. Check if it's accidentally a phone number (e.g. '0744700293')
    const phoneCheck = this.normalizePhone(clean);
    if (phoneCheck) {
      return {
        normalized: phoneCheck.normalized,
        detectedType: phoneCheck.type === 'MOBILE' ? 'MOBILE' : 'LANDLINE',
      };
    }

    // 2. Check if it contains an '@' (accidentally an email)
    if (clean.includes('@')) {
      const emailCheck = this.normalizeEmail(clean);
      if (emailCheck) {
        return {
          normalized: emailCheck,
          detectedType: 'EMAIL',
        };
      }
    }

    // 3. Normalize website URL
    let url = clean.toLowerCase();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      if (!hostname.includes('.')) return null;
      // Strip trailing slash for base domain
      const normalized = `${parsed.protocol}//${hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
      return {
        normalized,
        detectedType: 'WEBSITE',
      };
    } catch {
      return null;
    }
  }

  /**
   * Format normalized Romanian phone for user-facing display.
   * e.g. +40744700293 -> 0744 700 293
   *      +40264266111 -> 0264 266 111
   */
  static formatDisplayPhone(e164: string): string {
    if (!e164 || !e164.startsWith('+40')) return e164;
    const local = '0' + e164.slice(3);
    if (local.length === 10) {
      return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
    }
    return local;
  }
}
