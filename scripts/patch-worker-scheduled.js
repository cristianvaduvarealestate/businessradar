const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, '..', '.open-next', 'worker.js');

if (fs.existsSync(workerPath)) {
  let content = fs.readFileSync(workerPath, 'utf8');

  // If already patched, exit cleanly
  if (content.includes('async scheduled(')) {
    console.log('ℹ️ .open-next/worker.js already contains scheduled cron handler.');
    process.exit(0);
  }

  const scheduledHandler = `    async scheduled(controller, env, ctx) {
        console.log("[CRON] Scheduled event fired at", new Date(controller.scheduledTime).toISOString(), "cron:", controller.cron);
        const req = new Request("https://businessradar.cristianvaduva.com/api/monitoring/sync", {
            method: "POST",
            headers: {
                "x-cron-trigger": "true",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ batchLimit: 25, executionType: "SCHEDULED" })
        });
        ctx.waitUntil(
            this.fetch(req, env, ctx)
                .then(async (res) => {
                    const text = await res.text();
                    console.log("[CRON] Scheduled sync completed with HTTP " + res.status + ":", text);
                })
                .catch((err) => {
                    console.error("[CRON] Scheduled sync invocation error:", err);
                })
        );
    },
};`;

  const lastIndex = content.lastIndexOf('};');
  if (lastIndex !== -1) {
    content = content.substring(0, lastIndex) + scheduledHandler;
    fs.writeFileSync(workerPath, content, 'utf8');
    console.log('✅ Successfully patched .open-next/worker.js with scheduled cron handler!');
  } else {
    console.warn('⚠️ Could not find closing brace in .open-next/worker.js');
  }
} else {
  console.warn('⚠️ .open-next/worker.js does not exist yet.');
}
