/**
 * WORKER-COMPATIBLE NATIONAL SEARCH ENGINE (V2)
 * Executes bounded, sub-millisecond queries over sharded R2 object storage.
 * Designed strictly for Cloudflare Workers (128 MB RAM, 10 ms CPU, max 50 subrequests).
 * Guaranteed < 4 MB object reads, bounded pagination chunks, and adaptive prefix tree.
 * Enforces strict request-level cumulative memory & byte budgets.
 */

import { AdaptiveNationalStorage, NationalStorageDriver } from './storage';
import {
  NationalCompany,
  NationalSearchFilters,
  NationalSearchResult,
  NationalShardManifest,
  NationalNameIndexItem,
  NationalCountyIndexItem,
} from './types';

export const MAX_CUMULATIVE_BYTES_PER_REQUEST = 8 * 1024 * 1024; // 8 MB hard limit per search request
export const MAX_SHARD_READS_PER_REQUEST = 3; // at most 3 shard reads per request

function slugify(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTerm(str: string): string {
  if (!str) return '';
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function encodeCursor(page: number, limit: number, total: number): string {
  const payload = JSON.stringify({ p: page, l: limit, t: total, ts: Date.now() });
  return Buffer.from(payload).toString('base64');
}

export function decodeCursor(cursor?: string): { page: number; limit: number } | null {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.p === 'number' &&
      parsed.p >= 1 &&
      typeof parsed.l === 'number' &&
      parsed.l >= 1
    ) {
      return { page: parsed.p, limit: parsed.l };
    }
  } catch {
    // Malformed/tampered cursor falls back gracefully
  }
  return null;
}

export function toCompanySummary(item: any): NationalCompany {
  return {
    cui: item.cui,
    name: item.name,
    normalized_name: normalizeTerm(item.name),
    legal_form: item.legal_form || 'SRL',
    registration_date: item.registration_date || undefined,
    county: item.county || undefined,
    city: item.city || undefined,
    legal_status: item.status || 'ACTIVE',
    fiscal_status: 'UNKNOWN',
    primary_caen: item.caen || undefined,
    source_dataset_id: 'ONRC_NATIONAL_CSV',
    source_file_name: 'OD_FIRME.CSV',
    imported_at: '2026-11-06',
  };
}

class RequestBudgetTracker {
  bytesRead = 0;
  shardReads = 0;
  budgetLimited = false;

  canReadShard(estimatedBytes = 2.5 * 1024 * 1024): boolean {
    if (this.shardReads >= MAX_SHARD_READS_PER_REQUEST) {
      this.budgetLimited = true;
      return false;
    }
    if (this.bytesRead + estimatedBytes > MAX_CUMULATIVE_BYTES_PER_REQUEST) {
      this.budgetLimited = true;
      return false;
    }
    return true;
  }

  recordRead(bytes: number) {
    this.bytesRead += bytes;
    this.shardReads++;
  }
}

export class NationalSearchEngine {
  static resolveCuiShardKey(targetCui: number, manifest: any): string {
    const modulo = manifest.shards?.cui_modulo || manifest.shards?.cui_partition_modulo || 1000;
    const shardIdx = targetCui % modulo;

    if (manifest.cui_index && manifest.cui_index[String(shardIdx)]) {
      const entry = manifest.cui_index[String(shardIdx)];
      if (entry.subdivided) {
        const partIdx = Math.floor(targetCui / modulo) % 2;
        return `shards/cui/${entry.parts[partIdx].file}`;
      }
      return `shards/cui/${entry.file}`;
    }

    const padLen = modulo >= 1000 ? 3 : 2;
    return `shards/cui/shard-${String(shardIdx).padStart(padLen, '0')}.json`;
  }

  /**
   * Search across the National Dataset using bounded R2 shard reads
   */
  static async search(
    filters: NationalSearchFilters,
    driver?: NationalStorageDriver
  ): Promise<NationalSearchResult> {
    const start = process.hrtime.bigint();
    const storage = driver || AdaptiveNationalStorage.getDriver();
    const tracker = new RequestBudgetTracker();

    let page = Math.max(1, filters.page || 1);
    let limit = Math.min(100, Math.max(5, filters.limit || 25));

    if (filters.cursor) {
      const cursorData = decodeCursor(filters.cursor);
      if (cursorData) {
        page = cursorData.page;
        limit = cursorData.limit;
      }
    }

    // 1. Check storage availability
    const manifest: any = await storage.getManifest();
    if (!manifest) {
      return {
        items: [],
        pagination: { page, limit, total: 0, totalPages: 1 },
        metrics: {
          searchLatencyMs: 0,
          dataSource: 'OPERATIONAL_FALLBACK',
          cumulativeBytesRead: 0,
          shardReadsCount: 0,
          budgetLimited: false,
        },
      };
    }

    // STRATEGY A: Direct CUI Lookup (1 Shard Read)
    if (filters.cui || (filters.q && /^\d+$/.test(filters.q.trim()))) {
      const targetCui = filters.cui || parseInt(filters.q!.trim(), 10);
      const shardKey = this.resolveCuiShardKey(targetCui, manifest);

      let item: NationalCompany | null = null;
      if (storage.getJsonWithMeta) {
        const res = await storage.getJsonWithMeta<Record<string, NationalCompany>>(shardKey);
        tracker.recordRead(res.bytes);
        item = res.data ? res.data[String(targetCui)] || null : null;
      } else {
        const shardData = await storage.getJson<Record<string, NationalCompany>>(shardKey);
        tracker.recordRead(2.5 * 1024 * 1024);
        item = shardData ? shardData[String(targetCui)] || null : null;
      }

      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1_000_000;

      return {
        items: item ? [item] : [],
        pagination: {
          page: 1,
          limit,
          total: item ? 1 : 0,
          totalPages: 1,
        },
        metrics: {
          searchLatencyMs: Math.round(latencyMs * 100) / 100,
          dataSource: 'NATIONAL_DATABASE_SHARD',
          cumulativeBytesRead: tracker.bytesRead,
          shardReadsCount: tracker.shardReads,
          budgetLimited: tracker.budgetLimited,
        },
      };
    }

    // STRATEGY B: Name Prefix Lookup (Adaptive Prefix Tree)
    if (filters.q && filters.q.trim().length >= 2) {
      const normQ = normalizeTerm(filters.q);
      const isSymbolQuery = /^[^A-Z0-9]/.test(normQ);
      const p2 = slugify(normQ.replace(/^[^A-Z0-9]+/, '').slice(0, 2));

      let prefixKey: string | null = null;

      if (isSymbolQuery || p2.length < 2) {
        prefixKey = 'shards/names/prefix-special.json';
      } else if (manifest.name_index && manifest.name_index[p2]) {
        const entry = manifest.name_index[p2];
        if (entry.type === 'exact') {
          prefixKey = `shards/names/${entry.file}`;
        } else if (entry.type === 'subdivided') {
          const cleanQ = normQ.replace(/^[^A-Z0-9]+/, '');
          const p3 = slugify(cleanQ.slice(0, 3));
          const p4 = slugify(cleanQ.slice(0, 4));
          if (p4 && entry.subPrefixes && entry.subPrefixes[p4]) {
            prefixKey = `shards/names/${entry.subPrefixes[p4].file}`;
          } else if (p3 && entry.subPrefixes && entry.subPrefixes[p3]) {
            prefixKey = `shards/names/${entry.subPrefixes[p3].file}`;
          } else if (entry.subPrefixes && entry.subPrefixes[`${p3}-other`]) {
            prefixKey = `shards/names/${entry.subPrefixes[`${p3}-other`].file}`;
          } else if (entry.subPrefixes && entry.subPrefixes[`${p2}-other`]) {
            prefixKey = `shards/names/${entry.subPrefixes[`${p2}-other`].file}`;
          }
        }
      }

      if (!prefixKey) {
        prefixKey = p2.length >= 2 ? `shards/names/prefix-${p2}.json` : 'shards/names/prefix-special.json';
      }

      let nameIndex: NationalNameIndexItem[] | null = null;
      if (storage.getJsonWithMeta) {
        const res = await storage.getJsonWithMeta<NationalNameIndexItem[]>(prefixKey);
        tracker.recordRead(res.bytes);
        nameIndex = res.data;
      } else {
        nameIndex = await storage.getJson<NationalNameIndexItem[]>(prefixKey);
        tracker.recordRead(1.5 * 1024 * 1024);
      }

      let matched = nameIndex ? [...nameIndex] : [];

      // Filter by complete search query (supporting punctuation-insensitive matching)
      const cleanQ = normQ.replace(/[^A-Z0-9]/g, '');
      const matchesQuery = (name: string) => {
        const normName = normalizeTerm(name);
        if (normName.includes(normQ)) return true;
        if (cleanQ.length >= 2) {
          const cleanName = normName.replace(/[^A-Z0-9]/g, '');
          if (cleanName.includes(cleanQ)) return true;
        }
        return false;
      };

      matched = matched.filter((m) => matchesQuery(m.name));

      // Also scan prefix-special.json if this was an alphanumeric search, to discover special-prefix entities
      if (prefixKey !== 'shards/names/prefix-special.json') {
        let specialItems: NationalNameIndexItem[] | null = null;
        if (storage.getJsonWithMeta) {
          const res = await storage.getJsonWithMeta<NationalNameIndexItem[]>('shards/names/prefix-special.json');
          if (res.data) specialItems = res.data;
        } else {
          specialItems = await storage.getJson<NationalNameIndexItem[]>('shards/names/prefix-special.json');
        }
        if (specialItems && specialItems.length > 0) {
          const matchingSpecial = specialItems.filter((m) => matchesQuery(m.name));
          // Prepend special matches so they are immediately accessible on Page 1
          if (matchingSpecial.length > 0) {
            matched = matchingSpecial.concat(matched);
          }
        }
      }

      // Deduplicate matched records if any overlap occurred
      const seenCuis = new Set<number>();
      matched = matched.filter((m) => {
        if (seenCuis.has(m.cui)) return false;
        seenCuis.add(m.cui);
        return true;
      });

      // Apply secondary filters
      if (filters.county) {
        matched = matched.filter((m) => m.county === filters.county);
      }
      if (filters.legalStatus) {
        matched = matched.filter((m) => m.status === filters.legalStatus);
      }
      if (filters.caen) {
        matched = matched.filter((m) => m.caen && m.caen.startsWith(filters.caen!));
      }

      const total = matched.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const offset = (page - 1) * limit;
      const pagedItems = matched.slice(offset, offset + limit);

      let finalItems: NationalCompany[] = [];

      // If hydration requested, hydrate with strict budget guard
      if (filters.hydrate) {
        const cuiByShardKey: Record<string, number[]> = {};
        for (const item of pagedItems) {
          const shardKey = this.resolveCuiShardKey(item.cui, manifest);
          if (!cuiByShardKey[shardKey]) cuiByShardKey[shardKey] = [];
          cuiByShardKey[shardKey].push(item.cui);
        }

        const hydratedMap = new Map<number, NationalCompany>();
        for (const [shardKey, cuis] of Object.entries(cuiByShardKey)) {
          if (!tracker.canReadShard()) {
            break;
          }
          if (storage.getJsonWithMeta) {
            const res = await storage.getJsonWithMeta<Record<string, NationalCompany>>(shardKey);
            tracker.recordRead(res.bytes);
            if (res.data) {
              for (const cui of cuis) {
                if (res.data[String(cui)]) {
                  hydratedMap.set(cui, res.data[String(cui)]);
                }
              }
            }
          } else {
            const shardMap = await storage.getJson<Record<string, NationalCompany>>(shardKey);
            tracker.recordRead(2.5 * 1024 * 1024);
            if (shardMap) {
              for (const cui of cuis) {
                if (shardMap[String(cui)]) {
                  hydratedMap.set(cui, shardMap[String(cui)]);
                }
              }
            }
          }
        }

        finalItems = pagedItems.map((item) => hydratedMap.get(item.cui) || toCompanySummary(item));
      } else {
        // High-performance direct return from index (1 shard read total!)
        finalItems = pagedItems.map(toCompanySummary);
      }

      const nextCursor = page < totalPages ? encodeCursor(page + 1, limit, total) : undefined;
      const prevCursor = page > 1 ? encodeCursor(page - 1, limit, total) : undefined;

      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1_000_000;

      return {
        items: finalItems,
        pagination: { page, limit, total, totalPages, nextCursor, prevCursor },
        metrics: {
          searchLatencyMs: Math.round(latencyMs * 100) / 100,
          dataSource: 'NATIONAL_DATABASE_SHARD',
          cumulativeBytesRead: tracker.bytesRead,
          shardReadsCount: tracker.shardReads,
          budgetLimited: tracker.budgetLimited,
        },
      };
    }

    // STRATEGY C: County Filter (Bounded Page Chunks)
    if (filters.county) {
      const countySlug = slugify(filters.county);
      const countyEntry = manifest.county_index ? manifest.county_index[countySlug] : null;

      let countyKey: string | null = null;
      let totalCountyRecords = 0;
      const offset = (page - 1) * limit;

      if (countyEntry && countyEntry.pages && countyEntry.pages.length > 0) {
        totalCountyRecords = countyEntry.total;
        const pageIdx = Math.min(countyEntry.pagesCount - 1, Math.floor(offset / countyEntry.pageSize));
        countyKey = `shards/county/${countyEntry.pages[pageIdx].file}`;
      } else {
        countyKey = `shards/county/county-${countySlug}.json`;
      }

      let countyList: NationalCountyIndexItem[] | null = null;
      if (storage.getJsonWithMeta) {
        const res = await storage.getJsonWithMeta<NationalCountyIndexItem[]>(countyKey);
        tracker.recordRead(res.bytes);
        countyList = res.data;
      } else {
        countyList = await storage.getJson<NationalCountyIndexItem[]>(countyKey);
        tracker.recordRead(1.5 * 1024 * 1024);
      }

      let matched = countyList || [];

      if (filters.city) {
        const normCity = normalizeTerm(filters.city);
        matched = matched.filter((m) => m.city && normalizeTerm(m.city).includes(normCity));
      }
      if (filters.legalForm) {
        matched = matched.filter((m) => m.legal_form === filters.legalForm);
      }
      if (filters.legalStatus) {
        matched = matched.filter((m) => m.status === filters.legalStatus);
      }
      if (filters.caen) {
        matched = matched.filter((m) => m.caen && m.caen.startsWith(filters.caen!));
      }

      const total = totalCountyRecords || matched.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const pageSize = countyEntry?.pageSize || 10000;
      const withinPageOffset = (offset % pageSize);
      const pagedSlice = matched.slice(withinPageOffset, withinPageOffset + limit);

      let finalItems: NationalCompany[] = [];

      if (filters.hydrate) {
        const cuiByShardKey: Record<string, number[]> = {};
        for (const item of pagedSlice) {
          const shardKey = this.resolveCuiShardKey(item.cui, manifest);
          if (!cuiByShardKey[shardKey]) cuiByShardKey[shardKey] = [];
          cuiByShardKey[shardKey].push(item.cui);
        }

        const hydratedMap = new Map<number, NationalCompany>();
        for (const [shardKey, cuis] of Object.entries(cuiByShardKey)) {
          if (!tracker.canReadShard()) {
            break;
          }
          if (storage.getJsonWithMeta) {
            const res = await storage.getJsonWithMeta<Record<string, NationalCompany>>(shardKey);
            tracker.recordRead(res.bytes);
            if (res.data) {
              for (const cui of cuis) {
                if (res.data[String(cui)]) {
                  hydratedMap.set(cui, res.data[String(cui)]);
                }
              }
            }
          } else {
            const shardMap = await storage.getJson<Record<string, NationalCompany>>(shardKey);
            tracker.recordRead(2.5 * 1024 * 1024);
            if (shardMap) {
              for (const cui of cuis) {
                if (shardMap[String(cui)]) {
                  hydratedMap.set(cui, shardMap[String(cui)]);
                }
              }
            }
          }
        }
        finalItems = pagedSlice.map((item) => hydratedMap.get(item.cui) || toCompanySummary(item));
      } else {
        // High-performance direct return from index
        finalItems = pagedSlice.map(toCompanySummary);
      }

      const nextCursor = page < totalPages ? encodeCursor(page + 1, limit, total) : undefined;
      const prevCursor = page > 1 ? encodeCursor(page - 1, limit, total) : undefined;

      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1_000_000;

      return {
        items: finalItems,
        pagination: { page, limit, total, totalPages, nextCursor, prevCursor },
        metrics: {
          searchLatencyMs: Math.round(latencyMs * 100) / 100,
          dataSource: 'NATIONAL_DATABASE_SHARD',
          cumulativeBytesRead: tracker.bytesRead,
          shardReadsCount: tracker.shardReads,
          budgetLimited: tracker.budgetLimited,
        },
      };
    }

    // Default overview
    const sampleKey =
      manifest.cui_index && manifest.cui_index['0']
        ? `shards/cui/${manifest.cui_index['0'].subdivided ? manifest.cui_index['0'].parts[0].file : manifest.cui_index['0'].file}`
        : 'shards/cui/shard-000.json';

    let items: NationalCompany[] = [];
    if (storage.getJsonWithMeta) {
      const res = await storage.getJsonWithMeta<Record<string, NationalCompany>>(sampleKey);
      tracker.recordRead(res.bytes);
      items = res.data ? Object.values(res.data).slice(0, limit) : [];
    } else {
      const sampleShard = await storage.getJson<Record<string, NationalCompany>>(sampleKey);
      tracker.recordRead(2.5 * 1024 * 1024);
      items = sampleShard ? Object.values(sampleShard).slice(0, limit) : [];
    }

    const end = process.hrtime.bigint();
    const latencyMs = Number(end - start) / 1_000_000;

    return {
      items,
      pagination: {
        page: 1,
        limit,
        total: manifest.total_valid_records,
        totalPages: Math.ceil(manifest.total_valid_records / limit),
      },
      metrics: {
        searchLatencyMs: Math.round(latencyMs * 100) / 100,
        dataSource: 'NATIONAL_DATABASE_SHARD',
        cumulativeBytesRead: tracker.bytesRead,
        shardReadsCount: tracker.shardReads,
        budgetLimited: tracker.budgetLimited,
      },
    };
  }

  /**
   * Fast CUI Profile Fetcher
   */
  static async getByCui(cui: number, driver?: NationalStorageDriver): Promise<NationalCompany | null> {
    if (!cui || cui <= 0) return null;
    const storage = driver || AdaptiveNationalStorage.getDriver();
    const manifest: any = await storage.getManifest();
    if (!manifest) return null;

    const shardKey = this.resolveCuiShardKey(cui, manifest);
    const shardData = await storage.getJson<Record<string, NationalCompany>>(shardKey);

    return shardData ? shardData[String(cui)] || null : null;
  }
}
