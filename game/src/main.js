// Halcyon Bay — Crown Heist. Entry point: builds the state, runs the
// loop, and wires every system together. Nothing here knows how a mission
// or a shop works; it just calls the systems in order.
import { WORLD_W, WORLD_H, START_CASH, PLAYER_WALK, PLAYER_RUN, PLAYER_HP, SHOPS } from './config.js';
import { clamp, dist, mulberry32, circleRectResolve, lerp } from './util.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildWorld, LANDMARKS, isOnRoad } from './world.js';
import { makeCar, drivePlayer, updateTraffic, spawnTraffic, tryEnterCar, exitCar } from './vehicles.js';
import { spawnPeds, updatePeds } from './peds.js';
import { updateWanted, updateCops } from './police.js';
import { updateCombat } from './combat.js';
import { updateTokens, nearestShop, shopItems, buyItem, tryTaxi, updateTaxi } from './economy.js';
import { startJob, updateMission, abortMission, JOBS } from './missions.js';
import { draw } from './render.js';
import { saveGame, loadGame } from './save.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  S.view.w = canvas.width;
  S.view.h = canvas.height;
}

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '20261122', 10);

const S = {
  mode: 'menu',
  time: 0,
  seed,
  rng: mulberry32(seed),
  world: buildWorld(seed),
  worldLandmarks: LANDMARKS,
  shops: SHOPS,
  view: { w: window.innerWidth, h: window.innerHeight },
  camera: { x: 1700, y: 1350, zoom: 1 },
  input: null,
  audio: createAudio(),
  player: {
    x: 1500, y: 1500, angle: 0, hp: PLAYER_HP, armor: 0,
    car: null, weapon: 'pistol', owned: new Set(['pistol']),
    ammo: { smg: 0, shotgun: 0 }, lastShot: 0, lastHurt: -99, muzzle: 0, moving: false,
  },
  cars: [], peds: [], cops: [], bullets: [], enemies: [], particles: [], floats: [],
  cash: START_CASH,
  wanted: { heat: 0, stars: 0 },
  mission: null,
  jobsDone: new Set(),
  jobSel: 0,
  shop: { id: null, sel: 0 },
  taxi: { active: false, fareNo: 0 },
  copTimer: 0, bustTimer: 0, bustedFine: 0, gunfireTimer: 0,
  stats: { kills: 0, carsStolen: 0, fares: 0, fareCash: 0, tokens: 0, bestGp: 0 },
  toasts: [],
  saveTimer: 0,
  ctx,
  toast(text, color) { this.toasts.push({ text, color: color || '#ffe9b8', life: 3.6 }); if (this.toasts.length > 4) this.toasts.shift(); },
  saveGame() { saveGame(this); },
};
S.input = createInput(canvas);
S.input.attach();
window.addEventListener('resize', resize);

// Parked cars from the world, plus the gold Comet coupe for job j9.
for (const pc of S.world.parked) {
  const c = makeCar(pc.x, pc.y, pc.angle, pc.model, 'parked');
  c.color = pc.color;
  S.cars.push(c);
}
const comet = makeCar(3050, 420, Math.PI / 2, 'coupe', 'parked');
comet.color = '#ffd166';
comet.comet = true;
S.cars.push(comet);

loadGame(S);
spawnTraffic(S, 14);
spawnPeds(S, 26);
applyShot(S, params);
resize();

// Debug / probe handle: Playwright drives the game through this.
window.__hb = {
  S,
  state() {
    const p = S.player;
    return {
      mode: S.mode, cash: S.cash, hp: p.hp, x: Math.round(p.x), y: Math.round(p.y),
      inCar: !!p.car, wanted: S.wanted.stars, mission: S.mission ? S.mission.job.id : null,
      stage: S.mission ? S.mission.stageIdx : null, jobsDone: [...S.jobsDone],
      tokens: S.stats.tokens, fares: S.stats.fares, owned: [...p.owned],
      weapon: p.weapon, ammo: p.ammo, shopOpen: S.mode === 'shop' ? S.shop.id : null,
      taxi: S.taxi.active ? S.taxi.phase : null, cops: S.cops.length,
      enemies: S.enemies.length, cars: S.cars.length, peds: S.peds.length,
    };
  },
  startJob(id) { return startJob(S, id); },
  teleport(x, y) { S.player.x = x; S.player.y = y; if (S.player.car) { S.player.car.x = x; S.player.car.y = y; } S.camera.x = x; S.camera.y = y; },
  setCash(n) { S.cash = n; },
  give(item) { S.player.owned.add(item); if (item === 'smg') S.player.ammo.smg = 240; if (item === 'shotgun') S.player.ammo.shotgun = 60; },
  setWanted(stars) { S.wanted.heat = stars * 20; S.wanted.stars = stars; },
  errors: [],
};
window.addEventListener('error', (e) => window.__hb.errors.push(String(e.message)));

function updatePlayerOnFoot(S, dt) {
  const p = S.player, input = S.input;
  const mv = input.moveVector();
  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = run ? PLAYER_RUN : PLAYER_WALK;
  p.moving = mv.x !== 0 || mv.y !== 0;
  if (p.moving) p.angle = Math.atan2(mv.y, mv.x);
  p.x = clamp(p.x + mv.x * speed * dt, 24, WORLD_W - 24);
  p.y = clamp(p.y + mv.y * speed * dt, 24, WORLD_H - 24);
  const r = 14;
  for (const b of S.world.buildings) {
    const pt = { x: p.x, y: p.y };
    if (circleRectResolve(pt, r, b)) { p.x = pt.x; p.y = pt.y; }
  }
  for (const w of S.world.water) {
    if (p.x > w.x - 4 && p.x < w.x + w.w + 4 && p.y > w.y - 4 && p.y < w.y + w.h + 4) {
      p.y = w.y - 6;
    }
  }
}

function interact(S) {
  const p = S.player;
  if (p.car) { exitCar(S); return; }
  const shop = nearestShop(S);
  if (shop) {
    S.mode = 'shop';
    S.shop = { id: shop.id, sel: 0 };
    S.audio.click();
    return;
  }
  if (tryEnterCar(S)) return;
}

function updatePlaying(S, dt) {
  const p = S.player, input = S.input;
  // Mouse aim in world coordinates.
  input.mouseWorldX = S.camera.x + (input.mouseX - S.view.w / 2) / S.camera.zoom;
  input.mouseWorldY = S.camera.y + (input.mouseY - S.view.h / 2) / S.camera.zoom;
  if (input.pressed('KeyE')) interact(S);
  if (input.pressed('KeyT')) tryTaxi(S);
  if (input.pressed('KeyM')) { S.mode = 'jobs'; S.audio.click(); }
  if (input.pressed('KeyP')) { saveGame(S); S.toast('Game saved'); }
  if (input.pressed('Escape')) { S.mode = 'paused'; S.audio.click(); }
  if (p.car) drivePlayer(S, p.car, dt, input);
  else updatePlayerOnFoot(S, dt);
  updateTraffic(S, dt);
  updatePeds(S, dt);
  updateWanted(S, dt);
  updateCops(S, dt);
  updateCombat(S, dt);
  updateMission(S, dt);
  updateTokens(S);
  updateTaxi(S, dt);
  updateFx(S, dt);
  // Camera follows the player (or their car).
  const tx = p.car ? p.car.x : p.x, ty = p.car ? p.car.y : p.y;
  S.camera.x = lerp(S.camera.x, tx, clamp(dt * 5, 0, 1));
  S.camera.y = lerp(S.camera.y, ty, clamp(dt * 5, 0, 1));
  const speed = p.car ? Math.abs(p.car.speed) : 0;
  S.camera.zoom = lerp(S.camera.zoom, speed > 420 ? 0.82 : 1, clamp(dt * 2, 0, 1));
  S.audio.engine(!!p.car, p.car ? Math.min(1, Math.abs(p.car.speed) / 620) : 0);
  S.saveTimer += dt;
  if (S.saveTimer > 30) { S.saveTimer = 0; saveGame(S); }
}

function updateFx(S, dt) {
  for (const pt of S.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
  }
  S.particles = S.particles.filter((pt) => pt.life > 0);
  for (const f of S.floats) { f.y -= 26 * dt; f.life -= dt; }
  S.floats = S.floats.filter((f) => f.life > 0);
  for (const t of S.toasts) t.life -= dt;
  S.toasts = S.toasts.filter((t) => t.life > 0);
}

function updateMenu(S, dt) {
  // Slow drift over the city behind the title.
  S.camera.x = 1700 + Math.sin(S.time * 0.05) * 500;
  S.camera.y = 1350 + Math.cos(S.time * 0.04) * 350;
  updateTraffic(S, dt);
  updatePeds(S, dt);
  updateFx(S, dt);
  if (S.input.pressed('Enter') || S.input.mousePressed) {
    S.mode = 'playing';
    S.audio.ensure();
    S.audio.sting();
    S.camera.x = S.player.x; S.camera.y = S.player.y;
    if (S.jobsDone.size === 0 && !S.mission) S.toast('Welcome to Halcyon Bay — press M for your first job');
  }
}

function updateShop(S, dt) {
  const shop = S.shops.find((s) => s.id === S.shop.id);
  const items = shopItems(S, shop);
  if (S.input.pressed('ArrowUp') || S.input.pressed('KeyW')) S.shop.sel = (S.shop.sel + items.length - 1) % items.length;
  if (S.input.pressed('ArrowDown') || S.input.pressed('KeyS')) S.shop.sel = (S.shop.sel + 1) % items.length;
  if (S.input.pressed('Enter')) {
    const it = items[S.shop.sel];
    if (it && it.can) buyItem(S, shop, it);
    else S.audio.fail();
  }
  if (S.input.pressed('Escape') || S.input.pressed('KeyE')) { S.mode = 'playing'; S.audio.click(); }
  updateFx(S, dt);
}

function updateJobs(S, dt) {
  if (S.input.pressed('ArrowUp') || S.input.pressed('KeyW')) S.jobSel = (S.jobSel + JOBS.length - 1) % JOBS.length;
  if (S.input.pressed('ArrowDown') || S.input.pressed('KeyS')) S.jobSel = (S.jobSel + 1) % JOBS.length;
  if (S.input.pressed('Enter')) {
    if (startJob(S, JOBS[S.jobSel].id)) S.mode = 'playing';
  }
  if (S.input.pressed('Escape') || S.input.pressed('KeyM')) { S.mode = 'playing'; S.audio.click(); }
  updateFx(S, dt);
}

function updatePaused(S, dt) {
  if (S.input.pressed('Enter') || S.input.pressed('Escape')) { S.mode = 'playing'; S.audio.click(); }
  if (S.input.pressed('KeyM')) { S.mode = 'jobs'; }
  if (S.input.pressed('KeyP')) { saveGame(S); S.toast('Game saved'); S.mode = 'playing'; }
  if (S.input.pressed('KeyQ')) { S.mode = 'menu'; }
  updateFx(S, dt);
}

function updateEndCard(S, dt) {
  if (S.input.pressed('Enter')) {
    if (S.mode === 'gameover') {
      S.player.hp = PLAYER_HP; S.player.armor = 0;
      S.player.x = 700; S.player.y = 760; S.player.car = null;
      S.camera.x = 700; S.camera.y = 760;
      S.wanted.heat = 0; S.wanted.stars = 0;
      S.enemies = [];
      S.mode = 'playing';
    } else {
      S.mode = 'playing';
    }
  }
  updateFx(S, dt);
}

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0.001, 0.05);
  last = now;
  S.time += dt;
  if (S.mode === 'menu') updateMenu(S, dt);
  else if (S.mode === 'playing') updatePlaying(S, dt);
  else if (S.mode === 'shop') updateShop(S, dt);
  else if (S.mode === 'jobs') updateJobs(S, dt);
  else if (S.mode === 'paused') updatePaused(S, dt);
  else updateEndCard(S, dt); // busted, gameover, victory
  S.audio.update(dt, S);
  draw(S);
  S.input.endFrame();
  requestAnimationFrame(frame);
}
document.getElementById('status').textContent = 'Halcyon Bay — Crown Heist. Press Enter to play.';
requestAnimationFrame(frame);
