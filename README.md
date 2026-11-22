# Halcyon Bay — Crown Heist

An original open-world crime game for make.fun's **gta6-01** ("Make GTA 6").
A sun-soaked coastal city, four acts, 18 jobs, and one $8,000 finale.

## The game

You are new in Halcyon Bay. Steal a car, run jobs for the people who own
the night, buy guns at Iron & Oak, eat pie at the Sunset Diner, outrun the
Halcyon Bay PD — and finish by walking into the Crown Casino, taking the
Crown, and running the whole bay to the ferry with four stars on you.

- **A city on foot and by car** — grid streets, traffic, pedestrians, three
  new landmarks: Halcyon Bowl stadium, Northgate Airfield, Ferry Terminal.
- **Wanted system** — 0–5 stars, police cars that chase and ram, busted
  fines, heat that decays when you hide.
- **Combat** — pistol, SMG ($900), shotgun ($1,400), armour, rival gunmen.
- **Economy** — 3 shops, 24 sunset tokens (+$150 each), taxi fares (T at a
  stand, paid by distance), nitro and armour plating for your car.
- **18 jobs / 4 acts** — couriers, getaways, pursuits, arms deals, taxi
  shifts, checkpoint races (Grand Avenue GP), and the Crown Heist finale.
- **HUD + minimap, save/load, WebAudio synth sound** (engine, sirens,
  gunshots, a lazy bassline). No network, no libraries, no assets but code.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse + click | Aim / fire (J also fires) |
| E | Enter car, exit car, open shop |
| 1 / 2 / 3 | Pistol / SMG / shotgun |
| Shift | Run on foot, nitro in a car |
| T | Taxi fare at a yellow stand |
| M | Job board |
| P | Save · Esc — pause · Q — quit to menu (from pause) |

## Run it

Open `game/index.html` in a desktop browser (or `node serve.ts` and open
http://localhost:8080). Everything is static files under `game/`.

## Hand it in

```
MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` to `out/` and writes
`out/dossier.json` with the kit's `vendor/makefun-game.ts`.

## Screenshots

`?shot=` stages a scene: `start`, `play`, `chase`, `race`, `economy`.
`?seed=` fixes the RNG (default 20261122).

## License

MIT. All names, places, art, and code are original — nothing from any
commercial game.
