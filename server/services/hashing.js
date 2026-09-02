const crypto = require('crypto');

function sha1Hex(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

// The original MurmurHash2 (32-bit) algorithm by Austin Appleby, ported from
// the reference Go implementation CurseForge's own fingerprinting is built
// on (github.com/aviddiviner/go-murmur, MurmurHash2). Verified against that
// package's own test vectors:
//   MurmurHash2("foo", 123)       === 1412061192
//   MurmurHash2("zztop", 123)     === 1878194508
//   MurmurHash2("foobarbaz", 234) === 1777016281
//   MurmurHash2("blam", 777)      === 1668928339
const MURMUR_M = 0x5bd1e995;
const MURMUR_R = 24;

function mmix(h, k) {
  k = Math.imul(k, MURMUR_M) >>> 0;
  k = (k ^ (k >>> MURMUR_R)) >>> 0;
  k = Math.imul(k, MURMUR_M) >>> 0;
  h = Math.imul(h, MURMUR_M) >>> 0;
  h = (h ^ k) >>> 0;
  return [h, k];
}

function murmurHash2(buf, seed) {
  let h = (seed ^ buf.length) >>> 0;
  let i = 0;
  let len = buf.length;
  while (len >= 4) {
    const k = (buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16) | (buf[i + 3] << 24)) >>> 0;
    [h] = mmix(h, k);
    i += 4;
    len -= 4;
  }
  switch (len) {
    case 3: h = (h ^ (buf[i + 2] << 16)) >>> 0; // falls through
    case 2: h = (h ^ (buf[i + 1] << 8)) >>> 0; // falls through
    case 1:
      h = (h ^ buf[i]) >>> 0;
      h = Math.imul(h, MURMUR_M) >>> 0;
  }
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, MURMUR_M) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h >>> 0;
}

// CurseForge computes its file "fingerprint" by stripping whitespace bytes
// (tab/LF/CR/space — byte values 9, 10, 13, 32) from the file before hashing
// it with MurmurHash2 at a fixed seed of 1.
function curseforgeFingerprint(buffer) {
  const filtered = Buffer.alloc(buffer.length);
  let j = 0;
  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    if (b !== 9 && b !== 10 && b !== 13 && b !== 32) {
      filtered[j++] = b;
    }
  }
  return murmurHash2(filtered.subarray(0, j), 1);
}

module.exports = { sha1Hex, murmurHash2, curseforgeFingerprint };
