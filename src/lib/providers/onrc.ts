import { CompanyDataProvider, REGISTERED_PROVIDERS, SourceMetadata, ProviderCapability } from './index';

export interface OnrcPackageSummary {
  id: string;
  name: string;
  title: string;
  metadataModified: string;
  resources: Array<{
    id: string;
    name: string;
    format: string;
    size?: number;
    url: string;
  }>;
}

export class OnrcCkanConnector implements CompanyDataProvider {
  readonly metadata: SourceMetadata = REGISTERED_PROVIDERS.ONRC_DATA_GOV;
  readonly capabilities: ProviderCapability = {
    supportsBulkDownload: true,
    supportsRealtimeLookup: false,
    supportsBatchLookup: false,
    supportsFinancials: false,
    supportsTaxVerification: false,
    supportsContacts: true,
  };

  private ckanBaseUrl: string = 'https://data.gov.ro/api/3/action';

  async testConnection(): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.ckanBaseUrl}/site_read`, {
        headers: { 'User-Agent': 'RadarBusinessRomania/1.0' },
      });
      const latencyMs = Date.now() - start;
      const data = await res.json() as { success: boolean };
      if (data.success) {
        return { success: true, latencyMs, message: 'Conexiune reușită la API-ul data.gov.ro' };
      }
      return { success: false, latencyMs, message: 'Răspuns invalid de la serverul data.gov.ro' };
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - start, message: err.message || 'Eroare conexiune data.gov.ro' };
    }
  }

  async discoverLatestCompanyDatasets(): Promise<OnrcPackageSummary[]> {
    const url = `${this.ckanBaseUrl}/package_search?q=onrc&rows=20`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RadarBusinessRomania/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} de la data.gov.ro`);
    const json = await res.json() as { success: boolean; result: { results: any[] } };
    if (!json.success) throw new Error('Eroare în interogarea CKAN data.gov.ro');

    return json.result.results.map((p: any) => ({
      id: p.id,
      name: p.name,
      title: p.title,
      metadataModified: p.metadata_modified,
      resources: (p.resources || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        format: r.format,
        size: r.size ? parseInt(r.size, 10) : undefined,
        url: r.url,
      })),
    }));
  }

  parseCsvLine(line: string, delimiter: string = '^'): string[] {
    return line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
  }
}

export const onrcConnector = new OnrcCkanConnector();
