const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const keyLine = envContent.split('\n').find((l) => l.startsWith('RADAR_SECURITY_KEY='));
if (!keyLine) {
  console.error('Missing RADAR_SECURITY_KEY in .env.local');
  process.exit(1);
}
const apiKey = keyLine.split('=')[1].trim();

const targetBatches = parseInt(process.argv[2] || '50', 10);
const baseUrl = process.env.BASE_URL || 'https://businessradar.cristianvaduva.com';

async function run() {
  console.log(`Starting continuous ingestion runner against ${baseUrl}`);
  console.log(`Target batches: ${targetBatches} (up to ${targetBatches * 25} records)`);

  let totalDiscovered = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  for (let i = 1; i <= targetBatches; i++) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${baseUrl}/api/monitoring/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ batchLimit: 25 }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`[Batch ${i}/${targetBatches}] HTTP ${res.status}: ${text}`);
        totalErrors++;
        if (totalErrors > 3) break;
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      const data = await res.json();
      const elapsed = Date.now() - t0;
      totalDiscovered += data.discoveredCount || 0;
      totalUpdated += data.updatedCount || 0;

      console.log(
        `[Batch ${i}/${targetBatches}] cursor: ${data.cursorLine} | new: +${data.discoveredCount} | updated: ${data.updatedCount} | duration: ${elapsed}ms`
      );

      // If at end of feed (no records discovered and no records updated)
      if (data.discoveredCount === 0 && data.updatedCount === 0 && data.cursorLine >= 7318) {
        console.log('✅ End of candidate feed reached. All records processed.');
        break;
      }

      // Small throttle to avoid hitting external ANAF rate limits
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`[Batch ${i}/${targetBatches}] Exception:`, err.message);
      totalErrors++;
      if (totalErrors > 3) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('═══════════════════════════════════════════════');
  console.log(`Ingestion run completed in ${totalTime}s`);
  console.log(`Total new companies discovered: ${totalDiscovered}`);
  console.log(`Total companies updated: ${totalUpdated}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log('═══════════════════════════════════════════════');
}

run();
