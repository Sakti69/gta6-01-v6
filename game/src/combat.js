// Combat: the player's weapons, bullets, and the rival gunmen some
// missions spawn. Aim with the mouse, fire with click (or J), switch
// weapons with 1/2/3. Ammo is per weapon; the pistol never runs dry.
import { WEAPONS } from './config.js';
import { dist, rand, clamp } from './util.js';
import { addWanted } from './vehicles.js';
import { witnessCheck } from './peds.js';

export function spawnEnemy(S, x, y, hp) {
  const e = { x, y, angle: 0, hp: hp || 60, speed: 120, fireTimer: rand(S.rng, 0.5, 1.5), dead: false, flash: 0 };
  S.enemies.push(e);
  return e;
}

export function playerShoot(S) {
  const p = S.player;
  if (p.car) return; // no drive-bys in this build: get out to fight
  const w = WEAPONS[p.weapon];
  if (!w) return;
  if (S.time - p.lastShot < w.rate) return;
  if (p.weapon !== 'pistol') {
    if ((p.ammo[p.weapon] || 0) <= 0) { S.toast('Out of ammo — buy more at Iron & Oak', '#ff5a4e'); p.lastShot = S.time; return; }
    p.ammo[p.weapon]--;
  }
  p.lastShot = S.time;
  const aim = Math.atan2(S.input.mouseWorldY - p.y, S.input.mouseWorldX - p.x);
  for (let i = 0; i < w.pellets; i++) {
    const a = aim + rand(S.rng, -w.spread, w.spread);
    S.bullets.push({ x: p.x + Math.cos(aim) * 20, y: p.y + Math.sin(aim) * 20, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: 0.9, dmg: w.damage, from: 'player' });
  }
  p.muzzle = 0.06;
  S.gunfireTimer = 1.2;
  S.audio.shot(p.weapon);
  witnessCheck(S, p.x, p.y, 12);
}

export function updateCombat(S, dt) {
  const p = S.player;
  if (p.muzzle > 0) p.muzzle -= dt;
  if (S.gunfireTimer > 0) S.gunfireTimer -= dt;
  // Player firing: mouse hold for autos, click for the rest.
  const w = WEAPONS[p.weapon];
  const wantFire = S.input.mouseDown || S.input.down('KeyJ');
  if (S.mode === 'playing' && !p.car && wantFire && (w.auto || S.input.mousePressed || S.input.pressed('KeyJ'))) playerShoot(S);
  // Weapon switching.
  if (S.input.pressed('Digit1')) p.weapon = 'pistol';
  if (S.input.pressed('Digit2') && p.owned.has('smg')) p.weapon = 'smg';
  if (S.input.pressed('Digit3') && p.owned.has('shotgun')) p.weapon = 'shotgun';
  // Bullets fly, hit buildings, cars, enemies, cops, peds, and the player.
  for (const b of S.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) continue;
    let dead = false;
    for (const bd of S.world.buildings) {
      if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { dead = true; break; }
    }
    if (dead) { b.life = 0; continue; }
    if (b.from === 'player') {
      for (const e of S.enemies) {
        if (!e.dead && dist(b.x, b.y, e.x, e.y) < 16) { e.hp -= b.dmg; e.flash = 0.1; b.life = 0; if (e.hp <= 0) killEnemy(S, e); break; }
      }
      if (b.life <= 0) continue;
      for (const c of S.cops) {
        if (!c.dead && dist(b.x, b.y, c.x, c.y) < 26) { c.hp -= b.dmg; b.life = 0; addWanted(S, 8, 'shot at the police'); if (c.hp <= 0) { c.dead = true; S.stats.kills++; } break; }
      }
      if (b.life <= 0) continue;
      for (const car of S.cars) {
        if (car.driver !== 'player' && !car.dead && dist(b.x, b.y, car.x, car.y) < 26) { car.hp -= b.dmg; b.life = 0; if (car.hp <= 0) car.dead = true; break; }
      }
      if (b.life <= 0) continue;
      for (const ped of S.peds) {
        if (!ped.dead && dist(b.x, b.y, ped.x, ped.y) < 12) { ped.dead = true; b.life = 0; addWanted(S, 15, 'a pedestrian went down'); break; }
      }
    } else {
      // Enemy bullet at the player.
      const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
      if (dist(b.x, b.y, px, py) < (p.car ? 26 : 14)) {
        b.life = 0;
        hurtPlayer(S, b.dmg);
      }
    }
  }
  S.bullets = S.bullets.filter((b) => b.life > 0);
  // Enemies: close in, shoot when in range.
  for (const e of S.enemies) {
    if (e.dead) continue;
    if (e.flash > 0) e.flash -= dt;
    const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
    const d = dist(e.x, e.y, px, py);
    e.angle = Math.atan2(py - e.y, px - e.x);
    if (d > 260) { e.x += Math.cos(e.angle) * e.speed * dt; e.y += Math.sin(e.angle) * e.speed * dt; }
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && d < 420) {
      e.fireTimer = rand(S.rng, 0.7, 1.4);
      const a = e.angle + rand(S.rng, -0.12, 0.12);
      S.bullets.push({ x: e.x + Math.cos(a) * 18, y: e.y + Math.sin(a) * 18, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 1.1, dmg: 9, from: 'enemy' });
      S.audio.shot('pistol');
    }
  }
  S.enemies = S.enemies.filter((e) => !e.dead);
  // Player regen: slow, only out of combat.
  if (S.gunfireTimer <= 0 && p.hp < 100 && S.time - p.lastHurt > 6) p.hp = Math.min(100, p.hp + 4 * dt);
}

function killEnemy(S, e) {
  e.dead = true;
  S.stats.kills++;
  const drop = 40 + Math.floor(S.rng() * 80);
  S.cash += drop;
  S.floats.push({ x: e.x, y: e.y, text: '+$' + drop, color: '#7ee081', life: 1.2 });
  S.audio.cash();
  for (let i = 0; i < 10; i++) S.particles.push({ x: e.x, y: e.y, vx: rand(S.rng, -120, 120), vy: rand(S.rng, -120, 120), life: 0.4, max: 0.4, size: 3, color: '#ff5a4e' });
}

export function hurtPlayer(S, dmg) {
  const p = S.player;
  p.lastHurt = S.time;
  let left = dmg;
  if (p.armor > 0) { const absorbed = Math.min(p.armor, left * 0.6); p.armor -= absorbed; left -= absorbed; }
  p.hp -= left;
  S.audio.tone?.(140, 0.12, 'sawtooth', 0.15, 80);
  if (p.hp <= 0) {
    p.hp = 0;
    S.mode = 'gameover';
    S.audio.fail();
    for (const c of S.cops) c.dead = true;
    S.cops = [];
    S.audio.siren(false);
  }
}
