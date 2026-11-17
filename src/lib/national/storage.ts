/**
 * WORKER-COMPATIBLE NATIONAL STORAGE DRIVER
 * Provides bounded read access to sharded R2 object storage in Cloudflare Workers,
 * with local filesystem fallback for Node.js development and testing.
 */

import { NationalShardManifest, NationalCompany, NationalNameIndexItem, NationalCountyIndexItem } from './types';

export interface NationalStorageDriver {
  getJson<T>(key: string): Promise<T | null>;
  getJsonWithMeta?<T>(key: string): Promise<{ data: T | null; bytes: number }>;
  getManifest(): Promise<NationalShardManifest | null>;
  isAvailable(): Promise<boolean>;
  getDriverName(): 'R2_STORAGE' | 'LOCAL_SHARDS' | 'NOT_CONFIGURED';
}

function isPermittedRuntimePath(key: string): boolean {
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

/**
 * Cloudflare Worker R2 Storage Driver
 * Zero Node.js filesystem dependency. Bounded subrequests (< 2 per query).
 */
export class R2NationalStorageDriver implements NationalStorageDriver {
  private bucket: any;
  private maxBytes = 4 * 1024 * 1024; // 4 MB isolate safety limit

  constructor(bucket: any) {
    this.bucket = bucket;
  }

  getDriverName(): 'R2_STORAGE' {
    return 'R2_STORAGE';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.bucket || typeof this.bucket.get !== 'function') return false;
    try {
      const manifest = await this.bucket.get('national/manifest.json');
      return manifest !== null;
    } catch {
      return false;
    }
  }

  async getJsonWithMeta<T>(key: string): Promise<{ data: T | null; bytes: number }> {
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
        console.error(`[WORKER MEMORY PROTECTION] Object ${key} is ${(size / 1024 / 1024).toFixed(2)} MB (> 4MB limit). Rejected.`);
        return { data: null, bytes: 0 };
      }
      const data = (await obj.json()) as T;
      return { data, bytes: size };
    } catch (e: any) {
      console.warn(`R2 fetch failed for key ${key}:`, e.message);
      return { data: null, bytes: 0 };
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const res = await this.getJsonWithMeta<T>(key);
    return res.data;
  }

  async getManifest(): Promise<NationalShardManifest | null> {
    return this.getJson<NationalShardManifest>('national/manifest.json');
  }
}

/**
 * Local Filesystem Driver for Node.js / Testing / Ingestion generator
 */
export class LocalShardsDriver implements NationalStorageDriver {
  private baseDir: string;
  private maxBytes = 4 * 1024 * 1024;

  constructor(baseDir?: string) {
    const path = require('path');
    const fs = require('fs');
    if (baseDir) {
      this.baseDir = baseDir;
    } else {
      const v2Path = path.join(process.cwd(), 'data', 'national_shards_v2');
      const v1Path = path.join(process.cwd(), 'data', 'national_shards');
      this.baseDir = fs.existsSync(path.join(v2Path, 'manifest.json')) ? v2Path : v1Path;
    }
  }

  getDriverName(): 'LOCAL_SHARDS' {
    return 'LOCAL_SHARDS';
  }

  async isAvailable(): Promise<boolean> {
    const fs = require('fs');
    const path = require('path');
    const manifestPath = path.join(this.baseDir, 'manifest.json');
    return fs.existsSync(manifestPath);
  }

  async getJsonWithMeta<T>(key: string): Promise<{ data: T | null; bytes: number }> {
    const fs = require('fs');
    const path = require('path');
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
        console.error(`[STORAGE MEMORY PROTECTION] Object ${key} is ${(stat.size / 1024 / 1024).toFixed(2)} MB (> 4MB limit). Rejected.`);
        return { data: null, bytes: 0 };
      }
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw) as T;
      return { data, bytes: stat.size };
    } catch (e: any) {
      console.warn(`Local shard read failed for ${filePath}:`, e.message);
      return { data: null, bytes: 0 };
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const res = await this.getJsonWithMeta<T>(key);
    return res.data;
  }

  async getManifest(): Promise<NationalShardManifest | null> {
    return this.getJson<NationalShardManifest>('manifest.json');
  }
}

/**
 * Adaptive National Storage Manager
 * Detects runtime environment: Cloudflare Worker (R2) vs Local Node.js
 */
export class AdaptiveNationalStorage {
  private static cachedDriver: NationalStorageDriver | null = null;

  static getDriver(): NationalStorageDriver {
    if (this.cachedDriver) return this.cachedDriver;

    // 1. Check if Cloudflare Worker R2 bucket is bound
    let r2Bucket: any = null;
    try {
      const { getCloudflareContext } = require('@opennextjs/cloudflare');
      const ctx = getCloudflareContext();
      const env = ctx?.env as any;
      if (env) {
        r2Bucket = env.NATIONAL_SHARDS || env.NATIONAL_STORAGE || env.NATIONAL_BUCKET;
      }
    } catch {
      // Expected outside OpenNext context
    }

    if (!r2Bucket) {
      const globalObj = globalThis as any;
      const workerEnv = globalObj.env || globalObj.__ENV__ || process.env;
      r2Bucket = workerEnv?.NATIONAL_SHARDS || workerEnv?.NATIONAL_STORAGE || workerEnv?.NATIONAL_BUCKET;
    }

    if (r2Bucket && typeof r2Bucket.get === 'function') {
      this.cachedDriver = new R2NationalStorageDriver(r2Bucket);
      return this.cachedDriver;
    }

    // 2. Check if running in Node.js with local shards available
    try {
      const fs = require('fs');
      const path = require('path');
      const v2Path = path.join(process.cwd(), 'data', 'national_shards_v2');
      const v1Path = path.join(process.cwd(), 'data', 'national_shards');
      const targetDir = fs.existsSync(path.join(v2Path, 'manifest.json')) ? v2Path : v1Path;
      if (fs.existsSync(targetDir)) {
        this.cachedDriver = new LocalShardsDriver(targetDir);
        return this.cachedDriver;
      }
    } catch {}

    // 3. Fallback unconfigured driver
    this.cachedDriver = {
      getDriverName: () => 'NOT_CONFIGURED',
      isAvailable: async () => false,
      getJson: async () => null,
      getManifest: async () => null,
    };

    return this.cachedDriver;
  }

  static resetCache() {
    this.cachedDriver = null;
  }
}
