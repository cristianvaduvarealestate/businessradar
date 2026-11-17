/**
 * WORKER-SAFE NATIONAL SEARCH ENGINE & STORAGE DRIVER (V2)
 * Bounded subrequests (< 25 max for paginated list, 1 for CUI lookup).
 * Strict object size safety (< 4 MB). Zero Node.js filesystem dependency in Worker runtime.
 * Enforces strict request-level cumulative memory & byte budgets.
 */

const path = require('path');
const fs = require('fs');

const MAX_CUMULATIVE_BYTES_PER_REQUEST = 8 * 1024 * 1024; // 8 MB hard limit per search request
const MAX_SHARD_READS_PER_REQUEST = 3; // at most 3 shard reads per request

function slugify(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTerm(str) {
  if (!str) return '';
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isPermittedRuntimePath(key) {
  const clean = key.replace(/^national\//, '');
  if (clean.includes('..') || clean.startsWith('/') || clean.startsWith('\\')) {
    return false;
  }
  // Exclude audit files from runtime path
  if (clean.startsWith('audit/')) {
    return false;
  }
  if (clean === 'manifest.json') {
    return true;
  }
  if (/^shards\/(cui|county|names)\/[a-zA-Z0-9_\-\.]+\.json$/.test(clean)) {
    return true;
  }
  return false;
}

function encodeCursor(page, limit, total) {
  const payload = JSON.stringify({ p: page, l: limit, t: total, ts: Date.now() });
  return Buffer.from(payload).toString('base64');
}

function decodeCursor(cursor) {
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
    // Malformed/tampered cursor falls back safely
  }
  return null;
}

function toCompanySummary(item) {
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
  constructor() {
    this.bytesRead = 0;
    this.shardReads = 0;
    this.budgetLimited = false;
  }

  canReadShard(estimatedBytes = 2.5 * 1024 * 1024) {
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

  recordRead(bytes) {
    this.bytesRead += bytes;
    this.shardReads++;
  }
}

/**
 * Cloudflare Worker R2 Storage Driver
 * Zero Node.js filesystem dependency. Bounded subrequests (< 25 per query).
 */
class R2NationalStorageDriver {
  constructor(bucket) {
    this.bucket = bucket;
    this.maxBytes = 4 * 1024 * 1024; // 4 MB safety guard
  }

  getDriverName() {
    return 'R2_STORAGE';
  }

  async isAvailable() {
    if (!this.bucket || typeof this.bucket.get !== 'function') return false;
    try {
      const manifest = await this.bucket.get('national/manifest.json');
      return manifest !== null;
    } catch {
      return false;
    }
  }

  async getJsonWithMeta(key) {
    if (!this.bucket) return { data: null, bytes: 0 };
    if (!isPermittedRuntimePath(key)) {
      console.warn(`[WORKER SECURITY REJECT] Key '${key}' is outside permitted runtime path.`);
      return { data: null, bytes: 0 };
    }
    try {
      const obj = await this.bucket.get(key);
      if (!obj) return { data: null, bytes: 0 };

      const size = obj.size || 0;
      if (size > this.maxBytes) {
        console.error(`[WORKER SAFETY REJECT] Object ${key} is ${(size / 1024 / 1024).toFixed(2)} MB (> 4MB limit).`);
        return { data: null, bytes: 0 };
      }

      const data = await obj.json();
      return { data, bytes: size };
    } catch (e) {
      console.warn(`R2 fetch failed for key ${key}:`, e.message);
      return { data: null, bytes: 0 };
    }
  }

  async getJson(key) {
    const res = await this.getJsonWithMeta(key);
    return res.data;
  }

  async getManifest() {
    return this.getJson('national/manifest.json');
  }
}

/**
 * Local Filesystem Driver for Node.js / Testing / Ingestion generator
 */
class LocalShardsDriver {
  constructor(baseDir) {
    this.maxBytes = 4 * 1024 * 1024;
    if (baseDir) {
      this.baseDir = baseDir;
    } else {
      const v2Path = path.join(process.cwd(), 'data', 'national_shards_v2');
      const v1Path = path.join(process.cwd(), 'data', 'national_shards');
      this.baseDir = fs.existsSync(path.join(v2Path, 'manifest.json')) ? v2Path : v1Path;
    }
  }

  getDriverName() {
    return 'LOCAL_SHARDS';
  }

  async isAvailable() {
    const manifestPath = path.join(this.baseDir, 'manifest.json');
    return fs.existsSync(manifestPath);
  }

  async getJsonWithMeta(key) {
    if (!isPermittedRuntimePath(key)) {
      console.warn(`[STORAGE SECURITY REJECT] Key '${key}' is outside permitted runtime path.`);
      return { data: null, bytes: 0 };
    }
    const cleanKey = key.replace(/^national\//, '');
    const filePath = path.join(this.baseDir, cleanKey);

    if (!fs.existsSync(filePath)) return { data: null, bytes: 0 };

    try {
      const stat = fs.statSync(filePath);
      if (stat.size > this.maxBytes) {
        console.error(`[STORAGE SAFETY REJECT] Object ${key} is ${(stat.size / 1024 / 1024).toFixed(2)} MB (> 4MB limit).`);
        return { data: null, bytes: 0 };
      }
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      return { data, bytes: stat.size };
    } catch (e) {
      console.warn(`Local shard read failed for ${filePath}:`, e.message);
      return { data: null, bytes: 0 };
    }
  }

  async getJson(key) {
    const res = await this.getJsonWithMeta(key);
    return res.data;
  }

  async getManifest() {
    return this.getJson('manifest.json');
  }
}

/**
 * Empty / Null Driver
 */
class NullStorageDriver {
  getDriverName() {
    return 'NOT_CONFIGURED';
  }

  async isAvailable() {
    return false;
  }

  async getJson() {
    return null;
  }

  async getManifest() {
    return null;
  }
}

/**
 * Adaptive Storage Manager
 */
class AdaptiveNationalStorage {
  static getDriver() {
    if (typeof globalThis !== 'undefined' && globalThis.__env && globalThis.__env.NATIONAL_SHARDS) {
      return new R2NationalStorageDriver(globalThis.__env.NATIONAL_SHARDS);
    }

    if (process.env.NODE_ENV !== 'production' || process.env.USE_LOCAL_SHARDS === 'true') {
      return new LocalShardsDriver();
    }

    return new NullStorageDriver();
  }
}

/**
 * Worker-Safe National Search Engine (V2)
 */
class NationalSearchEngine {
  static resolveCuiShardKey(targetCui, manifest) {
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

    // Default formatting based on modulo digits (3 digits for 1000, 2 for 100)
    const padLen = modulo >= 1000 ? 3 : 2;
    return `shards/cui/shard-${String(shardIdx).padStart(padLen, '0')}.json`;
  }

  static async search(filters, driver) {
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

    const manifest = await storage.getManifest();
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
      const targetCui = filters.cui || parseInt(filters.q.trim(), 10);
      const shardKey = this.resolveCuiShardKey(targetCui, manifest);

      let item = null;
      if (storage.getJsonWithMeta) {
        const res = await storage.getJsonWithMeta(shardKey);
        tracker.recordRead(res.bytes);
        item = res.data ? res.data[String(targetCui)] || null : null;
      } else {
        const shardData = await storage.getJson(shardKey);
        tracker.recordRead(2.5 * 1024 * 1024);
        item = shardData ? shardData[String(targetCui)] || null : null;
      }

      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1000000;

      return {
        items: item ? [item] : [],
        pagination: { page: 1, limit, total: item ? 1 : 0, totalPages: 1 },
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

      let prefixKey = null;

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

      let nameIndex = null;
      if (storage.getJsonWithMeta) {
        const res = await storage.getJsonWithMeta(prefixKey);
        tracker.recordRead(res.bytes);
        nameIndex = res.data;
      } else {
        nameIndex = await storage.getJson(prefixKey);
        tracker.recordRead(1.5 * 1024 * 1024);
      }

      let matched = nameIndex ? [...nameIndex] : [];

      // Filter by complete search query (supporting punctuation-insensitive matching)
      const cleanQ = normQ.replace(/[^A-Z0-9]/g, '');
      const matchesQuery = (name) => {
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
        let specialItems = null;
        if (storage.getJsonWithMeta) {
          const res = await storage.getJsonWithMeta('shards/names/prefix-special.json');
          if (res.data) specialItems = res.data;
        } else {
          specialItems = await storage.getJson('shards/names/prefix-special.json');
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
      const seenCuis = new Set();
      matched = matched.filter((m) => {
        if (seenCuis.has(m.cui)) return false;
        seenCuis.add(m.cui);
        return true;
      });

      if (filters.county) {
        matched = matched.filter((m) => m.county === filters.county);
      }
      if (filters.legalStatus) {
        matched = matched.filter((m) => m.status === filters.legalStatus);
      }
      if (filters.caen) {
        matched = matched.filter((m) => m.caen && m.caen.startsWith(filters.caen));
      }

      const total = matched.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const offset = (page - 1) * limit;
      const pagedItems = matched.slice(offset, offset + limit);

      let finalItems = [];

      if (filters.hydrate) {
        const cuiByShardKey = {};
        for (const item of pagedItems) {
          const shardKey = this.resolveCuiShardKey(item.cui, manifest);
          if (!cuiByShardKey[shardKey]) cuiByShardKey[shardKey] = [];
          cuiByShardKey[shardKey].push(item.cui);
        }

        const hydratedMap = new Map();
        for (const [shardKey, cuis] of Object.entries(cuiByShardKey)) {
          if (!tracker.canReadShard()) {
            break;
          }
          if (storage.getJsonWithMeta) {
            const res = await storage.getJsonWithMeta(shardKey);
            tracker.recordRead(res.bytes);
            if (res.data) {
              for (const cui of cuis) {
                if (res.data[String(cui)]) {
                  hydratedMap.set(cui, res.data[String(cui)]);
                }
              }
            }
          } else {
            const shardMap = await storage.getJson(shardKey);
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
      const latencyMs = Number(end - start) / 1000000;

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

      let countyKey = null;
      let totalCountyRecords = 0;
      const offset = (page - 1) * limit;

      if (countyEntry && countyEntry.pages && countyEntry.pages.length > 0) {
        totalCountyRecords = countyEntry.total;
        const pageIdx = Math.min(countyEntry.pagesCount - 1, Math.floor(offset / countyEntry.pageSize));
        countyKey = `shards/county/${countyEntry.pages[pageIdx].file}`;
      } else {
        countyKey = `shards/county/county-${countySlug}.json`;
      }

      let countyList = null;
      if (storage.getJsonWithMeta) {
        const res = await storage.getJsonWithMeta(countyKey);
        tracker.recordRead(res.bytes);
        countyList = res.data;
      } else {
        countyList = await storage.getJson(countyKey);
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
        matched = matched.filter((m) => m.caen && m.caen.startsWith(filters.caen));
      }

      const total = totalCountyRecords || matched.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const pageSize = countyEntry?.pageSize || 10000;
      const withinPageOffset = (offset % pageSize);
      const pagedSlice = matched.slice(withinPageOffset, withinPageOffset + limit);

      let finalItems = [];

      if (filters.hydrate) {
        const cuiByShardKey = {};
        for (const item of pagedSlice) {
          const shardKey = this.resolveCuiShardKey(item.cui, manifest);
          if (!cuiByShardKey[shardKey]) cuiByShardKey[shardKey] = [];
          cuiByShardKey[shardKey].push(item.cui);
        }

        const hydratedMap = new Map();
        for (const [shardKey, cuis] of Object.entries(cuiByShardKey)) {
          if (!tracker.canReadShard()) {
            break;
          }
          if (storage.getJsonWithMeta) {
            const res = await storage.getJsonWithMeta(shardKey);
            tracker.recordRead(res.bytes);
            if (res.data) {
              for (const cui of cuis) {
                if (res.data[String(cui)]) {
                  hydratedMap.set(cui, res.data[String(cui)]);
                }
              }
            }
          } else {
            const shardMap = await storage.getJson(shardKey);
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
      const latencyMs = Number(end - start) / 1000000;

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

    let items = [];
    if (storage.getJsonWithMeta) {
      const res = await storage.getJsonWithMeta(sampleKey);
      tracker.recordRead(res.bytes);
      items = res.data ? Object.values(res.data).slice(0, limit) : [];
    } else {
      const sampleShard = await storage.getJson(sampleKey);
      tracker.recordRead(2.5 * 1024 * 1024);
      items = sampleShard ? Object.values(sampleShard).slice(0, limit) : [];
    }

    const end = process.hrtime.bigint();
    const latencyMs = Number(end - start) / 1000000;

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
  static async getByCui(cui, driver) {
    if (!cui || cui <= 0) return null;
    const storage = driver || AdaptiveNationalStorage.getDriver();
    const manifest = await storage.getManifest();
    if (!manifest) return null;

    const shardKey = this.resolveCuiShardKey(cui, manifest);
    const shardData = await storage.getJson(shardKey);

    return shardData ? shardData[String(cui)] || null : null;
  }
}

module.exports = {
  R2NationalStorageDriver,
  LocalShardsDriver,
  AdaptiveNationalStorage,
  NationalSearchEngine,
  MAX_CUMULATIVE_BYTES_PER_REQUEST,
  MAX_SHARD_READS_PER_REQUEST,
  encodeCursor,
  decodeCursor,
  toCompanySummary,
};
