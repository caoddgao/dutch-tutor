/** Small seeded generator, so a lesson's questions stay the same while it is open. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rnd: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Picks up to n items, preferring those closest to `target` by the given distance. */
export function pickClosest<T>(items: readonly T[], n: number, distance: (t: T) => number, rnd: () => number): T[] {
  return shuffle(items, rnd)
    .map((item) => ({ item, d: distance(item) + rnd() * 0.5 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.item);
}
