// Pedestrians: they stroll the sidewalks, cross at intersections, run
// from gunfire, and call the cops when they watch a crime happen.
import { V_ROADS, H_ROADS, WORLD_W, WORLD_H } from './config.js';
import { dist, rand, pick, clamp } from './util.js';
import { isOnRoad } from './world.js';
import { addWanted } from './vehicles.js';

const SHIRTS = ['#e86a5a', '#5a8fd8', '#e8c25a', '#7ed08a', '#c97fd8', '#e8e8e8', '#5ad0c8'];
const PANTS = ['#2f3542', '#4a3b52', '#5a4a3b', '#37474f'];

export function makePed(S, x, y) {
  return {
    x, y, angle: rand(S.rng, 0, Math.PI * 2), speed: rand(S.rng, 45, 75),
    shirt: pick(S.rng, SHIRTS), pants: pick(S.rng, PANTS),
    tx: x, ty: y, flee: 0, wait: rand(S.rng, 0, 2), dead: false,
  };
}

export function spawnPeds(S, n) {
  for (let i = 0; i < n; i++) {
    const vx = pick(S.rng, V_ROADS), hy = pick(S.rng, H_ROADS);
    const x = clamp(vx + (Math.random() < 0.5 ? -52 : 52) + rand(S.rng, -120, 120), 40, WORLD_W - 40);
    const y = clamp(hy + (Math.random() < 0.5 ? -52 : 52) + rand(S.rng, -120, 120), 40, WORLD_H - 40);
    S.peds.push(makePed(S, x, y));
  }
}

function pickStrollTarget(S, p) {
  const vx = pick(S.rng, V_ROADS), hy = pick(S.rng, H_ROADS);
  // Sidewalk offset: beside a road, not on it.
  if (Math.random() < 0.5) return { x: clamp(vx + (Math.random() < 0.5 ? -52 : 52), 40, WORLD_W - 40), y: clamp(hy + rand(S.rng, -200, 200), 40, WORLD_H - 40) };
  return { x: clamp(vx + rand(S.rng, -200, 200), 40, WORLD_W - 40), y: clamp(hy + (Math.random() < 0.5 ? -52 : 52), 40, WORLD_H - 40) };
}

export function updatePeds(S, dt) {
  const p = S.player;
  for (const ped of S.peds) {
    if (ped.dead) continue;
    // Flee from nearby gunfire or a speeding car.
    let threat = null;
    if (S.gunfireTimer > 0 && dist(ped.x, ped.y, p.x, p.y) < 420) threat = p;
    if (p.car && Math.abs(p.car.speed) > 300 && dist(ped.x, ped.y, p.car.x, p.car.y) < 160) threat = p.car;
    if (threat) ped.flee = 1.6;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const a = Math.atan2(ped.y - threat.y, ped.x - threat.x);
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
      ped.angle = a;
      continue;
    }
    if (ped.wait > 0) { ped.wait -= dt; continue; }
    const d = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (d < 12) { ped.wait = rand(S.rng, 1, 5); const t = pickStrollTarget(S, ped); ped.tx = t.x; ped.ty = t.y; continue; }
    ped.angle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    // Keep peds out of buildings and water.
    for (const b of S.world.buildings) {
      if (ped.x > b.x - 8 && ped.x < b.x + b.w + 8 && ped.y > b.y - 8 && ped.y < b.y + b.h + 8) {
        ped.tx = ped.x + (ped.x < b.x + b.w / 2 ? -80 : 80); ped.ty = ped.y;
      }
    }
  }
  // Recycle far peds near the camera so the streets never feel empty.
  for (const ped of S.peds) {
    if (dist(ped.x, ped.y, S.camera.x, S.camera.y) > 1400) {
      const vx = pick(S.rng, V_ROADS), hy = pick(S.rng, H_ROADS);
      ped.x = clamp(S.camera.x + rand(S.rng, -700, 700), 60, WORLD_W - 60);
      ped.y = clamp(S.camera.y + rand(S.rng, -700, 700), 60, WORLD_H - 60);
      ped.tx = ped.x; ped.ty = ped.y; ped.wait = 0; ped.flee = 0;
    }
  }
}

// A witness watches a crime: if a living ped is close and the player is
// in the open, heat rises. Called by combat and car theft.
export function witnessCheck(S, x, y, heat) {
  for (const ped of S.peds) {
    if (ped.dead || ped.flee > 0) continue;
    if (dist(ped.x, ped.y, x, y) < 320) {
      addWanted(S, heat, 'a pedestrian called it in');
      ped.flee = 2;
      return true;
    }
  }
  return false;
}
