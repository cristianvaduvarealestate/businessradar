/**
 * PRODUCTION-GRADE CONTROLLED R2 UPLOADER
 * Implements strict security allowlist, dry-run mode, size validation (< 4 MB),
 * checksum calculation, and zero accidental file leak protection.
 *
 * Usage:
 *   Dry-Run (Default): node scripts/upload-national-shards-r2.js
 *   Explicit Execute:  node scripts/upload-national-shards-r2.js --execute
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const V2_DIR = path.resolve('data/national_shards_v2');
const DEFAULT_BUCKET = process.env.R2_BUCKET_NAME || 'businessradar-national-shards';
const MAX_OBJECT_BYTES = 4 * 1024 * 1024; // 4.0 MB strict limit

const ALLOWLIST_PATTERNS = [
  /^national\/manifest\.json$/,
  /^shards\/cui\/shard-[a-zA-Z0-9_\-\.]+\.json$/,
  /^shards\/county\/county-[a-zA-Z0-9_\-\.]+\.json$/,
  /^shards\/names\/prefix-[a-zA-Z0-9_\-\.]+\.json$/,
];

const FORBIDDEN_EXTENSIONS = ['.db', '.db-wal', '.db-shm', '.csv', '.env', '.jsonl', '.py', '.ts', '.js'];

function getUploadInventory() {
  const inventory = [];
  const manifestPath = path.join(V2_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json missing at ${manifestPath}`);
  }

  // 1. Manifest
  inventory.push({
    localPath: manifestPath,
    r2Key: 'national/manifest.json',
    size: fs.statSync(manifestPath).size,
  });

  // 2. Shards
  function walkDir(subDir, r2Prefix) {
    const fullDir = path.join(V2_DIR, subDir);
    if (!fs.existsSync(fullDir)) return;
    for (const f of fs.readdirSync(fullDir)) {
      const full = path.join(fullDir, f);
      const st = fs.statSync(full);
      if (st.isFile() && f.endsWith('.json')) {
        inventory.push({
          localPath: full,
          r2Key: `${r2Prefix}/${f}`,
          size: st.size,
        });
      }
    }
  }

  walkDir('shards/cui', 'shards/cui');
  walkDir('shards/county', 'shards/county');
  walkDir('shards/names', 'shards/names');

  return inventory;
}

function validateInventory(inventory) {
  let errors = 0;
  for (const item of inventory) {
    // Check allowlist
    const allowed = ALLOWLIST_PATTERNS.some((p) => p.test(item.r2Key));
    if (!allowed) {
      console.error(`[SECURITY ERROR] Unallowed R2 key: ${item.r2Key}`);
      errors++;
    }

    // Check forbidden extensions
    const ext = path.extname(item.localPath);
    if (FORBIDDEN_EXTENSIONS.includes(ext) && ext !== '.json') {
      console.error(`[SECURITY ERROR] Forbidden file extension: ${item.localPath}`);
      errors++;
    }

    // Check 4 MB limit
    if (item.size > MAX_OBJECT_BYTES) {
      console.error(`[SIZE ERROR] Object exceeds 4 MB: ${item.r2Key} (${item.size} bytes)`);
      errors++;
    }
  }

  if (errors > 0) {
    throw new Error(`Inventory validation failed with ${errors} security or size errors!`);
  }
}

async function run() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const isDryRun = !isExecute || args.includes('--dry-run');
  const bucketName = args.find((a) => a.startsWith('--bucket='))?.split('=')[1] || DEFAULT_BUCKET;

  console.log('======================================================================');
  console.log('🚀 CLOUDFLARE R2 CONTROLLED UPLOADER');
  console.log(`Mode        : ${isDryRun ? 'DRY-RUN (SIMULATION ONLY - ZERO REMOTE WRITES)' : 'LIVE EXECUTION'}`);
  console.log(`Bucket      : ${bucketName}`);
  console.log(`Source Dir  : ${V2_DIR}`);
  console.log('======================================================================\n');

  console.log('Building and validating upload inventory...');
  const inventory = getUploadInventory();
  validateInventory(inventory);

  const totalBytes = inventory.reduce((sum, i) => sum + i.size, 0);
  console.log(`Inventory Summary:`);
  console.log(`- Total Files to Upload : ${inventory.length.toLocaleString()}`);
  console.log(`- Total Upload Size     : ${(totalBytes / (1024 * 1024)).toFixed(2)} MB (${totalBytes.toLocaleString()} bytes)`);
  console.log(`- CUI Shards            : ${inventory.filter((i) => i.r2Key.startsWith('shards/cui/')).length}`);
  console.log(`- County Chunks         : ${inventory.filter((i) => i.r2Key.startsWith('shards/county/')).length}`);
  console.log(`- Name Prefixes         : ${inventory.filter((i) => i.r2Key.startsWith('shards/names/')).length}`);
  console.log(`- Manifest Objects      : ${inventory.filter((i) => i.r2Key.startsWith('national/')).length}`);
  console.log(`- Audit Files Excluded  : YES (0 audit files in inventory)`);
  console.log(`- Max Object Size       : ${(Math.max(...inventory.map((i) => i.size)) / (1024 * 1024)).toFixed(3)} MB (< 4.0 MB limit)`);

  if (isDryRun) {
    console.log('\n[DRY-RUN RESULT] Verification passed completely. No remote commands were executed.');
    console.log('To execute the actual upload once approved, run with: --execute');
    return;
  }

  // Live execution mode (requires explicit approval)
  console.log('\n[LIVE EXECUTION] Uploading objects to Cloudflare R2...');
  let uploadedCount = 0;
  for (const item of inventory) {
    const cmd = `npx wrangler r2 object put "${bucketName}/${item.r2Key}" --file="${item.localPath}" --content-type="application/json"`;
    execSync(cmd, { stdio: 'inherit' });
    uploadedCount++;
    if (uploadedCount % 500 === 0 || uploadedCount === inventory.length) {
      console.log(`Progress: ${uploadedCount} / ${inventory.length} uploaded...`);
    }
  }

  console.log('\n✅ Upload complete. Generating audit receipt...');
  const receipt = {
    timestamp: new Date().toISOString(),
    bucket: bucketName,
    totalFiles: uploadedCount,
    totalBytes,
    manifestSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(V2_DIR, 'manifest.json'))).digest('hex'),
  };
  fs.writeFileSync(path.join(V2_DIR, 'upload_receipt.json'), JSON.stringify(receipt, null, 2), 'utf8');
  console.log('Audit receipt saved to data/national_shards_v2/upload_receipt.json');
}

run().catch((err) => {
  console.error('Upload script error:', err.message);
  process.exit(1);
});
