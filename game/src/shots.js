// Screenshot staging: ?shot= picks a scene the Playwright script can
// capture, ?seed= fixes the RNG. Every shot is a real game state, not a
// mock: the menu, live play, a police chase, the Grand Avenue GP, and
// the gun shop with the economy on display.
import { startJob } from './missions.js';
import { makeCar } from './vehicles.js';

function putPlayerInCar(S, x, y, angle, model, color) {
  const car = makeCar(x, y, angle, model || 'sedan', 'player');
  if (color) car.color = color;
  S.cars.push(car);
  S.player.car = car;
  S.player.x = x; S.player.y = y; S.player.angle = angle;
  S.camera.x = x; S.camera.y = y;
  return car;
}

export function applyShot(S, params) {
  const shot = params.get('shot');
  if (!shot) return;
  if (shot === 'start') {
    S.mode = 'menu';
    S.camera.x = 1700; S.camera.y = 1350;
    return;
  }
  S.mode = 'playing';
  if (shot === 'play') {
    S.cash = 1250;
    putPlayerInCar(S, 1500, 1100, 0, 'sedan', '#c94f43');
    return;
  }
  if (shot === 'chase') {
    S.cash = 2400;
    putPlayerInCar(S, 1900, 1100, 0, 'coupe', '#ffd166');
    S.wanted.heat = 60; S.wanted.stars = 3;
    for (let i = 0; i < 3; i++) {
      const c = makeCar(1900 - 160 - i * 90, 1100 + (i % 2 === 0 ? 44 : -44), 0, 'police', 'police');
      c.hp = 120;
      S.cars.push(c);
      S.cops.push(c);
    }
    S.audio.siren(true);
    return;
  }
  if (shot === 'race') {
    for (let i = 1; i <= 14; i++) S.jobsDone.add('j' + i);
    startJob(S, 'j15');
    const car = putPlayerInCar(S, 1100, 1100, 0, 'coupe', '#ffd166');
    car.nitro = 8;
    if (S.mission) S.mission.data.cp = 1;
    S.cash = 3200;
    return;
  }
  if (shot === 'economy') {
    S.cash = 2400;
    S.player.x = 1240; S.player.y = 720;
    S.player.car = null;
    S.camera.x = 1240; S.camera.y = 700;
    S.mode = 'shop';
    S.shop = { id: 'iron-oak', sel: 0 };
    return;
  }
}
