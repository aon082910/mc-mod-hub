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
//
// A same-origin Referer is also always sent, on the reasoning that it looks
// more like a real browser navigation — worth noting honestly that a closer
// look disproved the original theory here (that PlanetMinecraft's WAF
// specifically required one on `/mods/?keywords=`): re-tested the exact same
// request repeatedly with and without a Referer and got 200 both ways, so
// the earlier "fixed it" read was just a lucky timing window, not a real
// fix. Left in anyway since it's harmless and can't hurt; the actual
// behavior is the plain probabilistic Cloudflare challenge described below.
function wgetOnce(url, timeoutMs) {
  const referer = new URL(url).origin + '/';
  return new Promise((resolve, reject) => {
    execFile('wget', [
      '-qO-',
      '--header', `User-Agent: ${BROWSER_UA}`,
      '--header', 'Accept: text/html,application/xhtml+xml',
      '--header', `Referer: ${referer}`,
      '--timeout', String(Math.ceil(timeoutMs / 1000)),
      '--tries', '1',
      url
    ], { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(new Error(`wget failed for ${url}: ${err.message}`));
      resolve(stdout);
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// A couple of these sites (PlanetMinecraft in particular) sit behind
// Cloudflare bot management that challenges some fraction of requests even
// with an identical client/headers/IP — the exact same request can 200 one
// second and 403 the next with nothing distinguishing them from outside.
// Retrying immediately often just re-hits the same rejected window, so each
// retry waits a bit longer (400ms, then 900ms) before trying again — cheap
// insurance against a transient block without adding much latency to a real
// search, though it's still fundamentally a "roll the dice again" mitigation,
// not a fix, since this behavior is on PlanetMinecraft's end and outside
// this app's control.
async function fetchHtml(url, timeoutMs = 10000, retries = 3) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(400 * attempt);
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
