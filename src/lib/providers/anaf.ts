import { CompanyDataProvider, REGISTERED_PROVIDERS, SourceMetadata, ProviderCapability } from './index';

export interface AnafCompanyResult {
  cui: number;
  data: string;
  denumire: string;
  adresa: string;
  nrRegCom: string;
  telefon?: string;
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
  private fallbackEndpoint = 'https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva';

  async testConnection(): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const start = Date.now();
    try {
      // Test with a sample CUI (e.g. 14399840)
      const res = await this.fetchBatchTaxStatus([14399840]);
      const latencyMs = Date.now() - start;
      if (res.length > 0) {
        return { success: true, latencyMs, message: 'Serviciu ANAF PlatitorTvaRest operațional' };
      }
      return { success: true, latencyMs, message: 'Serviciul a răspuns dar nu a returnat date' };
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - start, message: err.message || 'Eroare conexiune ANAF' };
    }
  }

  async fetchBatchTaxStatus(cuis: number[], queryDate?: string): Promise<AnafCompanyResult[]> {
    if (!cuis || cuis.length === 0) return [];

    const dateStr = queryDate || new Date().toISOString().slice(0, 10);
    const payload = cuis.map(cui => ({ cui, data: dateStr }));

    try {
      const res = await fetch(this.anafEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RadarBusinessRomania/1.0 (B2B Insurance Intelligence)',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`ANAF API HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json() as any;
      if (data.cod !== 200 && data.cod !== '200') {
        throw new Error(`ANAF API returned code ${data.cod}: ${data.message || ''}`);
      }

      const results: AnafCompanyResult[] = [];
      const foundList = data.found || [];

      for (const item of foundList) {
        const dg = item.date_generale || {};
        const tva = item.inregistrare_scop_Tva || {};
        const inactiv = item.stare_inactiv || {};
        const split = item.inregistrare_SplitTVA || {};
        const tvaInc = item.inregistrare_RTVAI || {};
        const dom = item.adresa_domiciliu_fiscal || {};

        results.push({
          cui: dg.cui,
          data: dg.data,
          denumire: dg.denumire,
          adresa: dg.adresa,
          nrRegCom: dg.nrRegCom,
          telefon: dg.telefon,
          codPostal: dg.codPostal,
          stare_inregistrare: dg.stare_inregistrare,
          dataInregistrare: dg.data_inregistrare,
          cod_CAEN: dg.cod_CAEN,
          iban: dg.iban,
          statusRO_e_Factura: Boolean(dg.statusRO_e_Factura),
          scpTVA: Boolean(tva.scpTVA),
          perioadaTvaStart: tva.perioade_TVA?.[0]?.data_inceput_ScpTVA,
          perioadaTvaEnd: tva.perioade_TVA?.[0]?.data_sfarsit_ScpTVA,
          statusTvaIncasare: Boolean(tvaInc.statusTvaIncasare),
          statusInactivi: Boolean(inactiv.statusInactivi),
          dataInactivare: inactiv.dataInactivare,
          dataReactivare: inactiv.dataReactivare,
          statusSplitTVA: Boolean(split.statusSplitTVA),
          domiciliuFiscal: dom.ddenumire_Strada ? `${dom.ddenumire_Strada} nr. ${dom.dnumar_Strada || ''}, ${dom.ddenumire_Localitate || ''}, ${dom.ddenumire_Judet || ''}` : undefined,
        });
      }

      return results;
    } catch (err: any) {
      console.warn(`[AnafTaxConnector] Error: ${err.message}`);
      throw err;
    }
  }
}

export const anafConnector = new AnafTaxConnector();
