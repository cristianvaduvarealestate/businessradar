import { ContactNormalizer } from './normalizer';
import { DiscoveredContactItem } from './types';

export interface WebsiteScrapeResult {
  url: string;
  isReachable: boolean;
  contacts: DiscoveredContactItem[];
  pagesScraped: string[];
  mentionsCui: boolean;
  mentionsCompanyName: boolean;
  error?: string;
}

export class WebsiteContactScraper {
  /**
   * Scrapes an official or candidate website for publicly published contacts.
   */
  static async scrapeWebsite(
    cui: number,
    rawUrl: string,
    companyName?: string
  ): Promise<WebsiteScrapeResult> {
    const normWeb = ContactNormalizer.normalizeWebsite(rawUrl);
    if (!normWeb || normWeb.detectedType !== 'WEBSITE') {
      return {
        url: rawUrl,
        isReachable: false,
        contacts: [],
        pagesScraped: [],
        mentionsCui: false,
        mentionsCompanyName: false,
        error: 'URL invalid sau neconform',
      };
    }

    const baseUrl = normWeb.normalized;
    const pagesScraped: string[] = [];
    const discovered: DiscoveredContactItem[] = [];
    let mentionsCui = false;
    let mentionsCompanyName = false;

    // Helper to fetch and extract contacts from an HTML string
    const parseHtmlContacts = (html: string, pageUrl: string) => {
      pagesScraped.push(pageUrl);

      // Check CUI mention
      if (html.includes(String(cui))) {
        mentionsCui = true;
      }
      if (companyName && html.toLowerCase().includes(companyName.toLowerCase().slice(0, 8))) {
        mentionsCompanyName = true;
      }

      // 1. Extract Emails
      const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const rawEmail of emailMatches) {
        const normEmail = ContactNormalizer.normalizeEmail(rawEmail);
        if (normEmail) {
          discovered.push({
            cui,
            contactType: 'EMAIL',
            originalValue: rawEmail,
            normalizedValue: normEmail,
            label: normEmail.includes('sales') || normEmail.includes('vanzari') ? 'SALES' : 'OFFICE',
            sourceName: 'OFFICIAL_WEBSITE',
            provenanceUrl: pageUrl,
            verificationMethod: 'HTML_SCRAPE_OFFICIAL_DOMAIN',
            verificationStatus: 'OFFICIAL_WEBSITE',
            confidenceScore: 0.9,
            notes: `Adresă de email identificată pe pagina oficială ${pageUrl}`,
          });
        }
      }

      // 2. Extract Phones
      const phoneMatches = html.match(/(?:\+40|0)[237][0-9\s\.\-\/]{7,13}[0-9]/g) || [];
      for (const rawPhone of phoneMatches) {
        const normPhone = ContactNormalizer.normalizePhone(rawPhone);
        if (normPhone) {
          discovered.push({
            cui,
            contactType: normPhone.type,
            originalValue: rawPhone.trim(),
            normalizedValue: normPhone.normalized,
            label: normPhone.type === 'MOBILE' ? 'COMMERCIAL' : 'OFFICE',
            sourceName: 'OFFICIAL_WEBSITE',
            provenanceUrl: pageUrl,
            verificationMethod: 'HTML_SCRAPE_OFFICIAL_DOMAIN',
            verificationStatus: 'OFFICIAL_WEBSITE',
            confidenceScore: 0.9,
            notes: `Număr de ${normPhone.type === 'MOBILE' ? 'mobil' : 'telefon fix'} identificat pe site-ul oficial`,
          });
        }
      }

      // 3. Extract Contact Form URL
      if (pageUrl.toLowerCase().includes('contact')) {
        discovered.push({
          cui,
          contactType: 'CONTACT_FORM',
          originalValue: pageUrl,
          normalizedValue: pageUrl,
          label: 'OFFICE',
          sourceName: 'OFFICIAL_WEBSITE',
          provenanceUrl: pageUrl,
          verificationMethod: 'PAGE_DISCOVERY',
          verificationStatus: 'OFFICIAL_WEBSITE',
          confidenceScore: 0.85,
          notes: 'Pagină cu formular de contact identificată',
        });
      }
    };

    try {
      // 1. Fetch Homepage
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RadarBusinessProspector/2.0; +https://businessradar.cristianvaduva.com)',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          url: baseUrl,
          isReachable: false,
          contacts: [],
          pagesScraped,
          mentionsCui,
          mentionsCompanyName,
          error: `HTTP ${res.status}`,
        };
      }

      const homeHtml = await res.text();
      parseHtmlContacts(homeHtml, baseUrl);

      // 2. Identify candidate contact links
      const linkRegex = /href=["']([^"']+)["']/gi;
      let match;
      const candidateContactLinks: string[] = [];

      while ((match = linkRegex.exec(homeHtml)) !== null) {
        const link = match[1];
        const lower = link.toLowerCase();
        if (
          lower.includes('contact') ||
          lower.includes('despre') ||
          lower.includes('about') ||
          lower.includes('echipa')
        ) {
          try {
            const resolved = new URL(link, baseUrl).toString();
            if (resolved.startsWith(baseUrl) && !candidateContactLinks.includes(resolved)) {
              candidateContactLinks.push(resolved);
            }
          } catch {
            // ignore invalid URL
          }
        }
      }

      // 3. Fetch up to 2 contact subpages
      for (const contactUrl of candidateContactLinks.slice(0, 2)) {
        if (pagesScraped.includes(contactUrl)) continue;
        try {
          const subController = new AbortController();
          const subTimeout = setTimeout(() => subController.abort(), 6000);
          const subRes = await fetch(contactUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; RadarBusinessProspector/2.0)',
            },
            signal: subController.signal,
          });
          clearTimeout(subTimeout);

          if (subRes.ok) {
            const subHtml = await subRes.text();
            parseHtmlContacts(subHtml, contactUrl);
          }
        } catch {
          // ignore single page failure
        }
      }

      // Deduplicate discovered contacts
      const uniqueMap = new Map<string, DiscoveredContactItem>();
      for (const item of discovered) {
        const key = `${item.contactType}:${item.normalizedValue}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      }

      return {
        url: baseUrl,
        isReachable: true,
        contacts: Array.from(uniqueMap.values()),
        pagesScraped,
        mentionsCui,
        mentionsCompanyName,
      };
    } catch (err: any) {
      return {
        url: baseUrl,
        isReachable: false,
        contacts: [],
        pagesScraped,
        mentionsCui,
        mentionsCompanyName,
        error: err.message || 'Eroare conexiune',
      };
    }
  }
}
