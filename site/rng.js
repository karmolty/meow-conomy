// Tiny deterministic PRNG (xorshift32).
// Use for per-save deterministic randomness: seed + same actions => same outcomes.

/**
 * @param {number} seed Unsigned 32-bit.
 */
export function createRng(seed) {
  // xorshift32 has a bad all-zero absorbing state; avoid it.
  let s = (seed >>> 0) || 0xA5A5A5A5;

  function nextU32() {
    // xorshift32
    s ^= (s << 13) >>> 0;
    s ^= (s >>> 17) >>> 0;
    s ^= (s << 5) >>> 0;
    return (s >>> 0);
  }

  function float() {
    // [0,1)
    return nextU32() / 2 ** 32;
  }

  function int(maxExclusive) {
    // [0, maxExclusive)
    if (!(maxExclusive > 0)) return 0;
    return Math.floor(float() * maxExclusive);
  }

  function range(min, max) {
    // [min, max)
    return min + float() * (max - min);
  }

  function gaussianish() {
    // Approx N(0,1) via sum-of-uniforms (CLT). Good enough for “noise”.
    // Sum 6 uniforms => mean 3, variance 0.5, so scale to ~1.
    let x = 0;
    for (let i = 0; i < 6; i++) x += float();
    return (x - 3) * Math.SQRT2;
  }

  function getState() { return s >>> 0; }
  function setState(u32) { s = (u32 >>> 0) || 0xA5A5A5A5; }

  return { nextU32, float, int, range, gaussianish, getState, setState };
}
