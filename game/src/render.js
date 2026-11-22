// All drawing: the city, the cars, the people, the HUD, the minimap,
// and every menu. One canvas, no DOM UI except the screen-reader line.
import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, ROAD_W, PALETTE, WEAPONS, TAXI_STANDS } from './config.js';
import { clamp, dist, fmtCash, fmtTime, lerp } from './util.js';
import { LANDMARKS, districtAt } from './world.js';
import { shopItems } from './economy.js';
import { currentObjective, missionMarker, JOBS, ACT_NAMES, isUnlocked } from './missions.js';

const MINIMAP = 196;

export function draw(S) {
  const ctx = S.ctx, W = S.view.w, H = S.view.h;
  const cam = S.camera;
  const scale = cam.zoom;
  ctx.clearRect(0, 0, W, H);
  // Sunset sky wash behind the city edges.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#ff9e57'); sky.addColorStop(0.5, '#e86a7a'); sky.addColorStop(1, '#7a4a8a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-cam.x, -cam.y);
  drawGround(S, ctx);
  drawRoads(S, ctx);
  drawWater(S, ctx);
  drawLandmarks(S, ctx);
  drawBuildings(S, ctx);
  drawTokens(S, ctx);
  drawShops(S, ctx);
  drawCars(S, ctx);
  drawPeds(S, ctx);
  drawEnemies(S, ctx);
  drawBullets(S, ctx);
  drawPlayer(S, ctx);
  drawParticles(S, ctx);
  drawMissionMarker(S, ctx);
  ctx.restore();
  drawSunsetVignette(S, ctx);
  if (S.mode === 'menu') drawMenu(S, ctx);
  else {
    drawHUD(S, ctx);
    drawMinimap(S, ctx);
    if (S.mode === 'paused') drawPause(S, ctx);
    if (S.mode === 'shop') drawShop(S, ctx);
    if (S.mode === 'jobs') drawJobs(S, ctx);
    if (S.mode === 'busted') drawBusted(S, ctx);
    if (S.mode === 'gameover') drawGameOver(S, ctx);
    if (S.mode === 'victory') drawVictory(S, ctx);
  }
  drawToasts(S, ctx);
}

function viewRect(S) {
  const cam = S.camera, W = S.view.w / cam.zoom, H = S.view.h / cam.zoom;
  return { x: cam.x - W / 2 - 60, y: cam.y - H / 2 - 60, w: W + 120, h: H + 120 };
}
function inView(S, x, y, m) {
  const v = viewRect(S);
  return x > v.x - (m || 0) && x < v.x + v.w + (m || 0) && y > v.y - (m || 0) && y < v.y + v.h + (m || 0);
}

function drawGround(S, ctx) {
  const v = viewRect(S);
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(v.x, v.y, v.w, v.h);
  // Dry patches and sidewalk slabs per block.
  ctx.fillStyle = PALETTE.grassDry;
  for (let i = 0; i < 40; i++) {
    const x = ((i * 733) % WORLD_W), y = ((i * 571) % WORLD_H);
    if (inView(S, x, y)) ctx.fillRect(x, y, 180, 120);
  }
}

function drawRoads(S, ctx) {
  const v = viewRect(S);
  ctx.fillStyle = PALETTE.asphalt;
  for (const x of V_ROADS) if (x > v.x - 80 && x < v.x + v.w + 80) ctx.fillRect(x - ROAD_W / 2, v.y, ROAD_W, v.h);
  for (const y of H_ROADS) if (y > v.y - 80 && y < v.y + v.h + 80) ctx.fillRect(v.x, y - ROAD_W / 2, v.w, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = PALETTE.lane;
  for (const x of V_ROADS) {
    if (x < v.x - 80 || x > v.x + v.w + 80) continue;
    for (let y = Math.floor(v.y / 48) * 48; y < v.y + v.h; y += 48) ctx.fillRect(x - 2, y + 8, 4, 22);
  }
  for (const y of H_ROADS) {
    if (y < v.y - 80 || y > v.y + v.h + 80) continue;
    for (let x = Math.floor(v.x / 48) * 48; x < v.x + v.w; x += 48) ctx.fillRect(x + 8, y - 2, 22, 4);
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const x of V_ROADS) for (const y of H_ROADS) {
    if (!inView(S, x, y, 80)) continue;
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(x + i * 11 - 3, y - ROAD_W / 2 + 4, 6, 12);
      ctx.fillRect(x + i * 11 - 3, y + ROAD_W / 2 - 16, 6, 12);
      ctx.fillRect(x - ROAD_W / 2 + 4, y + i * 11 - 3, 12, 6);
      ctx.fillRect(x + ROAD_W / 2 - 16, y + i * 11 - 3, 12, 6);
    }
  }
}

function drawWater(S, ctx) {
  for (const w of S.world.water) {
    if (!inView(S, w.x + w.w / 2, w.y + w.h / 2, w.w)) continue;
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let i = 0; i < w.w / 90; i++) {
      const x = w.x + ((i * 90 + S.time * 12) % w.w);
      ctx.fillRect(x, w.y + 18 + (i % 3) * 26, 46, 3);
    }
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(w.x, w.y - 6, w.w, 6);
  }
}

function drawLandmarks(S, ctx) {
  for (const l of LANDMARKS) {
    if (!inView(S, l.x + l.w / 2, l.y + l.h / 2, l.w)) continue;
    const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
    if (l.kind === 'stadium') {
      ctx.fillStyle = '#8a8f9e'; ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.fillStyle = '#d8d2c2';
      ctx.beginPath(); ctx.ellipse(cx, cy, l.w / 2 - 12, l.h / 2 - 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5d8a4a';
      ctx.beginPath(); ctx.ellipse(cx, cy, l.w / 2 - 44, l.h / 2 - 44, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, cy, l.w / 2 - 44, l.h / 2 - 44, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - l.w / 2 + 44, cy); ctx.lineTo(cx + l.w / 2 - 44, cy); ctx.stroke();
    } else if (l.kind === 'airfield') {
      ctx.fillStyle = '#6a7a5a'; ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(l.x + 20, cy - 26, l.w - 40, 52);
      ctx.fillStyle = '#e8e8e8';
      for (let i = 0; i < 6; i++) ctx.fillRect(l.x + 40 + i * 36, cy - 2, 20, 4);
      // A little parked jet.
      ctx.fillStyle = '#d8d2c2';
      ctx.beginPath(); ctx.ellipse(l.x + 60, l.y + 50, 34, 10, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4d7a9e'; ctx.fillRect(l.x + 200, l.y + 30, 56, 44);
    } else if (l.kind === 'ferry' || l.kind === 'pier') {
      ctx.fillStyle = '#a8845c'; ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.fillStyle = '#8a6a44';
      ctx.fillRect(cx - 14, l.y + l.h - 20, 28, 120);
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath(); ctx.moveTo(cx - 26, l.y + l.h + 96); ctx.lineTo(cx, l.y + l.h + 58); ctx.lineTo(cx + 26, l.y + l.h + 96); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4d7a9e'; ctx.fillRect(cx - 10, l.y + l.h + 96, 20, 10);
      ctx.fillStyle = '#5d8a6a';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(l.x + 30 + i * 50, l.y + 30, 14, 0, Math.PI * 2); ctx.fill(); }
    } else if (l.kind === 'casino') {
      ctx.fillStyle = '#2f2438'; ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.fillStyle = '#7a5a2e'; ctx.fillRect(l.x + 24, l.y + 24, l.w - 48, l.h - 48);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('♛', cx, cy - 30);
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('CROWN', cx, cy + 26);
      ctx.fillText('CASINO', cx, cy + 52);
    } else if (l.kind === 'hall') {
      ctx.fillStyle = '#d8d2c2'; ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.fillStyle = '#b8b09e'; ctx.fillRect(l.x + 40, l.y + 40, l.w - 80, l.h - 80);
      ctx.fillStyle = '#4d7a9e';
      for (let i = 0; i < 5; i++) ctx.fillRect(l.x + 50 + i * 44, l.y + 60, 18, l.h - 120);
      ctx.fillStyle = '#c94f43'; ctx.beginPath(); ctx.moveTo(cx, l.y + 20); ctx.lineTo(cx + 60, l.y + 20); ctx.lineTo(cx, l.y + 60); ctx.closePath(); ctx.fill();
    } else if (l.kind === 'park') {
      ctx.fillStyle = '#6a9e58'; ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.fillStyle = '#7ec8e8';
      ctx.beginPath(); ctx.arc(cx, cy, 42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3d6a34';
      for (let i = 0; i < 8; i++) {
        const px = l.x + 30 + (i * 53) % (l.w - 60), py = l.y + 34 + (i * 71) % (l.h - 68);
        ctx.beginPath(); ctx.arc(px, py, 15, 0, Math.PI * 2); ctx.fill();
      }
    } else if (l.kind === 'mall') {
      ctx.fillStyle = '#9e8a6a'; ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.fillStyle = PALETTE.glass;
      ctx.fillRect(l.x + 24, l.y + 24, l.w - 48, l.h - 48);
      ctx.strokeStyle = '#5a4a3b'; ctx.lineWidth = 4;
      for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(l.x + i * (l.w / 5), l.y + 24); ctx.lineTo(l.x + i * (l.w / 5), l.y + l.h - 24); ctx.stroke(); }
    }
    // Label.
    ctx.fillStyle = 'rgba(20,22,28,0.75)';
    const tw = ctx.measureText(l.name).width;
    ctx.font = 'bold 15px sans-serif';
    const w2 = ctx.measureText(l.name).width + 16;
    ctx.fillRect(cx - w2 / 2, l.y + l.h - 30, w2, 22);
    ctx.fillStyle = '#ffe9b8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(l.name, cx, l.y + l.h - 19);
  }
}

function drawBuildings(S, ctx) {
  for (const b of S.world.buildings) {
    if (!inView(S, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    // Fake height: a darker offset slab, then the roof.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 6, b.y + 8 + b.hgt * 3, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillStyle = PALETTE.glass;
    const cols = Math.max(1, Math.floor(b.w / 34)), rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if ((i * 7 + j * 3 + b.hgt) % 4 === 0) continue;
      ctx.fillRect(b.x + 10 + i * 32, b.y + 10 + j * 30, 16, 14);
    }
  }
}

function drawTokens(S, ctx) {
  const pulse = 1 + Math.sin(S.time * 4) * 0.12;
  for (const t of S.world.tokens) {
    if (t.taken || !inView(S, t.x, t.y, 60)) continue;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.fillStyle = 'rgba(255,197,61,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 22 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffc53d';
    ctx.beginPath(); ctx.arc(0, 0, 12 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a4a00';
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('☀', 0, 0);
    ctx.restore();
  }
}

function drawShops(S, ctx) {
  for (const s of S.shops) {
    if (!inView(S, s.x, s.y, 80)) continue;
    ctx.fillStyle = '#14161c';
    ctx.fillRect(s.x - 8, s.y - 34, 16, 34);
    ctx.fillStyle = s.kind === 'guns' ? '#ff9f5a' : s.kind === 'food' ? '#7ee081' : '#7ee0ff';
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s.kind === 'guns' ? '✛' : s.kind === 'food' ? '☕' : '⚙', s.x, s.y - 17);
    ctx.fillStyle = 'rgba(20,22,28,0.8)';
    ctx.font = 'bold 13px sans-serif';
    const w = ctx.measureText(s.name).width + 12;
    ctx.fillRect(s.x - w / 2, s.y + 8, w, 20);
    ctx.fillStyle = '#ffe9b8';
    ctx.fillText(s.name, s.x, s.y + 18);
  }
  for (const t of TAXI_STANDS) {
    if (!inView(S, t.x, t.y, 60)) continue;
    ctx.fillStyle = '#f2c230';
    ctx.beginPath(); ctx.arc(t.x, t.y, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#14161c'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('T', t.x, t.y);
  }
}

function drawCarShape(ctx, c, alpha) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-c.w / 2 + 3, -c.h / 2 + 4, c.w, c.h);
  ctx.fillStyle = c.color;
  roundRect(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(-c.w / 2 + 6, -c.h / 2 + 3, c.w - 12, 4);
  ctx.fillStyle = '#1d2733';
  ctx.fillRect(-2, -c.h / 2 + 5, 12, c.h - 10);
  ctx.fillStyle = '#ffe9b8';
  ctx.fillRect(c.w / 2 - 3, -c.h / 2 + 3, 3, 5);
  ctx.fillRect(c.w / 2 - 3, c.h / 2 - 8, 3, 5);
  if (c.driver === 'police') {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-c.w / 2 + 8, -c.h / 2, 8, c.h);
    ctx.fillStyle = (Math.floor(performance.now() / 280) % 2 === 0) ? '#ff3b30' : '#2f7bff';
    ctx.beginPath(); ctx.arc(0, -c.h / 2 + 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = (Math.floor(performance.now() / 280) % 2 === 0) ? '#2f7bff' : '#ff3b30';
    ctx.beginPath(); ctx.arc(0, c.h / 2 - 2, 5, 0, Math.PI * 2); ctx.fill();
  }
  if (c.model === 'taxi') {
    ctx.fillStyle = '#14161c';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCars(S, ctx) {
  for (const c of S.cars) {
    if (c.dead || !inView(S, c.x, c.y, 80)) continue;
    drawCarShape(ctx, c);
    if (c.hp < 60) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.arc(c.x, c.y - 14, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a8f9e';
      ctx.beginPath(); ctx.arc(c.x, c.y - 18, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawPeds(S, ctx) {
  for (const p of S.peds) {
    if (p.dead || !inView(S, p.x, p.y, 40)) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.pants;
    ctx.fillRect(-4, -5, 8, 10);
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(5, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawEnemies(S, ctx) {
  for (const e of S.enemies) {
    if (e.dead || !inView(S, e.x, e.y, 40)) continue;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#7a2e3a';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d2733';
    ctx.fillRect(6, -2, 14, 4);
    ctx.restore();
    ctx.fillStyle = '#14161c'; ctx.fillRect(e.x - 14, e.y - 20, 28, 5);
    ctx.fillStyle = '#ff5a4e'; ctx.fillRect(e.x - 14, e.y - 20, 28 * clamp(e.hp / 60, 0, 1), 5);
  }
}

function drawBullets(S, ctx) {
  ctx.fillStyle = '#ffe9b8';
  for (const b of S.bullets) {
    ctx.fillRect(b.x - 3, b.y - 1, 6, 2);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe9b8';
  }
}

function drawPlayer(S, ctx) {
  const p = S.player;
  if (p.car) {
    if (p.muzzle > 0) return;
    return; // the car itself is drawn in drawCars
  }
  if (!inView(S, p.x, p.y, 40)) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  const aim = Math.atan2(S.input.mouseWorldY - p.y, S.input.mouseWorldX - p.x);
  ctx.rotate(p.moving ? p.angle : aim);
  ctx.fillStyle = '#2f3542';
  ctx.fillRect(-5, -6, 10, 12);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(6, 0, 4.5, 0, Math.PI * 2); ctx.fill();
  // The gun, pointing at the mouse.
  ctx.rotate(aim - (p.moving ? p.angle : aim));
  ctx.fillStyle = '#1d2733';
  ctx.fillRect(6, -2, 16, 4);
  if (p.muzzle > 0) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(26, 0, 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawParticles(S, ctx) {
  for (const pt of S.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  for (const f of S.floats) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawMissionMarker(S, ctx) {
  const m = missionMarker(S);
  const taxi = S.taxi.active ? (S.taxi.phase === 'pickup' ? S.taxi.stand : S.taxi.dest) : null;
  const target = m || taxi;
  if (!target) return;
  const pulse = 1 + Math.sin(S.time * 5) * 0.15;
  const bob = Math.sin(S.time * 3) * 6;
  ctx.save();
  ctx.translate(target.x, target.y + bob - 26);
  ctx.fillStyle = '#ffc53d';
  ctx.beginPath();
  ctx.moveTo(0, 12 * pulse); ctx.lineTo(10 * pulse, -6); ctx.lineTo(-10 * pulse, -6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,197,61,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 18 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // Off-screen arrow pointing at the marker.
  const v = viewRect(S);
  if (target.x < v.x || target.x > v.x + v.w || target.y < v.y || target.y > v.y + v.h) {
    const cx = clamp(target.x, v.x + 40, v.x + v.w - 40), cy = clamp(target.y, v.y + 40, v.y + v.h - 40);
    const a = Math.atan2(target.y - cy, target.x - cx);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = '#ffc53d';
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawSunsetVignette(S, ctx) {
  const W = S.view.w, H = S.view.h;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(255,150,80,0)');
  g.addColorStop(1, 'rgba(120,40,90,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (S.player.hp < 35 && S.mode === 'playing') {
    ctx.fillStyle = 'rgba(255,40,30,' + (0.10 + Math.sin(S.time * 6) * 0.05) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = 'rgba(20,22,28,' + (alpha === undefined ? 0.82 : alpha) + ')';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,233,184,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawHUD(S, ctx) {
  const W = S.view.w, H = S.view.h, p = S.player;
  panel(ctx, 12, 12, 250, 108);
  ctx.fillStyle = '#ffe9b8'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(fmtCash(S.cash), 24, 32);
  ctx.font = '13px sans-serif'; ctx.fillStyle = '#b8b09e';
  ctx.fillText(districtAt(p.x, p.y) + '  •  ' + fmtTime(S.time), 24, 56);
  // Health + armour bars.
  ctx.fillStyle = '#3a2a2a'; ctx.fillRect(24, 68, 140, 10);
  ctx.fillStyle = p.hp > 35 ? '#7ee081' : '#ff5a4e';
  ctx.fillRect(24, 68, 140 * clamp(p.hp / 100, 0, 1), 10);
  ctx.fillStyle = '#2a2a3a'; ctx.fillRect(24, 82, 140, 8);
  ctx.fillStyle = '#7ee0ff';
  ctx.fillRect(24, 82, 140 * clamp(p.armor / 100, 0, 1), 8);
  ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#e8e8e8';
  ctx.fillText('HP ' + Math.ceil(p.hp), 170, 73);
  ctx.fillText('ARM ' + Math.ceil(p.armor), 170, 86);
  // Wanted stars.
  ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'left';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < S.wanted.stars ? '★' : '☆';
  ctx.fillStyle = S.wanted.stars > 0 ? '#ff5a4e' : 'rgba(232,232,232,0.5)';
  ctx.fillText(stars, 24, 108 + 4);
  // Weapon + speed, bottom left.
  panel(ctx, 12, H - 64, 250, 52);
  const w = WEAPONS[p.weapon];
  ctx.fillStyle = '#ffe9b8'; ctx.font = 'bold 16px sans-serif';
  ctx.fillText(w.name + (p.weapon === 'pistol' ? '' : '  •  ' + (p.ammo[p.weapon] || 0) + ' rds'), 24, H - 44);
  ctx.fillStyle = '#b8b09e'; ctx.font = '13px sans-serif';
  const speed = p.car ? Math.round(Math.abs(p.car.speed) * 0.12) : 0;
  ctx.fillText(p.car ? speed + ' mph' + (p.car.nitro > 0 ? '  •  NITRO ready (Shift)' : '') : 'On foot  •  1/2/3 weapons', 24, H - 22);
  // Mission objective, top centre.
  const obj = currentObjective(S);
  if (obj) {
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(obj.text).width;
    const bw = Math.min(W - 40, tw + 200);
    panel(ctx, (W - bw) / 2, 12, bw, 46);
    ctx.fillStyle = '#ffc53d'; ctx.textAlign = 'left';
    ctx.fillText(obj.job.title, (W - bw) / 2 + 14, 29);
    ctx.fillStyle = '#e8e8e8'; ctx.font = '13px sans-serif';
    ctx.fillText(obj.text, (W - bw) / 2 + 14, 29 + 20 > 58 ? 44 : 44);
  } else if (S.mode === 'playing') {
    ctx.font = '13px sans-serif';
    const hint = 'Press M for jobs  •  E to enter cars & shops  •  T for taxi at a stand';
    const tw = ctx.measureText(hint).width;
    panel(ctx, (W - tw - 28) / 2, 12, tw + 28, 30, 0.6);
    ctx.fillStyle = '#d8d2c2'; ctx.textAlign = 'center';
    ctx.fillText(hint, W / 2, 28);
  }
  // Taxi timer.
  if (S.taxi.active) {
    panel(ctx, W - 262, 12, 250, 46);
    ctx.fillStyle = '#f2c230'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('TAXI — ' + (S.taxi.phase === 'pickup' ? 'pick up the passenger' : 'drop them off'), W - 250, 29);
    ctx.fillStyle = '#e8e8e8'; ctx.font = '13px sans-serif';
    ctx.fillText(fmtCash(S.taxi.payout) + '  •  ' + fmtTime(S.taxi.timer), W - 250, 44);
  }
}

function drawMinimap(S, ctx) {
  const W = S.view.w;
  const size = MINIMAP, x0 = W - size - 12, y0 = 12 + 118;
  const sx = size / WORLD_W, sy = size / WORLD_H;
  panel(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 0.85);
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, size, size); ctx.clip();
  ctx.fillStyle = '#5d7a4a'; ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#2e6f8e'; ctx.fillRect(x0, y0 + size - 14, size, 14);
  ctx.strokeStyle = '#3d414c'; ctx.lineWidth = 3;
  for (const x of V_ROADS) { ctx.beginPath(); ctx.moveTo(x0 + x * sx, y0); ctx.lineTo(x0 + x * sx, y0 + size); ctx.stroke(); }
  for (const y of H_ROADS) { ctx.beginPath(); ctx.moveTo(x0, y0 + y * sy); ctx.lineTo(x0 + size, y0 + y * sy); ctx.stroke(); }
  ctx.fillStyle = '#c98f4e';
  for (const l of LANDMARKS) ctx.fillRect(x0 + l.x * sx - 2, y0 + l.y * sy - 2, 5, 5);
  const m = missionMarker(S);
  if (m) {
    ctx.fillStyle = '#ffc53d';
    ctx.beginPath(); ctx.arc(x0 + m.x * sx, y0 + m.y * sy, 5 + Math.sin(S.time * 5) * 1.5, 0, Math.PI * 2); ctx.fill();
  }
  for (const c of S.cops) {
    if (c.dead) continue;
    ctx.fillStyle = '#2f7bff';
    ctx.beginPath(); ctx.arc(x0 + c.x * sx, y0 + c.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  const p = S.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x0 + px * sx, y0 + py * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#14161c'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ffe9b8'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('HALCYON BAY', x0, y0 + size + 16);
}

function drawMenu(S, ctx) {
  const W = S.view.w, H = S.view.h;
  ctx.fillStyle = 'rgba(20,16,32,0.45)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffc53d';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('HALCYON BAY', W / 2, H / 2 - 130);
  ctx.fillStyle = '#ffe9b8';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('— CROWN HEIST —', W / 2, H / 2 - 78);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '17px sans-serif';
  ctx.fillText('An open-world crime story in four acts. 18 jobs. One crown. $8,000 on the line.', W / 2, H / 2 - 38);
  ctx.fillText('Steal cars, lose the cops, run fares, buy guns, and take the Crown Casino.', W / 2, H / 2 - 12);
  panel(ctx, W / 2 - 330, H / 2 + 22, 660, 96, 0.9);
  ctx.fillStyle = '#ffe9b8'; ctx.font = '15px sans-serif';
  ctx.fillText('WASD / arrows — move & drive      E — enter car / shop      Mouse — aim, click — fire', W / 2, H / 2 + 46);
  ctx.fillText('1 / 2 / 3 — weapons      T — taxi fare at a stand      M — jobs      Shift — nitro      Esc — pause', W / 2, H / 2 + 72);
  ctx.fillText('P — save      H — help', W / 2, H / 2 + 96);
  const blink = Math.sin(S.time * 4) > 0;
  if (blink) {
    ctx.fillStyle = '#ffc53d'; ctx.font = 'bold 24px sans-serif';
    ctx.fillText('PRESS ENTER TO PLAY', W / 2, H / 2 + 160);
  }
  ctx.fillStyle = '#b8b09e'; ctx.font = '13px sans-serif';
  const done = S.jobsDone.size;
  ctx.fillText(done > 0 ? done + ' / 18 jobs done  •  ' + fmtCash(S.cash) + ' in the pocket' : 'A fresh start in the bay. Good luck.', W / 2, H / 2 + 196);
  ctx.fillText('v6 — Halcyon Bay: Crown Heist  •  an original game, no Rockstar assets', W / 2, H - 24);
}

function drawPause(S, ctx) {
  const W = S.view.w, H = S.view.h;
  ctx.fillStyle = 'rgba(20,22,28,0.6)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, W / 2 - 260, H / 2 - 150, 520, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffc53d'; ctx.font = 'bold 30px sans-serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 112);
  ctx.fillStyle = '#e8e8e8'; ctx.font = '16px sans-serif';
  ctx.fillText('Jobs done: ' + S.jobsDone.size + ' / 18', W / 2, H / 2 - 66);
  ctx.fillText('Cash: ' + fmtCash(S.cash) + '   •   Cars stolen: ' + S.stats.carsStolen, W / 2, H / 2 - 38);
  ctx.fillText('Fares: ' + S.stats.fares + '   •   Tokens: ' + S.stats.tokens + ' / 24', W / 2, H / 2 - 10);
  ctx.fillText('Kills: ' + S.stats.kills + (S.stats.bestGp ? '   •   Best GP: ' + fmtTime(S.stats.bestGp) : ''), W / 2, H / 2 + 18);
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 17px sans-serif';
  ctx.fillText('Enter — resume      M — jobs      P — save      Q — quit to menu', W / 2, H / 2 + 66);
  ctx.fillStyle = '#b8b09e'; ctx.font = '13px sans-serif';
  ctx.fillText('Progress saves automatically after every job.', W / 2, H / 2 + 96);
}

function drawShop(S, ctx) {
  const W = S.view.w, H = S.view.h;
  ctx.fillStyle = 'rgba(20,22,28,0.55)';
  ctx.fillRect(0, 0, W, H);
  const shop = S.shops.find((s) => s.id === S.shop.id);
  const items = shopItems(S, shop);
  const bw = 560, bh = 120 + items.length * 44;
  panel(ctx, W / 2 - bw / 2, H / 2 - bh / 2, bw, bh);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffc53d'; ctx.font = 'bold 26px sans-serif';
  ctx.fillText(shop.name, W / 2 - bw / 2 + 24, H / 2 - bh / 2 + 36);
  ctx.fillStyle = '#b8b09e'; ctx.font = '14px sans-serif';
  ctx.fillText(shop.blurb + '    •    ' + fmtCash(S.cash), W / 2 - bw / 2 + 24, H / 2 - bh / 2 + 62);
  items.forEach((it, i) => {
    const y = H / 2 - bh / 2 + 92 + i * 44;
    const sel = i === S.shop.sel;
    if (sel) { ctx.fillStyle = 'rgba(255,197,61,0.18)'; ctx.fillRect(W / 2 - bw / 2 + 12, y - 16, bw - 24, 36); }
    ctx.fillStyle = it.can ? '#ffe9b8' : '#6a6a72';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(it.name, W / 2 - bw / 2 + 24, y);
    ctx.fillStyle = '#b8b09e'; ctx.font = '13px sans-serif';
    ctx.fillText(it.desc, W / 2 - bw / 2 + 200, y);
    ctx.fillStyle = it.can ? '#7ee081' : '#6a6a72'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(it.owned ? 'OWNED' : fmtCash(it.price), W / 2 + bw / 2 - 24, y);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = '#ffd166'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('↑ ↓ to choose  •  Enter to buy  •  Esc to leave', W / 2, H / 2 + bh / 2 - 18);
}

function drawJobs(S, ctx) {
  const W = S.view.w, H = S.view.h;
  ctx.fillStyle = 'rgba(20,22,28,0.6)';
  ctx.fillRect(0, 0, W, H);
  const bw = 680, bh = Math.min(H - 80, 90 + JOBS.length * 30);
  panel(ctx, W / 2 - bw / 2, H / 2 - bh / 2, bw, bh);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffc53d'; ctx.font = 'bold 24px sans-serif';
  ctx.fillText('JOB BOARD — 18 jobs, 4 acts', W / 2 - bw / 2 + 24, H / 2 - bh / 2 + 36);
  let y = H / 2 - bh / 2 + 66;
  let lastAct = 0;
  JOBS.forEach((j, i) => {
    if (j.act !== lastAct) {
      lastAct = j.act;
      ctx.fillStyle = '#7ee0ff'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(ACT_NAMES[j.act], W / 2 - bw / 2 + 24, y);
      y += 22;
    }
    const done = S.jobsDone.has(j.id);
    const open = isUnlocked(S, j) && !done;
    const sel = i === S.jobSel;
    if (sel) { ctx.fillStyle = 'rgba(255,197,61,0.16)'; ctx.fillRect(W / 2 - bw / 2 + 12, y - 14, bw - 24, 22); }
    ctx.fillStyle = done ? '#7ee081' : open ? '#ffe9b8' : '#6a6a72';
    ctx.font = (sel ? 'bold ' : '') + '14px sans-serif';
    ctx.fillText((done ? '✓ ' : open ? '○ ' : '🔒 ') + j.title + '  —  ' + fmtCash(j.reward), W / 2 - bw / 2 + 24, y);
    y += 22;
  });
  ctx.fillStyle = '#ffd166'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('↑ ↓ to choose  •  Enter to start the job  •  Esc to close', W / 2, H / 2 + bh / 2 - 14);
}

function drawBusted(S, ctx) {
  const W = S.view.w, H = S.view.h;
  ctx.fillStyle = 'rgba(20,22,40,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a4e'; ctx.font = 'bold 44px sans-serif';
  ctx.fillText('BUSTED', W / 2, H / 2 - 40);
  ctx.fillStyle = '#e8e8e8'; ctx.font = '17px sans-serif';
  ctx.fillText('The PD took ' + fmtCash(S.bustedFine || 0) + ' and dropped you outside City Hall.', W / 2, H / 2 + 4);
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 18px sans-serif';
  ctx.fillText('PRESS ENTER TO KEEP PLAYING', W / 2, H / 2 + 48);
}

function drawGameOver(S, ctx) {
  const W = S.view.w, H = S.view.h;
  ctx.fillStyle = 'rgba(20,16,16,0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a4e'; ctx.font = 'bold 44px sans-serif';
  ctx.fillText('WASTED', W / 2, H / 2 - 40);
  ctx.fillStyle = '#e8e8e8'; ctx.font = '17px sans-serif';
  ctx.fillText('Halcyon Bay is not done with you yet. ' + S.jobsDone.size + ' / 18 jobs done.', W / 2, H / 2 + 4);
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 18px sans-serif';
  ctx.fillText('PRESS ENTER TO TRY AGAIN', W / 2, H / 2 + 48);
}

function drawVictory(S, ctx) {
  const W = S.view.w, H = S.view.h;
  ctx.fillStyle = 'rgba(20,22,28,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffc53d'; ctx.font = 'bold 54px sans-serif';
  ctx.fillText('♛ THE CROWN IS YOURS ♛', W / 2, H / 2 - 90);
  ctx.fillStyle = '#ffe9b8'; ctx.font = 'bold 24px sans-serif';
  ctx.fillText('All 18 jobs done. $8,000 richer. The bay is yours.', W / 2, H / 2 - 36);
  ctx.fillStyle = '#e8e8e8'; ctx.font = '16px sans-serif';
  ctx.fillText('Cash: ' + fmtCash(S.cash) + '   •   Cars stolen: ' + S.stats.carsStolen + '   •   Fares: ' + S.stats.fares, W / 2, H / 2 + 4);
  ctx.fillText('Tokens: ' + S.stats.tokens + ' / 24   •   Kills: ' + S.stats.kills, W / 2, H / 2 + 30);
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 18px sans-serif';
  ctx.fillText('ENTER — keep free-roaming the bay', W / 2, H / 2 + 76);
}

function drawToasts(S, ctx) {
  const W = S.view.w, H = S.view.h;
  ctx.textAlign = 'center';
  S.toasts.forEach((t, i) => {
    const y = H - 120 - i * 30;
    ctx.globalAlpha = clamp(t.life / 0.5, 0, 1);
    ctx.font = 'bold 16px sans-serif';
    const w = ctx.measureText(t.text).width + 28;
    panel(ctx, (W - w) / 2, y - 15, w, 28, 0.85);
    ctx.fillStyle = t.color || '#ffe9b8';
    ctx.fillText(t.text, W / 2, y + 3);
  });
  ctx.globalAlpha = 1;
}
