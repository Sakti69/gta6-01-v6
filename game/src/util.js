// Small math and RNG helpers. No dependencies.
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
export function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
export function angTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function angLerp(a, b, t) { return a + angDiff(a, b) * clamp(t, 0, 1); }
// Deterministic RNG so ?seed= replays the same city and traffic.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function rand(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function randi(rng, lo, hi) { return Math.floor(rand(rng, lo, hi + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function pointInRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
// Push a circle out of an axis-aligned rect. Returns true when a push happened.
export function circleRectResolve(p, r, rect) {
  const cx = clamp(p.x, rect.x, rect.x + rect.w);
  const cy = clamp(p.y, rect.y, rect.y + rect.h);
  const dx = p.x - cx, dy = p.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r || d2 === 0) {
    if (d2 === 0) { p.y = rect.y - r; return true; }
    return false;
  }
  const d = Math.sqrt(d2);
  p.x = cx + (dx / d) * r;
  p.y = cy + (dy / d) * r;
  return true;
}
export function fmtCash(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
export function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}
