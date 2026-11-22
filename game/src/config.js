// Halcyon Bay — Crown Heist. Tuning, palette and world layout constants.
// Every system reads from here, so a balance change is a one-line edit.
export const WORLD_W = 3600;
export const WORLD_H = 2700;
export const ROAD_W = 64;
export const V_ROADS = [300, 700, 1100, 1500, 1900, 2300, 2700, 3100];
export const H_ROADS = [300, 700, 1100, 1500, 1900, 2300];
export const SAVE_KEY = 'halcyon-bay-crown-heist-v1';
export const START_CASH = 250;
export const TOKEN_VALUE = 150;
export const TOKEN_COUNT = 24;
export const CROWN_REWARD = 8000;
export const PLAYER_WALK = 250;
export const PLAYER_RUN = 350;
export const PLAYER_HP = 100;
export const CAR_ACCEL = 540;
export const CAR_MAX_SPEED = 620;
export const CAR_REVERSE = 240;
export const CAR_GRIP = 2.9;
export const WANTED_DECAY = 2.4;
export const WANTED_SPOT_RANGE = 620;

// Weapons: price is the shop price, rate is seconds between shots.
export const WEAPONS = {
  pistol: { name: 'Pistol', price: 0, damage: 22, rate: 0.28, spread: 0.05, speed: 950, auto: false, pellets: 1, color: '#ffd166' },
  smg: { name: 'SMG', price: 900, damage: 13, rate: 0.085, spread: 0.13, speed: 1000, auto: true, pellets: 1, color: '#7ee0ff' },
  shotgun: { name: 'Shotgun', price: 1400, damage: 16, rate: 0.75, spread: 0.36, speed: 820, auto: false, pellets: 6, color: '#ff9f5a' },
};
export const AMMO_BOX = { smg: 120, shotgun: 150 };
export const ARMOR_PRICE = 200;
export const SNACK_PRICE = 15;
export const REPAIR_PRICE = 150;
export const NITRO_PRICE = 300;
export const PLATING_PRICE = 400;

// Shops: door points sit on the road band at a block edge, so the player
// walks up on the street and presses E. No door is inside a building.
export const SHOPS = [
  { id: 'iron-oak', name: 'Iron & Oak', kind: 'guns', x: 1240, y: 688, blurb: 'Guns, ammo, armour. No questions.' },
  { id: 'diner', name: 'Sunset Diner', kind: 'food', x: 2060, y: 1512, blurb: 'Coffee, pie, and a booth with a view.' },
  { id: 'chrome', name: 'Chrome Works', kind: 'garage', x: 860, y: 1912, blurb: 'Repairs, nitro, plating. Cash only.' },
];
export const TAXI_STANDS = [
  { x: 736, y: 1100, name: 'Grand Ave stand' },
  { x: 2336, y: 1500, name: 'Marina stand' },
  { x: 1536, y: 2300, name: 'South stand' },
];

// Sunset palette. The whole city is lit like 7pm in July.
export const PALETTE = {
  grass: '#7fae62',
  grassDry: '#a8b06a',
  sidewalk: '#c2b096',
  curb: '#8f8271',
  asphalt: '#3d414c',
  asphalt2: '#363a44',
  lane: '#e8c96a',
  crosswalk: '#d8d2c2',
  water: '#2e6f8e',
  waterDeep: '#245a75',
  sand: '#e0c184',
  roofA: '#b65c4d',
  roofB: '#4d7a9e',
  roofC: '#c98f4e',
  roofD: '#6e5a8a',
  roofE: '#5d8a6a',
  glass: '#9fc4d4',
  hud: '#14161c',
  gold: '#ffc53d',
  red: '#ff5a4e',
  green: '#7ee081',
};
