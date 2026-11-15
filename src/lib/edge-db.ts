import snapshotData from './data-snapshot.json';

interface Snapshot {
  companies: any[];
  contact_records: any[];
  insurance_opportunities: any[];
  tax_records: any[];
  financial_records: any[];
  prospect_pipeline: any[];
  suppression_list: any[];
  ingestion_jobs: any[];
  audit_log: any[];
  company_secondary_caen: any[];
}

const data: Snapshot = snapshotData as Snapshot;

// Pre-index by CUI for fast O(1) lookups
const companyByCui = new Map<number, any>();
const contactsByCui = new Map<number, any[]>();
const oppsByCui = new Map<number, any[]>();
const pipelineByCui = new Map<number, any>();
const taxByCui = new Map<number, any>();
const financialsByCui = new Map<number, any[]>();
const secondaryCaenByCui = new Map<number, any[]>();
const auditByCui = new Map<number, any[]>();

for (const c of data.companies) {
  companyByCui.set(Number(c.cui), c);
}

for (const cr of data.contact_records) {
  const cui = Number(cr.cui);
  if (!contactsByCui.has(cui)) contactsByCui.set(cui, []);
  contactsByCui.get(cui)!.push(cr);
}

for (const op of data.insurance_opportunities) {
  const cui = Number(op.cui);
  if (!oppsByCui.has(cui)) oppsByCui.set(cui, []);
  oppsByCui.get(cui)!.push(op);
}

for (const p of data.prospect_pipeline) {
  pipelineByCui.set(Number(p.cui), p);
}

for (const t of data.tax_records) {
  taxByCui.set(Number(t.cui), t);
}

for (const f of data.financial_records) {
  const cui = Number(f.cui);
  if (!financialsByCui.has(cui)) financialsByCui.set(cui, []);
  financialsByCui.get(cui)!.push(f);
}

for (const sc of data.company_secondary_caen) {
  const cui = Number(sc.cui);
  if (!secondaryCaenByCui.has(cui)) secondaryCaenByCui.set(cui, []);
  secondaryCaenByCui.get(cui)!.push(sc);
}

for (const a of data.audit_log) {
  const cui = Number(a.cui);
  if (!auditByCui.has(cui)) auditByCui.set(cui, []);
  auditByCui.get(cui)!.push(a);
}

export class EdgeDatabase {
  prepare(sql: string) {
    const normalized = sql.trim().replace(/\s+/g, ' ');
    return {
      get: (...params: any[]) => this.executeQuery(normalized, params, 'get'),
      all: (...params: any[]) => this.executeQuery(normalized, params, 'all'),
      run: (...params: any[]) => this.executeQuery(normalized, params, 'run'),
    };
  }

  exec(_sql: string) {
    return this;
  }

  pragma(_pragmaStr: string) {
    return null;
  }

  transaction(fn: Function) {
    return (...args: any[]) => fn(...args);
  }

  private executeQuery(sql: string, params: any[], mode: 'get' | 'all' | 'run'): any {
    const upper = sql.toUpperCase();

    // 1. UPDATE queries (e.g. prospect_pipeline update)
    if (upper.startsWith('UPDATE PROSPECT_PIPELINE')) {
      if (params.length >= 3) {
        const [status, notes, cui] = params;
        const record = pipelineByCui.get(Number(cui));
        if (record) {
          record.status = status;
          record.notes = notes;
          record.updated_at = new Date().toISOString();
        }
      }
      return { changes: 1 };
    }

    // 2. INSERT into suppression_list or audit_log or telegram
    if (upper.startsWith('INSERT INTO')) {
      return { changes: 1, lastInsertRowid: Date.now() };
    }

    // 3. Simple COUNT queries
    if (upper.includes('SELECT COUNT(*) AS COUNT FROM COMPANIES') || upper.includes('SELECT COUNT(*) AS TOTAL FROM COMPANIES')) {
      if (upper.includes("WHERE STATUS = 'ACTIVE'")) {
        const count = data.companies.filter((c) => c.status === 'ACTIVE').length;
        return mode === 'get' ? { count, total: count } : [{ count, total: count }];
      }
      if (upper.includes("DATE(FIRST_OBSERVED_AT) = DATE('NOW')")) {
        const today = new Date().toISOString().slice(0, 10);
        const count = data.companies.filter((c) => (c.first_observed_at || '').slice(0, 10) === today).length;
        return mode === 'get' ? { count, total: count } : [{ count, total: count }];
      }
      if (upper.includes("'+7 DAYS'") || upper.includes("'+90 DAYS'")) {
        // Last 90 days or 7 days
        const count = data.companies.length;
        return mode === 'get' ? { count, total: count } : [{ count, total: count }];
      }
      if (upper.includes("WHERE WEBSITE IS NOT NULL")) {
        const count = data.companies.filter((c) => c.website && c.website.trim() !== '').length;
        return mode === 'get' ? { count, total: count } : [{ count, total: count }];
      }
      if (upper.includes("PROSPECT_PRIORITY IN ('HIGH', 'URGENT')")) {
        const count = data.companies.filter((c) => c.prospect_priority === 'HIGH' || c.prospect_priority === 'URGENT').length;
        return mode === 'get' ? { count, total: count } : [{ count, total: count }];
      }
      if (upper.includes("WHERE PRIMARY_CAEN LIKE") || upper.includes("WHERE (PRIMARY_CAEN LIKE")) {
        // Industry prefixes
        const count = data.companies.filter((c) => {
          if (!c.primary_caen) return false;
          return params.some((p) => {
            const prefix = String(p).replace(/%/g, '');
            return c.primary_caen.startsWith(prefix);
          });
        }).length;
        return mode === 'get' ? { count, total: count } : [{ count, total: count }];
      }

      // Dynamic filter for /api/companies count
      let filtered = data.companies;
      if (params.length > 0) {
        filtered = this.filterCompanies(sql, params);
      }
      const count = filtered.length;
      return mode === 'get' ? { count, total: count } : [{ count, total: count }];
    }

    if (upper.includes('SELECT COUNT(DISTINCT CUI) AS COUNT FROM CONTACT_RECORDS')) {
      const count = contactsByCui.size;
      return mode === 'get' ? { count } : [{ count }];
    }

    if (upper.includes('SELECT COUNT(DISTINCT CUI) AS COUNT FROM FINANCIAL_RECORDS')) {
      const count = financialsByCui.size;
      return mode === 'get' ? { count } : [{ count }];
    }

    if (upper.includes('SELECT COUNT(DISTINCT CUI) AS COUNT FROM INSURANCE_OPPORTUNITIES')) {
      const count = oppsByCui.size;
      return mode === 'get' ? { count } : [{ count }];
    }

    if (upper.includes('SELECT COUNT(*) AS COUNT FROM SUPPRESSION_LIST')) {
      const count = data.suppression_list.length;
      return mode === 'get' ? { count } : [{ count }];
    }

    if (upper.includes('SELECT COUNT(*) AS COUNT FROM INSURANCE_OPPORTUNITIES')) {
      const count = data.insurance_opportunities.length;
      return mode === 'get' ? { count } : [{ count }];
    }

    if (upper.includes('SELECT COUNT(*) AS COUNT FROM CONTACT_RECORDS')) {
      const count = data.contact_records.length;
      return mode === 'get' ? { count } : [{ count }];
    }

    // 4. Ingestion Jobs
    if (upper.includes('FROM INGESTION_JOBS')) {
      if (upper.includes("GROUP BY STATUS")) {
        const successCount = data.ingestion_jobs.filter(j => j.status === 'SUCCESS').length;
        const totalProcessed = data.ingestion_jobs.reduce((acc, j) => acc + (j.records_processed || 0), 0);
        const totalNew = data.ingestion_jobs.reduce((acc, j) => acc + (j.new_records || 0), 0);
        return [
          { status: 'SUCCESS', count: successCount, total_processed: totalProcessed, total_new: totalNew }
        ];
      }
      const sorted = [...data.ingestion_jobs].sort((a, b) => (b.id || 0) - (a.id || 0));
      if (upper.includes("WHERE STATUS = 'SUCCESS'") || upper.includes("LIMIT 1")) {
        return mode === 'get' ? (sorted[0] || null) : [sorted[0] || null];
      }
      return sorted.slice(0, 20);
    }

    // 5. Top Opportunities for Dashboard
    if (upper.includes('FROM COMPANIES C') && upper.includes('OPP_COUNT')) {
      const top = [...data.companies]
        .sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0))
        .slice(0, 6)
        .map((c) => ({
          cui: c.cui,
          name: c.name,
          county: c.county,
          city: c.city,
          primary_caen: c.primary_caen,
          caen_description: c.caen_description,
          opportunity_score: c.opportunity_score,
          prospect_priority: c.prospect_priority,
          website: c.website,
          opp_count: (oppsByCui.get(Number(c.cui)) || []).length,
        }));
      return mode === 'get' ? top[0] : top;
    }

    // 6. Top Counties
    if (upper.includes('GROUP BY COUNTY')) {
      const countyCounts: Record<string, number> = {};
      for (const c of data.companies) {
        if (c.county && c.county.trim()) {
          countyCounts[c.county] = (countyCounts[c.county] || 0) + 1;
        }
      }
      const list = Object.entries(countyCounts)
        .map(([county, count]) => ({ county, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
      return mode === 'get' ? list[0] : list;
    }

    // 7. Top CAENs
    if (upper.includes('GROUP BY PRIMARY_CAEN')) {
      const caenCounts: Record<string, { count: number; desc: string }> = {};
      for (const c of data.companies) {
        if (c.primary_caen) {
          if (!caenCounts[c.primary_caen]) {
            caenCounts[c.primary_caen] = { count: 0, desc: c.caen_description || '' };
          }
          caenCounts[c.primary_caen].count++;
        }
      }
      const list = Object.entries(caenCounts)
        .map(([caen, item]) => ({
          primary_caen: caen,
          caen_description: item.desc,
          count: item.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
      return mode === 'get' ? list[0] : list;
    }

    // 8. Single Company Lookup by CUI
    if (upper.includes('FROM COMPANIES') && upper.includes('WHERE CUI = ?')) {
      const cui = Number(params[0]);
      const company = companyByCui.get(cui) || null;
      return mode === 'get' ? company : company ? [company] : [];
    }

    if (upper.includes('FROM TAX_RECORDS WHERE CUI = ?')) {
      const cui = Number(params[0]);
      const tax = taxByCui.get(cui) || null;
      return mode === 'get' ? tax : tax ? [tax] : [];
    }

    if (upper.includes('FROM FINANCIAL_RECORDS WHERE CUI = ?')) {
      const cui = Number(params[0]);
      const fin = financialsByCui.get(cui) || [];
      return mode === 'get' ? fin[0] || null : fin;
    }

    if (upper.includes('FROM CONTACT_RECORDS WHERE CUI = ?')) {
      const cui = Number(params[0]);
      const contacts = contactsByCui.get(cui) || [];
      return mode === 'get' ? contacts[0] || null : contacts;
    }

    if (upper.includes('FROM INSURANCE_OPPORTUNITIES WHERE CUI = ?')) {
      const cui = Number(params[0]);
      const opps = oppsByCui.get(cui) || [];
      return mode === 'get' ? opps[0] || null : opps;
    }

    if (upper.includes('FROM PROSPECT_PIPELINE WHERE CUI = ?')) {
      const cui = Number(params[0]);
      const p = pipelineByCui.get(cui) || null;
      return mode === 'get' ? p : p ? [p] : [];
    }

    if (upper.includes('FROM AUDIT_LOG WHERE CUI = ?')) {
      const cui = Number(params[0]);
      const logs = auditByCui.get(cui) || [];
      return mode === 'get' ? logs[0] || null : logs;
    }

    if (upper.includes('FROM COMPANY_SECONDARY_CAEN WHERE CUI = ?')) {
      const cui = Number(params[0]);
      const caens = secondaryCaenByCui.get(cui) || [];
      return mode === 'get' ? caens[0] || null : caens;
    }

    // 9. Insurance Hub Queries
    if (upper.includes('FROM INSURANCE_OPPORTUNITIES GROUP BY PRODUCT_CATEGORY')) {
      const catMap: Record<string, { count: number; sumConf: number }> = {};
      for (const op of data.insurance_opportunities) {
        const cat = op.product_category || 'GENERAL';
        if (!catMap[cat]) catMap[cat] = { count: 0, sumConf: 0 };
        catMap[cat].count++;
        catMap[cat].sumConf += op.confidence_level || 0.8;
      }
      return Object.entries(catMap).map(([cat, item]) => ({
        product_category: cat,
        count: item.count,
        avg_confidence: item.sumConf / item.count,
      }));
    }

    if (upper.includes('FROM INSURANCE_OPPORTUNITIES IO JOIN COMPANIES C ON IO.CUI = C.CUI')) {
      const leads = data.insurance_opportunities
        .slice(0, 25)
        .map((io) => {
          const comp = companyByCui.get(Number(io.cui)) || {};
          return {
            cui: io.cui,
            name: comp.name || 'Companie Românească',
            county: comp.county || '',
            city: comp.city || '',
            primary_caen: comp.primary_caen || '',
            caen_description: comp.caen_description || '',
            product_category: io.product_category,
            product_name: io.product_name,
            trigger_event: io.trigger_event,
            confidence_level: io.confidence_level,
            estimated_priority: io.estimated_priority,
            rationale: io.rationale,
          };
        })
        .sort((a, b) => (b.confidence_level || 0) - (a.confidence_level || 0));
      return leads;
    }

    // 10. Prospect Pipeline
    if (upper.includes('FROM PROSPECT_PIPELINE P JOIN COMPANIES C ON P.CUI = C.CUI')) {
      const list = data.prospect_pipeline.slice(0, 100).map((p) => {
        const comp = companyByCui.get(Number(p.cui)) || {};
        return {
          ...p,
          company_name: comp.name || 'Companie',
          county: comp.county || '',
          city: comp.city || '',
          primary_caen: comp.primary_caen || '',
          caen_description: comp.caen_description || '',
          opportunity_score: comp.opportunity_score || 0,
        };
      });
      return list;
    }

    if (upper.includes('FROM PROSPECT_PIPELINE GROUP BY STATUS')) {
      const statusMap: Record<string, number> = {};
      for (const p of data.prospect_pipeline) {
        const s = p.status || 'NEW_DISCOVERED';
        statusMap[s] = (statusMap[s] || 0) + 1;
      }
      return Object.entries(statusMap).map(([status, count]) => ({ status, count }));
    }

    // 11. Industries Category List
    if (upper.includes('FROM COMPANIES WHERE') && (upper.includes('PRIMARY_CAEN LIKE') || upper.includes('PRIMARY_CAEN ='))) {
      const matches = data.companies.filter((c) => {
        if (!c.primary_caen) return false;
        return params.some((p) => {
          const prefix = String(p).replace(/%/g, '');
          return c.primary_caen.startsWith(prefix);
        });
      });
      return matches.slice(0, 50);
    }

    // 12. Companies Directory query with pagination
    if (upper.startsWith('SELECT * FROM COMPANIES') || upper.includes('FROM COMPANIES')) {
      let filtered = this.filterCompanies(sql, params);
      // Pagination extraction from params
      let limit = 25;
      let offset = 0;
      if (params.length >= 2) {
        const lastTwo = params.slice(-2);
        if (typeof lastTwo[0] === 'number' && typeof lastTwo[1] === 'number') {
          limit = lastTwo[0];
          offset = lastTwo[1];
        }
      }
      const pageSlice = filtered.slice(offset, offset + limit);
      return mode === 'get' ? pageSlice[0] || null : pageSlice;
    }

    // Default safe fallback
    return mode === 'get' ? null : [];
  }

  private filterCompanies(sql: string, params: any[]): any[] {
    let result = [...data.companies];

    // If search param is present (usually %query%)
    for (const p of params) {
      if (typeof p === 'string' && p.includes('%')) {
        const clean = p.replace(/%/g, '').toLowerCase().trim();
        if (clean) {
          result = result.filter((c) => {
            const name = (c.name || '').toLowerCase();
            const cui = String(c.cui);
            const county = (c.county || '').toLowerCase();
            const caen = (c.caen_description || '').toLowerCase();
            return name.includes(clean) || cui.includes(clean) || county.includes(clean) || caen.includes(clean);
          });
        }
      } else if (typeof p === 'string' && p.length === 2 && /^[A-Z]{2}$/i.test(p)) {
        // County filter
        result = result.filter((c) => (c.county || '').toUpperCase() === p.toUpperCase());
      }
    }

    return result;
  }
}

let edgeDbInstance: EdgeDatabase | null = null;

export function getEdgeDatabase(): EdgeDatabase {
  if (!edgeDbInstance) {
    edgeDbInstance = new EdgeDatabase();
  }
  return edgeDbInstance;
}
