const { execFile } = require('child_process');

// A real browser UA is used because several of these sites serve a
// stripped-down or blocked page to obvious bot user agents.
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// Shells out to wget instead of using node-fetch. This isn't stylistic:
// PlanetMinecraft's Cloudflare bot management returns 403 specifically for
// node-fetch's TLS client fingerprint even with identical headers and UA,
// while wget (present in the node:alpine base image via busybox) passes —
// verified directly against the container. Using wget everywhere here keeps
// all scrapers on the client fingerprint that's actually known to work.
function wgetOnce(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile('wget', [
      '-qO-',
      '--header', `User-Agent: ${BROWSER_UA}`,
      '--header', 'Accept: text/html,application/xhtml+xml',
      '--timeout', String(Math.ceil(timeoutMs / 1000)),
      '--tries', '1',
      url
    ], { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(new Error(`wget failed for ${url}: ${err.message}`));
      resolve(stdout);
    });
  });
}

// A couple of these sites (PlanetMinecraft in particular) sit behind
// Cloudflare bot management that challenges some fraction of requests even
// with an identical client/headers — retrying a couple of times clears most
// of those transient 403s without adding much latency to a real user search.
async function fetchHtml(url, timeoutMs = 10000, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await wgetOnce(url, timeoutMs);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// Parses abbreviated counters like "1.1k" / "3.6k" / "2m" into a plain number
// for sorting. Falls back to null if it can't parse.
function parseAbbreviatedNumber(text) {
  if (!text) return null;
  const cleaned = String(text).trim().toLowerCase().replace(/,/g, '');
  const match = cleaned.match(/^([\d.]+)\s*(k|m|b)?$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (Number.isNaN(num)) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[match[2]] || 1;
  return Math.round(num * mult);
}

module.exports = { fetchHtml, parseAbbreviatedNumber, BROWSER_UA };
