# Marina Bay: Smuggler's Run

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/slothanabot/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/slothanabot/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![License: MIT](https://img.shields.io/badge/License-MIT-7dff9a)](LICENSE)

An original open-world crime game built for the make.fun **"Make GTA 6"** bounty
($1,666 USDC). No Rockstar names, maps, characters or assets — everything here is
ours: the city, the story, the art and the sound.

## The game

Sun, salt and fast money. You are **Dario Costa**, a courier for the Harborlight
crew in **Marina Bay** — a sunny coastal city with a beach boardwalk, a harbor
full of containers, a marina, and a lighthouse at the south point.

- **Open world on foot and by car** — drive detailed cars (or steal them),
  with traffic looping the road grid and pedestrians on the sidewalks.
- **Wanted system** — 1–5 stars. Harbor-patrol cars chase you, sirens wailing,
  and getting caught means getting busted.
- **Missions + story** — five courier runs: a dock pickup, a timed boardwalk
  delivery, losing the heat at the Coral Hotel, a gang shootout at the
  lighthouse, and a three-drop final score.
- **Combat** — fists, a knife and a pistol (ammo, muzzle flash, tracers), armed
  gang members, and an ally, Mara, who fights beside you once you hand her a gun.
- **HUD** — cash, health, wanted stars, weapon + ammo, mission objective with
  distance and timer, and a circular minimap with live traffic, police and the
  mission marker.
- **Start, save and pause** — progress saves to localStorage; continue anytime.
- **Sound** — fully synthesized WebAudio: engine hum, sirens, gunshots, ocean
  waves and a sunny bassline. No external audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive (camera-relative) |
| Mouse drag | Nudge camera |
| SHIFT | Sprint |
| SPACE | Jump |
| E | Enter / steal a car, pick up weapons |
| F / click | Punch / attack, fire pistol |
| 1 / 2 | Knife / pistol |
| R | Reload |
| G | Hand Mara a pistol |
| P / ESC | Pause |
| M | Mute |

## Play

```sh
node serve.ts
# open http://localhost:8080
```

Everything runs offline from static files under `game/` — three.js is vendored
under `game/vendor/`, all art is drawn in code, all sound is synthesized.

## License

MIT — see [LICENSE](LICENSE).
