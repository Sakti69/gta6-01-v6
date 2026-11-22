// Halcyon Bay itself: roads, blocks, buildings, landmarks, tokens, shops.
// The city is a grid: vertical roads at V_ROADS, horizontal at H_ROADS.
// Landmarks own whole blocks; every other block gets procedural buildings.
// Stage points for missions are always intersections, so they sit on a
// road by construction and never inside a building or landmark.
import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, ROAD_W, SHOPS, TAXI_STANDS, TOKEN_COUNT, PALETTE } from './config.js';
import { mulberry32, rand, randi, pick, pointInRect, clamp } from './util.js';

export const LANDMARKS = [
  { id: 'bowl', name: 'Halcyon Bowl', kind: 'stadium', x: 1564, y: 364, w: 272, h: 272, blurb: 'Home of the Bay Bolts. 40,000 seats, one very loud crowd.' },
  { id: 'airfield', name: 'Northgate Airfield', kind: 'airfield', x: 2764, y: 364, w: 272, h: 272, blurb: 'Private strip. The Comet coupe lives in hangar two.' },
  { id: 'ferry', name: 'Ferry Terminal', kind: 'ferry', x: 1564, y: 1964, w: 272, h: 272, blurb: 'Ferries to the islands. The pier is where deals get done.' },
  { id: 'casino', name: 'Crown Casino', kind: 'casino', x: 2364, y: 1164, w: 272, h: 272, blurb: 'The Crown sits in the vault upstairs. House always wins. Almost.' },
  { id: 'cityhall', name: 'City Hall', kind: 'hall', x: 764, y: 764, w: 272, h: 272, blurb: 'Marble, flags, and a mayor who owes everyone money.' },
  { id: 'pier', name: 'Sunset Pier', kind: 'pier', x: 364, y: 1964, w: 272, h: 272, blurb: 'Fishing, fries, and the best sunset on the bay.' },
  { id: 'park', name: 'Palm Court Park', kind: 'park', x: 1964, y: 764, w: 272, h: 272, blurb: 'Palms, benches, and a fountain full of wishes.' },
  { id: 'mall', name: 'Bayfront Mall', kind: 'mall', x: 1164, y: 1564, w: 272, h: 272, blurb: 'Three floors of shops nobody can afford.' },
];

const ROOFS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD, PALETTE.roofE];

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const world = {
    seed, buildings: [], parks: [], water: [], intersections: [],
    tokens: [], parked: [], roadRects: [],
  };
  // Water: the bay along the south edge, plus the marina basin by the pier.
  world.water.push({ x: 0, y: 2500, w: WORLD_W, h: WORLD_H - 2500 });
  world.water.push({ x: 300, y: 2364, w: 400, h: 136 });
  // Road rects for drawing and for the "is this point on a road" test.
  for (const x of V_ROADS) world.roadRects.push({ x: x - ROAD_W / 2, y: 0, w: ROAD_W, h: WORLD_H });
  for (const y of H_ROADS) world.roadRects.push({ x: 0, y: y - ROAD_W / 2, w: WORLD_W, h: ROAD_W });
  for (const x of V_ROADS) for (const y of H_ROADS) world.intersections.push({ x, y });
  // Blocks: the rectangles between neighbouring roads.
  const xs = [0, ...V_ROADS, WORLD_W];
  const ys = [0, ...H_ROADS, WORLD_H];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const bx = xs[bi] + ROAD_W / 2, by = ys[bj] + ROAD_W / 2;
      const bw = xs[bi + 1] - ROAD_W / 2 - bx, bh = ys[bj + 1] - ROAD_W / 2 - by;
      if (bw < 120 || bh < 120) continue; // edge slivers stay empty grass
      const block = { x: bx, y: by, w: bw, h: bh };
      const lm = LANDMARKS.find((l) => Math.abs(l.x - bx) < 4 && Math.abs(l.y - by) < 4);
      if (lm) continue; // landmark owns this block
      if (world.water.some((w) => w.x < block.x + block.w && w.x + w.w > block.x && w.y < block.y + block.h && w.y + w.h > block.y)) continue;
      if (rng() < 0.14) { world.parks.push({ ...block, trees: randi(rng, 5, 9) }); continue; }
      // One to four buildings per block, with a margin for sidewalks.
      const n = randi(rng, 1, 3);
      for (let k = 0; k < n; k++) {
        const w = rand(rng, 90, Math.min(190, bw - 40));
        const h = rand(rng, 80, Math.min(170, bh - 40));
        const x = bx + rand(rng, 16, Math.max(17, bw - w - 16));
        const y = by + rand(rng, 16, Math.max(17, bh - h - 16));
        const cand = { x, y, w, h, hgt: randi(rng, 1, 3), color: pick(rng, ROOFS), windows: randi(rng, 2, 5) };
        if (world.buildings.some((b) => b.x < cand.x + cand.w + 18 && b.x + b.w + 18 > cand.x && b.y < cand.y + cand.h + 18 && b.y + b.h + 18 > cand.y)) continue;
        world.buildings.push(cand);
      }
    }
  }
  // Sunset tokens: 24 of them, on road centrelines and sidewalk corners,
  // never inside a building or a landmark.
  const spots = [];
  for (const p of world.intersections) {
    spots.push({ x: p.x + 52, y: p.y - 52 });
    spots.push({ x: p.x - 52, y: p.y + 52 });
  }
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  world.tokens = spots.slice(0, TOKEN_COUNT).map((p, i) => ({ id: i, x: p.x, y: p.y, taken: false }));
  // Parked cars along road edges.
  const models = ['sedan', 'coupe', 'truck', 'hatch'];
  for (let i = 0; i < 26; i++) {
    const vx = pick(rng, V_ROADS), hy = pick(rng, H_ROADS);
    const along = rand(rng, 90, 310) * (rng() < 0.5 ? 1 : -1);
    const horiz = rng() < 0.5;
    const x = horiz ? clamp(vx + along, 120, WORLD_W - 120) : vx + (rng() < 0.5 ? 44 : -44);
    const y = horiz ? hy + (rng() < 0.5 ? 44 : -44) : clamp(hy + along, 120, WORLD_H - 120);
    if (world.buildings.some((b) => pointInRect(x, y, { x: b.x - 30, y: b.y - 30, w: b.w + 60, h: b.h + 60 }))) continue;
    world.parked.push({ x, y, angle: horiz ? 0 : Math.PI / 2, model: pick(rng, models), color: pick(rng, ['#c94f43', '#4d7a9e', '#c98f4e', '#7a7f8c', '#5d8a6a', '#d8c25a']) });
  }
  return world;
}

export function isOnRoad(world, x, y) {
  return world.roadRects.some((r) => pointInRect(x, y, r));
}
export function landmarkAt(world, x, y) {
  return LANDMARKS.find((l) => pointInRect(x, y, l)) || null;
}
export function buildingAt(world, x, y, pad = 0) {
  return world.buildings.find((b) => pointInRect(x, y, { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 })) || null;
}
export function inWater(world, x, y) {
  return world.water.some((w) => pointInRect(x, y, w));
}
// A road point: the intersection of vertical road i and horizontal road j.
export function roadPoint(i, j) { return { x: V_ROADS[i], y: H_ROADS[j] }; }
export function nearestIntersection(world, x, y) {
  let best = world.intersections[0], bd = Infinity;
  for (const p of world.intersections) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
export function districtAt(x, y) {
  if (y < 700) return x < 1900 ? 'Northgate' : 'Airfield District';
  if (y < 1500) return x < 1100 ? 'Old Town' : x < 2300 ? 'Grand Avenue' : 'East Bay';
  if (y < 2300) return x < 1100 ? 'The Docks' : x < 2300 ? 'Marina' : 'South Park';
  return 'Bayfront';
}
export { SHOPS, TAXI_STANDS };
