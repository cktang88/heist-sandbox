# Smash & Grab

A side-on heist game where every wall can be blown apart. Drop in, steal the gold case from the vault, and get back to the van. Go quiet or go loud.

```
        plane drop (parachute)
              ↓
   van      ┌─────────┐ roof hatch / skylight
  ┌──┐      │ guards  │
  │  │ ───► │ door    │  front door (lockpick)
──┴──┴──────┴────┬────┴────────
   manhole       │ basement ── vault ★
     └──── sewer ┘  (hatch, or blast up through the floor)
```

## Run it

```bash
npm install
```

```bash
npm run dev
```

Checks:

```bash
npm test
```

```bash
npm run build
```

## Controls

| Key | Action |
|---|---|
| A / D | Move |
| W / S | Climb ladders |
| Space | Jump. In mid-air: open or close the parachute |
| Mouse | Aim and use the tool in hand |
| 1-6 or wheel | Pick a tool |
| E | Pick locks (hold), take down an unaware guard, recall the drone |
| Q | Set off all C4 |
| Shift | Focus: slow motion, slowest when you hold still |
| Enter | New heist after winning or losing |

## Tools

| # | Tool | Quiet? | Use |
|---|---|---|---|
| 1 | Pistol | Yes | Drops unaware guards in one shot |
| 2 | Rifle | No | Fast fire, chews through walls |
| 3 | Rockets | No | Blast holes anywhere |
| 4 | C4 | Until it goes off | Throw, then press Q. Breaks even the steel vault |
| 5 | Drill | Mostly | Tunnel through anything, slowly |
| 6 | Drone | Yes | Fly it with the move keys to scout, click to detonate |

## How stealth works

- Guards show what they can see as a cone. Stay out of it, or behind something solid.
- Noise draws guards to look. Loud tools carry a long way.
- A guard who has spotted you for a few seconds raises the alarm, and everyone comes.
- Slow motion kicks in briefly when you are spotted, when a bullet just misses, and when a blast takes out a guard.

## Code layout

- `src/game/` is the whole game with no browser code: tiles, physics, guards, tools, explosions. `step.ts` advances one frame; `world.ts` holds the state.
- `src/render/` only draws the world.
- `src/inputDevice.ts` turns keyboard and mouse into the `Input` the game reads.
- Add `?seed=1` to the URL to replay the same level.
