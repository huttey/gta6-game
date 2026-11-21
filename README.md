# gta6-game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/huttey/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/huttey/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar is a complete open-world crime game in the spirit of GTA 6, played offline in a desktop browser from static files: a sun-soaked coastal city to explore on foot and by car, with traffic and pedestrians, cars to steal, a wanted level and police who chase you, five story missions, combat, a HUD with a live minimap, and a save that keeps your progress.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network request, no install.

## How to play

Rico owes the Vipers $5,000. One week in Solmar to pay it back — steal cars, run jobs, lose the cops, and do not get caught.

- **Move** — WASD or arrow keys (Shift to run). **Enter a car** — E near a car. **Drive** — W/S to accelerate and brake, A/D to steer. **Punch** — F. **Shoot** — aim with the mouse, click to fire (pistol, pick up ammo around the city). **Pause** — P or Esc. **Mute** — M.
- **Wanted** — stealing a car, hitting a pedestrian or firing a gun raises your wanted level. Police cars and foot cops chase you; get busted and they take their cut. Lay low and the heat fades.
- **Missions** — five story missions, one after the other, with a pink marker and a GPS arrow showing the way. Finish the story and taxi fares keep the cash coming.
- **Save** — your cash, story progress and position save automatically; Continue on the title screen picks up where you left off.

## What is inside

- `game/` — the playable game as static files: `index.html` and ES modules under `game/src/` (city, actors, missions, world, render, audio, save, shots).
- `main.ts` — the program that hands the game in: it copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json`.
- `screenshots/` — four real renders of the game's own code: a police chase, a walk through traffic, the shootout at the meet, and the title screen.
- `vendor/makefun-game.ts` — the make.fun library, copied unchanged from the kit.

Everything in Solmar — the city, characters, vehicles, names, story, art and sound — is original. Nothing comes from Rockstar Games or any commercial game.

---

<sub>Entered on [make.fun](https://make.fun/?ref=rsq9xkyh&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
