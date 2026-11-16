import { CompanyDataProvider, REGISTERED_PROVIDERS, SourceMetadata, ProviderCapability } from './index';
import { ContactNormalizer } from '../enrichment/normalizer';
import { DiscoveredContactItem } from '../enrichment/types';

export interface AnafCompanyResult {
  cui: number;
  data: string;
  denumire: string;
  adresa: string;
  nrRegCom: string;
  telefon?: string;
  fax?: string;
  codPostal?: string;
  stare_inregistrare?: string;
  dataInregistrare?: string;
  cod_CAEN?: string;
  iban?: string;
  statusRO_e_Factura: boolean;
  scpTVA: boolean;
  perioadaTvaStart?: string;
  perioadaTvaEnd?: string;
  statusTvaIncasare: boolean;
  statusInactivi: boolean;
  dataInactivare?: string;
  dataReactivare?: string;
  statusSplitTVA: boolean;
  domiciliuFiscal?: string;
  discoveredContacts: DiscoveredContactItem[];
}

export class AnafTaxConnector implements CompanyDataProvider {
  readonly metadata: SourceMetadata = REGISTERED_PROVIDERS.ANAF_TVA_REST;
  readonly capabilities: ProviderCapability = {
    supportsBulkDownload: false,
    supportsRealtimeLookup: true,
    supportsBatchLookup: true,
    supportsFinancials: false,
    supportsTaxVerification: true,
    supportsContacts: true,
  };

  private anafEndpoint = 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva';

  async testConnection(): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const start = Date.now();
    try {
      const res = await this.fetchBatchTaxStatus([15433290]);
      const latencyMs = Date.now() - start;
      if (res.length > 0) {
        return {
          success: true,
          latencyMs,
          message: 'Serviciu ANAF PlatitorTvaRest v9 operațional (date fiscale & contacte declarate)',
        };
      }
      return { success: true, latencyMs, message: 'Serviciul a răspuns dar nu a returnat date' };
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - start, message: err.message || 'Eroare conexiune ANAF' };
    }
  }

  async fetchBatchTaxStatus(cuis: number[], queryDate?: string): Promise<AnafCompanyResult[]> {
    if (!cuis || cuis.length === 0) return [];

    const dateStr = queryDate || new Date().toISOString().slice(0, 10);
    const payload = cuis.map((cui) => ({ cui, data: dateStr }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const res = await fetch(this.anafEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RadarBusinessRomania/2.0 (B2B Insurance Intelligence; Contact Discovery Engine)',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`ANAF API HTTP ${res.status}: ${res.statusText}`);
      }

      const data = (await res.json()) as any;
      const results: AnafCompanyResult[] = [];
      const foundList = data.found || [];

      for (const item of foundList) {
        const dg = item.date_generale || {};
        const tva = item.inregistrare_scop_Tva || {};
        const inactiv = item.stare_inactiv || {};
        const split = item.inregistrare_SplitTVA || {};
        const tvaInc = item.inregistrare_RTVAI || {};
        const dom = item.adresa_domiciliu_fiscal || {};

        const discoveredContacts: DiscoveredContactItem[] = [];

        // Check declared phone
        if (dg.telefon && typeof dg.telefon === 'string' && dg.telefon.trim()) {
          const rawTel = dg.telefon.trim();
          const norm = ContactNormalizer.normalizePhone(rawTel);
          if (norm) {
            discoveredContacts.push({
              cui: dg.cui,
              contactType: norm.type,
              originalValue: rawTel,
              normalizedValue: norm.normalized,
              label: 'OFFICE',
              sourceName: 'ANAF_OPEN_DATA',
              provenanceUrl: 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva',
              verificationMethod: 'REGISTRY_QUERY_MATCH',
              verificationStatus: 'DECLARED_BY_COMPANY',
              confidenceScore: 0.85,
              notes: 'Telefon oficial declarat în evidențele fiscale ANAF',
            });
          }
        }

        // Check declared fax if different
        if (dg.fax && typeof dg.fax === 'string' && dg.fax.trim()) {
          const rawFax = dg.fax.trim();
          const normFax = ContactNormalizer.normalizePhone(rawFax);
          if (normFax && (!dg.telefon || dg.fax.trim() !== dg.telefon.trim())) {
            discoveredContacts.push({
              cui: dg.cui,
              contactType: 'LANDLINE',
              originalValue: rawFax,
              normalizedValue: normFax.normalized,
              label: 'OFFICE',
              sourceName: 'ANAF_OPEN_DATA',
              provenanceUrl: 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva',
              verificationMethod: 'REGISTRY_QUERY_MATCH',
              verificationStatus: 'DECLARED_BY_COMPANY',
              confidenceScore: 0.75,
              notes: 'Fax/linie secundară declarată în evidențele fiscale ANAF',
            });
          }
        }

        results.push({
          cui: dg.cui,
          data: dg.data,
          denumire: dg.denumire,
          adresa: dg.adresa,
          nrRegCom: dg.nrRegCom,
          telefon: dg.telefon,
          fax: dg.fax,
          codPostal: dg.codPostal,
          stare_inregistrare: dg.stare_inregistrare,
          dataInregistrare: dg.data_inregistrare,
          cod_CAEN: dg.cod_CAEN,
          iban: dg.iban,
          statusRO_e_Factura: Boolean(dg.statusRO_e_Factura),
          scpTVA: Boolean(tva.scpTVA),
          statusTvaIncasare: Boolean(tvaInc.statusTvaIncasare),
          statusInactivi: Boolean(inactiv.statusInactivi),
          dataInactivare: inactiv.dataInactivare,
          dataReactivare: inactiv.dataReactivare,
          statusSplitTVA: Boolean(split.statusSplitTVA),
          domiciliuFiscal: dom.ddenumire_Localitate
            ? `${dom.ddenumire_Strada || ''} ${dom.dnumar_Strada || ''}, ${dom.ddenumire_Localitate}, ${dom.ddenumire_Judet || ''}`.trim()
            : undefined,
          discoveredContacts,
        });
      }

      return results;
    } catch (err: any) {
      throw new Error(`ANAF API error: ${err.message || 'Necunoscută'}`);
    }
  }
}

export const anafConnector = new AnafTaxConnector();

