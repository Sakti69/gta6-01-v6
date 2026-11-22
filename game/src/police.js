// The wanted system and the Halcyon Bay PD. Heat 0-100 maps to 0-5 stars.
// Police cars spawn on roads near the player, chase, and ram. On foot, a
// cop who stays on top of the player busts them. Hide and heat decays.
import { WORLD_W, WORLD_H } from './config.js';
import { clamp, dist, angLerp, rand, pick } from './util.js';
import { makeCar, randomRoadPointNear, spawnSparks } from './vehicles.js';
import { nearestIntersection } from './world.js';

export function updateWanted(S, dt) {
  const w = S.wanted;
  w.stars = clamp(Math.floor(w.heat / 20), 0, 5);
  const p = S.player;
  // Is any cop close enough to see the player?
  let seen = false;
  for (const c of S.cops) {
    if (dist(c.x, c.y, p.x, p.y) < 700) { seen = true; break; }
  }
  if (!seen && w.heat > 0 && !S.mission?.lockWanted) {
    w.heat = Math.max(0, w.heat - 2.4 * dt * (w.stars >= 3 ? 0.4 : 1));
  }
  w.stars = clamp(Math.floor(w.heat / 20), 0, 5);
  // Spawn pressure scales with stars; cap the fleet.
  const wantCops = w.stars === 0 ? 0 : Math.min(1 + w.stars, 6);
  const live = S.cops.filter((c) => !c.dead).length;
  S.copTimer -= dt;
  if (live < wantCops && S.copTimer <= 0) {
    S.copTimer = w.stars >= 4 ? 1.2 : 2.5;
    const pt = randomRoadPointNear(S, p.x, p.y, 700);
    const car = makeCar(pt.x, pt.y, 0, 'police', 'police');
    car.hp = 120;
    S.cars.push(car);
    S.cops.push(car);
    S.audio.siren(true);
  }
  if (live === 0 && w.stars === 0) S.audio.siren(false);
}

export function updateCops(S, dt) {
  const p = S.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  for (const cop of S.cops) {
    if (cop.dead) continue;
    const d = dist(cop.x, cop.y, px, py);
    // Chase: steer at the player, faster than traffic, ramming speed.
    const want = Math.atan2(py - cop.y, px - cop.x);
    cop.angle = angLerp(cop.angle, want, dt * 4.5);
    const top = 430 + S.wanted.stars * 35;
    cop.speed = clamp(cop.speed + (top - cop.speed) * dt * 1.2, 0, top);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    // Buildings stop cops like everyone else (slide along).
    for (const b of S.world.buildings) {
      if (cop.x > b.x - 20 && cop.x < b.x + b.w + 20 && cop.y > b.y - 20 && cop.y < b.y + b.h + 20) {
        cop.speed *= 0.5;
        cop.angle += 0.6 * dt;
      }
    }
    // Ram the player's car.
    if (p.car && d < 52) {
      p.car.hp -= 26 * dt;
      p.car.speed *= 0.985;
      if (Math.random() < dt * 6) spawnSparks(S, cop.x, cop.y, 4);
      if (p.car.hp <= 0) { S.toast('Your car is wrecked', '#ff5a4e'); wreckPlayerCar(S); }
    }
    // Bust the player on foot: a cop standing on them for a moment.
    if (!p.car && d < 30) {
      S.bustTimer += dt;
      if (S.bustTimer > 1.4) { bustPlayer(S); return; }
    } else {
      S.bustTimer = Math.max(0, S.bustTimer - dt * 2);
    }
    // Cops too far away give up and despawn.
    if (d > 1800) { cop.dead = true; }
  }
  S.cops = S.cops.filter((c) => !c.dead);
  S.cars = S.cars.filter((c) => !c.dead || c.driver === 'player');
}

function wreckPlayerCar(S) {
  const car = S.player.car;
  if (!car) return;
  car.dead = true;
  S.player.car = null;
  S.player.x = car.x + 40; S.player.y = car.y + 40;
  S.audio.crash();
  spawnSparks(S, car.x, car.y, 24);
}

function bustPlayer(S) {
  S.mode = 'busted';
  S.bustTimer = 0;
  const fine = Math.floor(S.cash * 0.1);
  S.cash -= fine;
  S.wanted.heat = 0; S.wanted.stars = 0;
  for (const c of S.cops) c.dead = true;
  S.cops = [];
  S.audio.siren(false);
  S.audio.fail();
  S.bustedFine = fine;
  S.player.hp = 100;
  // The player wakes up outside City Hall, on foot.
  S.player.x = 700; S.player.y = 760; S.player.car = null;
  S.camera.x = S.player.x; S.camera.y = S.player.y;
}
