// Lightweight heuristic scorer for spotting likely-fake / low-trust comments.
// This is NOT a verified fraud detector — it flags patterns worth a human's
// second look (near-duplicate praise, no specifics, suspicious timing bursts).
// Score is 0 (looks fine) to 100 (very suspicious).

const GENERIC_PRAISE = [
  'great mod', 'love this', 'best mod', 'awesome mod', 'works great',
  'amazing mod', 'good mod', '10/10', 'nice mod', 'perfect', 'thanks for this'
];

function normalize(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function levenshteinSimilarity(a, b) {
  a = normalize(a); b = normalize(b);
  if (!a.length || !b.length) return 0;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const dist = dp[a.length][b.length];
  return 1 - dist / Math.max(a.length, b.length);
}

function scoreComments(comments) {
  const scored = comments.map(c => ({ ...c, flags: [], score: 0 }));

  for (let i = 0; i < scored.length; i++) {
    const c = scored[i];
    const text = normalize(c.body || c.text || '');
    let score = 0;

    if (text.length > 0 && text.length < 25) {
      score += 15;
      c.flags.push('very short');
    }
    if (GENERIC_PRAISE.some(p => text.includes(p)) && text.length < 60) {
      score += 20;
      c.flags.push('generic praise, no specifics');
    }
    if (!/[.!?]/.test(c.body || '') && text.length < 40) {
      score += 5;
      c.flags.push('no punctuation / low effort');
    }

    // Near-duplicate detection against other comments in the same batch.
    for (let j = 0; j < scored.length; j++) {
      if (i === j) continue;
      const other = scored[j];
      const sim = levenshteinSimilarity(c.body || '', other.body || '');
      if (sim > 0.85 && text.length > 5) {
        score += 30;
        if (!c.flags.includes('near-duplicate of another comment')) {
          c.flags.push('near-duplicate of another comment');
        }
        break;
      }
    }

    // Timing burst: many comments in this batch within a tight window can
    // indicate coordinated / purchased reviews.
    if (typeof c.createdUtc === 'number') {
      const nearby = scored.filter(o =>
        typeof o.createdUtc === 'number' && Math.abs(o.createdUtc - c.createdUtc) < 3600
      ).length;
      if (nearby >= 4) {
        score += 15;
        c.flags.push('posted in a burst with several others');
      }
    }

    c.score = Math.min(100, score);
    c.trust = c.score >= 50 ? 'low' : c.score >= 25 ? 'medium' : 'normal';
  }

  return scored;
}

module.exports = { scoreComments };
