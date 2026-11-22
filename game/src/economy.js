// The economy: cash, three shops, sunset tokens, and taxi fares.
// Shops open with E at the door. Tokens are +$150 the moment you touch
// one. Taxis pay by distance when you drop the passenger off.
import { SHOPS, TAXI_STANDS, TOKEN_VALUE, WEAPONS, AMMO_BOX, ARMOR_PRICE, SNACK_PRICE, REPAIR_PRICE, NITRO_PRICE, PLATING_PRICE, PLAYER_HP } from './config.js';
import { dist, fmtCash } from './util.js';
import { roadPoint } from './world.js';

export function shopItems(S, shop) {
  const p = S.player;
  if (shop.kind === 'guns') {
    return [
      { id: 'smg', name: 'SMG', desc: 'Fast, hungry, loud', price: WEAPONS.smg.price, owned: p.owned.has('smg'), can: !p.owned.has('smg') },
      { id: 'shotgun', name: 'Shotgun', desc: 'Six pellets of no', price: WEAPONS.shotgun.price, owned: p.owned.has('shotgun'), can: !p.owned.has('shotgun') },
      { id: 'ammo-smg', name: 'SMG ammo box', desc: '+120 rounds', price: AMMO_BOX.smg, owned: false, can: p.owned.has('smg') },
      { id: 'ammo-shotgun', name: 'Shotgun shells', desc: '+24 shells', price: AMMO_BOX.shotgun, owned: false, can: p.owned.has('shotgun') },
      { id: 'armor', name: 'Body armour', desc: '+50 armour', price: ARMOR_PRICE, owned: false, can: p.armor < 100 },
    ];
  }
  if (shop.kind === 'food') {
    return [
      { id: 'snack', name: 'Sunset pie', desc: 'Heal +35', price: SNACK_PRICE, owned: false, can: p.hp < PLAYER_HP },
      { id: 'coffee', name: 'Bay coffee', desc: 'Heal +15, feel alive', price: 8, owned: false, can: p.hp < PLAYER_HP },
      { id: 'tip', name: 'Tip the waitress', desc: 'She knows things (+1 job hint)', price: 25, owned: false, can: true },
    ];
  }
  return [
    { id: 'repair', name: 'Full repair', desc: 'Your car, good as new', price: REPAIR_PRICE, owned: false, can: !!p.car && p.car.hp < 100 },
    { id: 'nitro', name: 'Nitro kit', desc: 'Hold Shift for a boost', price: NITRO_PRICE, owned: false, can: !!p.car && p.car.nitro <= 0 },
    { id: 'plating', name: 'Armour plating', desc: 'Car takes half damage', price: PLATING_PRICE, owned: false, can: !!p.car && !p.car.plate },
    { id: 'wash', name: 'Wash & wax', desc: 'Shine like you mean it', price: 20, owned: false, can: !!p.car },
  ];
}

export function buyItem(S, shop, item) {
  const p = S.player;
  if (S.cash < item.price) { S.toast('Not enough cash — ' + fmtCash(item.price) + ' needed', '#ff5a4e'); S.audio.fail(); return false; }
  S.cash -= item.price;
  if (item.id === 'smg' || item.id === 'shotgun') { p.owned.add(item.id); p.weapon = item.id; p.ammo[item.id] = item.id === 'smg' ? 240 : 60; }
  else if (item.id === 'ammo-smg') p.ammo.smg = (p.ammo.smg || 0) + 120;
  else if (item.id === 'ammo-shotgun') p.ammo.shotgun = (p.ammo.shotgun || 0) + 24;
  else if (item.id === 'armor') p.armor = Math.min(100, p.armor + 50);
  else if (item.id === 'snack') p.hp = Math.min(PLAYER_HP, p.hp + 35);
  else if (item.id === 'coffee') p.hp = Math.min(PLAYER_HP, p.hp + 15);
  else if (item.id === 'tip') S.toast('“The Crown job? Talk to the man at the casino.”', '#ffd166');
  else if (item.id === 'repair' && p.car) p.car.hp = 100;
  else if (item.id === 'nitro' && p.car) p.car.nitro = 8;
  else if (item.id === 'plating' && p.car) p.car.plate = true;
  S.audio.cash();
  S.toast('Bought ' + item.name + ' for ' + fmtCash(item.price));
  return true;
}

export function nearestShop(S) {
  const p = S.player;
  for (const s of SHOPS) if (dist(p.x, p.y, s.x, s.y) < 70) return s;
  return null;
}

export function updateTokens(S) {
  const p = S.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  for (const t of S.world.tokens) {
    if (t.taken) continue;
    if (dist(px, py, t.x, t.y) < 34) {
      t.taken = true;
      S.cash += TOKEN_VALUE;
      S.stats.tokens++;
      S.floats.push({ x: t.x, y: t.y, text: '+$' + TOKEN_VALUE + ' sunset token', color: '#ffc53d', life: 1.4 });
      S.audio.pickup();
      S.toast('Sunset token +' + fmtCash(TOKEN_VALUE) + ' (' + S.stats.tokens + '/24)');
    }
  }
}

// Taxi fares: press T at a stand, pick the passenger up, drive them to
// the marker. Payout scales with distance; fast drops pay a bonus.
export function tryTaxi(S) {
  const p = S.player;
  if (S.taxi.active) return false;
  if (!p.car) { S.toast('You need a car to run fares', '#ff5a4e'); return false; }
  let near = null;
  for (const s of TAXI_STANDS) if (dist(p.car.x, p.car.y, s.x, s.y) < 90) near = s;
  if (!near) { S.toast('No taxi stand here — look for the yellow T on the map', '#ff5a4e'); return false; }
  const dests = [roadPoint(0, 5), roadPoint(7, 0), roadPoint(3, 3), roadPoint(6, 2), roadPoint(1, 4), roadPoint(5, 5)];
  const dest = dests[Math.floor(S.rng() * dests.length)];
  const d = dist(near.x, near.y, dest.x, dest.y);
  S.taxi = { active: true, phase: 'pickup', stand: near, dest, payout: Math.round(60 + d / 14), timer: 90, fareNo: (S.taxi.fareNo || 0) + 1 };
  S.toast('Fare #' + S.taxi.fareNo + ': pick up the passenger at the stand');
  return true;
}

export function updateTaxi(S, dt) {
  const t = S.taxi;
  if (!t.active) return;
  const p = S.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  t.timer -= dt;
  if (t.timer <= 0) {
    S.taxi = { active: false, fareNo: t.fareNo };
    S.toast('Fare expired — the passenger took another cab', '#ff5a4e');
    return;
  }
  if (t.phase === 'pickup') {
    if (dist(px, py, t.stand.x, t.stand.y) < 70) {
      t.phase = 'dropoff';
      S.toast('Passenger in — take them to the marker, ' + fmtCash(t.payout) + ' on the line');
    }
    return;
  }
  if (dist(px, py, t.dest.x, t.dest.y) < 60) {
    const bonus = t.timer > 45 ? 40 : 0;
    const pay = t.payout + bonus;
    S.cash += pay;
    S.stats.fares++;
    S.stats.fareCash += pay;
    S.audio.cash();
    S.floats.push({ x: t.dest.x, y: t.dest.y, text: '+$' + pay + ' fare', color: '#7ee081', life: 1.4 });
    S.toast('Fare complete +' + fmtCash(pay) + (bonus ? ' (fast-drop bonus!)' : ''));
    S.taxi = { active: false, fareNo: t.fareNo };
    if (S.mission) S.mission.onFare?.(S);
  }
}
