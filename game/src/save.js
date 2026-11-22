// Save / load through localStorage. One JSON blob, versioned by key.
// A corrupt or missing save just starts a fresh game.
import { SAVE_KEY, START_CASH } from './config.js';

export function saveGame(S) {
  try {
    const data = {
      cash: Math.floor(S.cash),
      jobsDone: [...S.jobsDone],
      tokens: S.world.tokens.filter((t) => t.taken).map((t) => t.id),
      owned: [...S.player.owned],
      weapon: S.player.weapon,
      ammo: S.player.ammo,
      stats: S.stats,
      px: Math.round(S.player.x), py: Math.round(S.player.y),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* storage unavailable: the game still plays */ }
}

export function loadGame(S) {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { data = null; }
  if (!data) return false;
  S.cash = typeof data.cash === 'number' ? data.cash : START_CASH;
  S.jobsDone = new Set(data.jobsDone || []);
  for (const id of data.tokens || []) { const t = S.world.tokens.find((x) => x.id === id); if (t) t.taken = true; }
  S.player.owned = new Set(data.owned || ['pistol']);
  if (data.weapon && S.player.owned.has(data.weapon)) S.player.weapon = data.weapon;
  S.player.ammo = data.ammo || { smg: 0, shotgun: 0 };
  if (data.stats) Object.assign(S.stats, data.stats);
  if (typeof data.px === 'number') { S.player.x = data.px; S.player.y = data.py; }
  return true;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
