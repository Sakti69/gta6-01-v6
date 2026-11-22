// Cars: arcade driving for the player, road-following AI for traffic,
// and the steal-a-car interaction. All cars share one shape.
import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, CAR_ACCEL, CAR_MAX_SPEED, CAR_REVERSE, CAR_GRIP } from './config.js';
import { clamp, angDiff, angLerp, dist, rand, pick, circleRectResolve } from './util.js';
import { isOnRoad, nearestIntersection } from './world.js';

const MODELS = {
  sedan: { w: 46, h: 22, top: 1.0, color: '#c94f43' },
  coupe: { w: 44, h: 20, top: 1.18, color: '#ffd166' },
  truck: { w: 58, h: 24, top: 0.8, color: '#7a7f8c' },
  hatch: { w: 40, h: 20, top: 1.05, color: '#5d8a6a' },
  taxi: { w: 46, h: 22, top: 1.0, color: '#f2c230' },
  police: { w: 48, h: 22, top: 1.25, color: '#2f3542' },
};
const TRAFFIC_COLORS = ['#c94f43', '#4d7a9e', '#c98f4e', '#7a7f8c', '#5d8a6a', '#d8c25a', '#8a6e9e', '#d8d2c2'];

export function makeCar(x, y, angle, model, driver) {
  const m = MODELS[model] || MODELS.sedan;
  return {
    x, y, angle, speed: 0, model, driver: driver || 'traffic',
    w: m.w, h: m.h, top: m.top, color: m.color, hp: 100,
    target: null, stuck: 0, honk: 0, nitro: 0, plate: false, dead: false,
  };
}

// Player driving: throttle, brake/reverse, steering that bites with speed,
// a little drift, and a slide along building rects.
export function drivePlayer(S, car, dt, input) {
  const up = input.down('KeyW') || input.down('ArrowUp');
  const down = input.down('KeyS') || input.down('ArrowDown');
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');
  const top = CAR_MAX_SPEED * car.top * (car.nitro > 0 ? 1.45 : 1);
  if (up) car.speed += CAR_ACCEL * dt;
  if (down) car.speed -= (car.speed > 20 ? CAR_ACCEL * 1.4 : CAR_ACCEL * 0.7) * dt;
  if (!up && !down) car.speed -= Math.sign(car.speed) * 260 * dt;
  if (Math.abs(car.speed) < 8 && !up && !down) car.speed = 0;
  car.speed = clamp(car.speed, -CAR_REVERSE, top);
  if (input.pressed('ShiftLeft') && car.nitro > 0) { /* nitro burns while held */ }
  if ((input.down('ShiftLeft') || input.down('ShiftRight')) && car.nitro > 0 && car.speed > 50) {
    car.nitro = Math.max(0, car.nitro - dt);
    S.audio.engine(true, Math.min(1, Math.abs(car.speed) / top));
  }
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const grip = CAR_GRIP * clamp(Math.abs(car.speed) / 240, 0.25, 1);
  car.angle += steer * grip * dt * Math.sign(car.speed || 1) * (car.speed < 0 ? -1 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  moveCarWithCollision(S, car, nx, ny);
  if (car.hp <= 0) { car.speed = 0; }
}

function moveCarWithCollision(S, car, nx, ny) {
  const r = Math.max(car.w, car.h) / 2 - 4;
  const oldX = car.x, oldY = car.y;
  car.x = clamp(nx, 40, WORLD_W - 40);
  car.y = clamp(ny, 40, WORLD_H - 40);
  let hit = false;
  for (const b of S.world.buildings) {
    const p = { x: car.x, y: car.y };
    if (circleRectResolve(p, r, b)) { car.x = p.x; car.y = p.y; hit = true; }
  }
  for (const l of S.worldLandmarks) {
    if (l.kind === 'stadium' || l.kind === 'casino' || l.kind === 'hall' || l.kind === 'mall') {
      const p = { x: car.x, y: car.y };
      if (circleRectResolve(p, r, l)) { car.x = p.x; car.y = p.y; hit = true; }
    }
  }
  if (hit && Math.abs(car.speed) > 180) {
    S.audio.crash();
    car.hp -= Math.abs(car.speed) * 0.04;
    car.speed *= 0.35;
    spawnSparks(S, car.x, car.y, 8);
    if (car.driver === 'player') S.player.hp = Math.max(1, S.player.hp - 4);
  } else if (hit) {
    car.speed *= 0.6;
  }
  if (S.world && inWaterCheck(S, car.x, car.y)) { car.x = oldX; car.y = oldY; car.speed *= 0.4; }
}

function inWaterCheck(S, x, y) {
  return S.world.water.some((w) => x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h);
}

export function spawnSparks(S, x, y, n) {
  for (let i = 0; i < n; i++) {
    S.particles.push({ x, y, vx: rand(S.rng, -160, 160), vy: rand(S.rng, -160, 160), life: rand(S.rng, 0.2, 0.5), max: 0.5, size: 3, color: '#ffd166' });
  }
}

// Traffic AI: pick a neighbouring intersection, drive to it along the
// road, then pick again. Cars slow for the car ahead and never leave roads.
export function updateTraffic(S, dt) {
  const cam = S.camera;
  for (const c of S.cars) {
    if (c.driver !== 'traffic') continue;
    if (!c.target || dist(c.x, c.y, c.target.x, c.target.y) < 26) {
      c.target = pickNextIntersection(S, c);
      c.stuck = 0;
    }
    const want = Math.atan2(c.target.y - c.y, c.target.x - c.x);
    c.angle = angLerp(c.angle, want, dt * 3.2);
    let wantSpeed = 150 + Math.sin(c.x * 0.01 + c.y * 0.013) * 30;
    // Brake for a car ahead.
    for (const o of S.cars) {
      if (o === c || o.dead) continue;
      const dx = o.x - c.x, dy = o.y - c.y;
      const ahead = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
      const side = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
      if (ahead > 0 && ahead < 90 && side < 26) { wantSpeed = 0; break; }
    }
    // Brake for the player crossing in front.
    const p = S.player;
    if (!p.car) {
      const dx = p.x - c.x, dy = p.y - c.y;
      const ahead = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
      const side = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
      if (ahead > 0 && ahead < 80 && side < 24) wantSpeed = 0;
    }
    c.speed = clamp(c.speed + (wantSpeed - c.speed) * dt * 1.6, 0, 260);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (c.speed < 2) { c.stuck += dt; if (c.stuck > 6) c.target = pickNextIntersection(S, c); }
  }
  // Keep traffic near the camera: recycle far cars onto a road near it.
  for (const c of S.cars) {
    if (c.driver !== 'traffic') continue;
    if (dist(c.x, c.y, cam.x, cam.y) > 1500) {
      const p = randomRoadPointNear(S, cam.x, cam.y, 900);
      c.x = p.x; c.y = p.y; c.angle = Math.random() * Math.PI * 2; c.target = null;
    }
  }
}

function pickNextIntersection(S, c) {
  const cur = nearestIntersection(S.world, c.x, c.y);
  const opts = S.world.intersections.filter((p) => {
    const sameRow = p.y === cur.y && Math.abs(p.x - cur.x) === 400;
    const sameCol = p.x === cur.x && Math.abs(p.y - cur.y) === 400;
    return sameRow || sameCol;
  });
  if (!opts.length) return cur;
  return pick(S.rng, opts);
}

export function randomRoadPointNear(S, x, y, range) {
  for (let tries = 0; tries < 20; tries++) {
    const vx = pick(S.rng, V_ROADS), hy = pick(S.rng, H_ROADS);
    const p = Math.random() < 0.5
      ? { x: clamp(vx + rand(S.rng, -320, 320), 60, WORLD_W - 60), y: hy }
      : { x: vx, y: clamp(hy + rand(S.rng, -320, 320), 60, WORLD_H - 60) };
    if (dist(p.x, p.y, x, y) < range && isOnRoad(S.world, p.x, p.y)) return p;
  }
  return { x: 1500, y: 1500 };
}

export function spawnTraffic(S, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPointNear(S, S.camera.x, S.camera.y, 1100);
    const model = pick(S.rng, ['sedan', 'coupe', 'truck', 'hatch']);
    const c = makeCar(p.x, p.y, pick(S.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]), model, 'traffic');
    c.color = pick(S.rng, TRAFFIC_COLORS);
    S.cars.push(c);
  }
}

// E near a car: get in. A driven car means a witness and a star.
export function tryEnterCar(S) {
  const p = S.player;
  if (p.car) return false;
  let best = null, bd = 95 * 95;
  for (const c of S.cars) {
    if (c.dead || c.driver === 'player') continue;
    const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return false;
  if (best.driver === 'traffic') {
    best.driver = 'player';
    S.stats.carsStolen++;
    S.audio.crash();
    addWanted(S, 25, 'car stolen in front of its driver');
    S.toast('Car stolen — the driver ran for it');
  } else {
    best.driver = 'player';
    S.toast('Got in the car');
  }
  p.car = best;
  p.x = best.x; p.y = best.y;
  best.speed = 0;
  return true;
}

export function exitCar(S) {
  const p = S.player, c = p.car;
  if (!c) return;
  c.driver = 'parked';
  c.speed = 0;
  p.car = null;
  p.x = c.x + Math.cos(c.angle + Math.PI / 2) * 40;
  p.y = c.y + Math.sin(c.angle + Math.PI / 2) * 40;
  p.angle = c.angle;
}

export function addWanted(S, heat, why) {
  S.wanted.heat = clamp(S.wanted.heat + heat, 0, 100);
  const stars = Math.floor(S.wanted.heat / 20);
  if (stars > S.wanted.stars) {
    S.wanted.stars = stars;
    S.toast('Wanted level ' + stars + ' — ' + why, '#ff5a4e');
  } else {
    S.wanted.stars = stars;
  }
}
