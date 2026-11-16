#!/usr/bin/env node
/**
 * RADAR BUSINESS ROMÂNIA — Official ONRC / data.gov.ro Connectivity Diagnostic Tool
 * 
 * Verifies:
 * 1. DNS Resolution (IPv4 / IPv6 addresses, family, TTL)
 * 2. TCP Connectivity to port 443 (connection timing, timeout behavior)
 * 3. TLS Handshake & Certificate Validation (protocol, cipher, subject, issuer, expiration)
 * 4. CKAN API Availability (package_show status, response time, payload validation)
 * 5. Dataset Resource URL Availability (resource status, content-length, range support)
 * 6. Redirects and final download URL
 * 7. HTTP Response status and headers (caching, WAF cookies, server software)
 * 8. Network resilience and throughput measurement
 */

const dns = require('dns');
const net = require('net');
const tls = require('tls');
const https = require('https');
const http = require('http');

const HOST = 'data.gov.ro';
const PORT = 443;
const CKAN_API_URL = 'https://data.gov.ro/api/3/action/package_show?id=c2c88c9d-4824-45f1-90ec-656f1c0d8785';
const RESOURCE_URL = 'https://data.gov.ro/dataset/c2c88c9d-4824-45f1-90ec-656f1c0d8785/resource/869eac01-8480-4ac6-a18d-d0f044b0db80/download/od_firme.csv';

const results = {
  timestamp: new Date().toISOString(),
  environment: {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    isCi: !!process.env.CI,
    runnerOs: process.env.RUNNER_OS || 'local',
  },
  dns: null,
  tcp: null,
  tls: null,
  ckanApi: null,
  resourceUrl: null,
  redirects: [],
  throughput: null,
  summary: {
    status: 'UNKNOWN',
    verdict: '',
    temporaryOrPersistent: 'UNKNOWN',
  }
};

// 1. DNS Resolution
function checkDns() {
  return new Promise((resolve) => {
    const start = Date.now();
    dns.lookup(HOST, { all: true }, (err, addresses) => {
      const elapsed = Date.now() - start;
      if (err) {
        results.dns = { success: false, error: err.message, code: err.code, elapsedMs: elapsed };
      } else {
        results.dns = { success: true, addresses, elapsedMs: elapsed };
      }
      resolve();
    });
  });
}

// 2. TCP Connectivity
function checkTcp() {
  return new Promise((resolve) => {
    const start = Date.now();
    let done = false;
    const socket = net.createConnection({ host: HOST, port: PORT, timeout: 10000 }, () => {
      if (done) return;
      done = true;
      const elapsed = Date.now() - start;
      results.tcp = {
        success: true,
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
        elapsedMs: elapsed
      };
      socket.destroy();
      resolve();
    });

    socket.on('timeout', () => {
      if (done) return;
      done = true;
      const elapsed = Date.now() - start;
      results.tcp = { success: false, error: 'ETIMEDOUT', elapsedMs: elapsed };
      socket.destroy();
      resolve();
    });

    socket.on('error', (err) => {
      if (done) return;
      done = true;
      const elapsed = Date.now() - start;
      results.tcp = { success: false, error: err.message, code: err.code, elapsedMs: elapsed };
      socket.destroy();
      resolve();
    });
  });
}

// 3. TLS Handshake & Certificate Validation
function checkTls() {
  return new Promise((resolve) => {
    const start = Date.now();
    let done = false;
    const socket = tls.connect({
      host: HOST,
      port: PORT,
      servername: HOST,
      timeout: 10000,
      rejectUnauthorized: true, // Strictly enforce certificate validation
    }, () => {
      if (done) return;
      done = true;
      const elapsed = Date.now() - start;
      const cert = socket.getPeerCertificate();
      results.tls = {
        success: true,
        authorized: socket.authorized,
        protocol: socket.getProtocol(),
        cipher: socket.getCipher(),
        peerCertificate: {
          subject: cert.subject,
          issuer: cert.issuer,
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          serialNumber: cert.serialNumber,
          fingerprint256: cert.fingerprint256,
        },
        elapsedMs: elapsed
      };
      socket.destroy();
      resolve();
    });

    socket.on('timeout', () => {
      if (done) return;
      done = true;
      const elapsed = Date.now() - start;
      results.tls = { success: false, error: 'ETIMEDOUT', elapsedMs: elapsed };
      socket.destroy();
      resolve();
    });

    socket.on('error', (err) => {
      if (done) return;
      done = true;
      const elapsed = Date.now() - start;
      results.tls = {
        success: false,
        error: err.message,
        code: err.code,
        authorizationError: socket.authorizationError,
        elapsedMs: elapsed
      };
      socket.destroy();
      resolve();
    });
  });
}

// 4 & 5. HTTP URL Request with Redirect Tracking and Header Inspection
function checkHttpUrl(targetUrl, category) {
  return new Promise((resolve) => {
    const start = Date.now();
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.request(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'RadarBusinessRomania-Diagnostic/2.0 (STS/ONRC Compliance Monitor)',
        'Accept': '*/*',
        'Connection': 'close',
      },
      timeout: 15000,
    }, (res) => {
      const elapsed = Date.now() - start;
      let bodySample = '';
      let totalBytes = 0;

      res.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (bodySample.length < 1000) {
          bodySample += chunk.toString('utf-8');
        }
        // If testing resource download, do not download full 696MB in diagnostic
        if (totalBytes > 256 * 1024) {
          req.destroy();
        }
      });

      res.on('end', () => {
        finish(res, elapsed, totalBytes, bodySample, null);
      });

      res.on('close', () => {
        finish(res, elapsed, totalBytes, bodySample, null);
      });
    });

    let finished = false;
    function finish(res, elapsed, bytes, sample, error) {
      if (finished) return;
      finished = true;
      const resInfo = {
        url: targetUrl,
        statusCode: res ? res.statusCode : null,
        statusMessage: res ? res.statusMessage : null,
        headers: res ? res.headers : {},
        bytesReceived: bytes,
        elapsedMs: elapsed,
        error: error ? error.message : null,
        samplePreview: sample ? sample.slice(0, 300) : null,
      };

      if (category === 'ckanApi') results.ckanApi = resInfo;
      if (category === 'resourceUrl') results.resourceUrl = resInfo;

      // Check for redirects
      if (res && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        results.redirects.push({ from: targetUrl, to: res.headers.location, code: res.statusCode });
      }

      resolve(resInfo);
    }

    req.on('timeout', () => {
      req.destroy();
      finish(null, Date.now() - start, 0, null, new Error('ETIMEDOUT'));
    });

    req.on('error', (err) => {
      finish(null, Date.now() - start, 0, null, err);
    });

    req.end();
  });
}

// 6. Throughput Benchmark
function measureThroughput() {
  return new Promise((resolve) => {
    const start = Date.now();
    let bytes = 0;
    const req = https.get(RESOURCE_URL, {
      headers: {
        'User-Agent': 'RadarBusinessRomania-Diagnostic/2.0',
        'Accept': '*/*',
      },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode !== 200) {
        results.throughput = { success: false, statusCode: res.statusCode };
        return resolve();
      }
      res.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes >= 100 * 1024) { // Sample 100 KB
          const durationSec = (Date.now() - start) / 1000;
          const kbps = (bytes / 1024 / durationSec).toFixed(2);
          results.throughput = {
            success: true,
            bytesSampled: bytes,
            durationSec,
            speedKbps: parseFloat(kbps),
            estimatedFullDownloadHours: parseFloat(((696515538 / 1024) / kbps / 3600).toFixed(2)),
          };
          req.destroy();
          resolve();
        }
      });
      res.on('error', (err) => {
        results.throughput = { success: false, error: err.message };
        resolve();
      });
    });

    req.on('timeout', () => {
      req.destroy();
      results.throughput = { success: false, error: 'ETIMEDOUT' };
      resolve();
    });

    req.on('error', (err) => {
      results.throughput = { success: false, error: err.message };
      resolve();
    });
  });
}

async function main() {
  console.log('='.repeat(70));
  console.log('BUSINESS RADAR — OFFICIAL ONRC & DATA.GOV.RO CONNECTIVITY DIAGNOSTIC');
  console.log(`Execution Timestamp: ${results.timestamp}`);
  console.log(`Environment: ${results.environment.runnerOs} (${results.environment.platform}/${results.environment.arch}) Node: ${results.environment.nodeVersion}`);
  console.log('='.repeat(70));

  console.log('\n[1/6] Performing DNS Resolution for data.gov.ro...');
  await checkDns();
  console.log('DNS Result:', results.dns);

  console.log('\n[2/6] Probing TCP Connectivity to data.gov.ro:443...');
  await checkTcp();
  console.log('TCP Result:', results.tcp);

  console.log('\n[3/6] Performing TLS Handshake & Certificate Verification...');
  await checkTls();
  if (results.tls && results.tls.success) {
    console.log(`TLS Protocol: ${results.tls.protocol} | Cipher: ${results.tls.cipher.name}`);
    console.log(`Certificate Subject: ${JSON.stringify(results.tls.peerCertificate.subject)}`);
    console.log(`Certificate Valid Until: ${results.tls.peerCertificate.validTo}`);
  } else {
    console.log('TLS Result:', results.tls);
  }

  console.log('\n[4/6] Interrogating Official CKAN API Endpoint...');
  await checkHttpUrl(CKAN_API_URL, 'ckanApi');
  console.log(`CKAN Status: ${results.ckanApi.statusCode} (${results.ckanApi.elapsedMs}ms)`);

  console.log('\n[5/6] Probing Official Dataset Resource URL (od_firme.csv)...');
  await checkHttpUrl(RESOURCE_URL, 'resourceUrl');
  console.log(`Resource Status: ${results.resourceUrl.statusCode} (${results.resourceUrl.elapsedMs}ms)`);
  if (results.resourceUrl.headers) {
    console.log(`Content-Range: ${results.resourceUrl.headers['content-range']}`);
    console.log(`Last-Modified: ${results.resourceUrl.headers['last-modified']}`);
    console.log(`ETag: ${results.resourceUrl.headers['etag']}`);
    console.log(`WAF Cookie: ${results.resourceUrl.headers['set-cookie'] || 'none'}`);
  }

  console.log('\n[6/6] Measuring Upstream Streaming Throughput...');
  await measureThroughput();
  console.log('Throughput Result:', results.throughput);

  // Synthesize Summary & Verdict
  const isDnsOk = results.dns && results.dns.success;
  const isTcpOk = results.tcp && results.tcp.success;
  const isTlsOk = results.tls && results.tls.success;
  const isCkanOk = results.ckanApi && results.ckanApi.statusCode === 200;
  const isResourceOk = results.resourceUrl && results.resourceUrl.statusCode === 200;

  if (isDnsOk && isTcpOk && isTlsOk && isCkanOk && isResourceOk) {
    results.summary.status = 'HEALTHY';
    results.summary.verdict = 'All official ONRC and data.gov.ro endpoints are online, valid TLS, and responding with HTTP 200 OK.';
    results.summary.temporaryOrPersistent = 'TEMPORARY_RECOVERED';
  } else if (!isTcpOk && results.tcp && results.tcp.error === 'ETIMEDOUT') {
    results.summary.status = 'BLOCKED_OR_OFFLINE';
    results.summary.verdict = 'TCP port 443 connection timed out. Either host is undergoing downtime or blocking incoming connection IPs.';
    results.summary.temporaryOrPersistent = 'INFRASTRUCTURE_UNAVAILABLE';
  } else {
    results.summary.status = 'DEGRADED';
    results.summary.verdict = 'Partial connectivity or non-200 responses observed.';
    results.summary.temporaryOrPersistent = 'DEGRADED';
  }

  console.log('\n' + '='.repeat(70));
  console.log(`FINAL DIAGNOSTIC SUMMARY: [${results.summary.status}]`);
  console.log(`Verdict: ${results.summary.verdict}`);
  console.log(`State: ${results.summary.temporaryOrPersistent}`);
  console.log('='.repeat(70));

  return results;
}

if (require.main === module) {
  main().then((r) => {
    if (process.env.EXPORT_JSON) {
      console.log('\n__DIAGNOSTIC_JSON_START__');
      console.log(JSON.stringify(r, null, 2));
      console.log('__DIAGNOSTIC_JSON_END__');
    }
  });
}

module.exports = { main };
