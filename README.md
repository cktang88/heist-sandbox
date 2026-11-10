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
| Space | Jump. Tap again in the air to double jump |
| Hold Space while falling | Parachute |
| Mouse | Aim and use the tool in hand |
| R | Reload |
| 1-8 or wheel | Pick a tool |
| E | Pick locks (hold), take down an unaware guard, recall the drone |
| Q | Set off all C4 |
| Shift | Focus: slow motion, slowest when you hold still |
| Enter | New heist after winning or losing |

## Tools

| # | Tool | Quiet? | Use |
|---|---|---|---|
| 1 | Pistol | Yes | Drops unaware guards in one shot |
| 2 | Rifle | No | Fast fire; spread grows while you hold the trigger |
| 3 | Shotgun | No | Nine pellets, huge up close, useless far away |
| 4 | Sniper | No | One heavy, perfectly straight shot |
| 5 | Rockets | No | Blast holes anywhere |
| 6 | C4 | Until it goes off | Throw, then press Q. Breaks even the steel vault |
| 7 | Drill | Mostly | Tunnel through anything, slowly |
| 8 | Drone | Yes | Fly it with the move keys to scout, click to detonate |

The crosshair ring widens as a gun gets less accurate, so spread is never a surprise.

## How stealth works

- Guards show what they can see as a torch beam. Stay out of it, or behind something solid.
- Noise draws guards to look. Loud tools carry a long way.
- A guard who has spotted you for a few seconds raises the alarm. Then every guard hunts you, climbing ladders and kicking doors open, and three armoured responders drive in.
- Slow motion kicks in briefly when you are spotted, when a bullet just misses, and when a blast takes out a guard.

## The world reacts

- Anything you cut off from the ground falls: blow out a wall and the floors above come down, crushing whoever is underneath.
- Downed guards go limp and get thrown by later blasts.
- Medkits and ammo boxes are scattered around the site.
- Even-numbered seeds flip the level, so the van and the building swap sides.
- Sound is built in, and drops in pitch during slow motion. It starts after your first click or key press.

## Code layout

- `src/game/` is the whole game with no browser code: tiles, physics, guards, tools, explosions. `step.ts` advances one frame; `world.ts` holds the state.
- `src/render/` only draws the world: cached textured tiles (`tileCache.ts`), night lighting (`lighting.ts`), and code-drawn people (`human/`).
- `src/inputDevice.ts` turns keyboard and mouse into the `Input` the game reads; `src/audio.ts` plays the sound events the game records.
- Add `?seed=1` to the URL to replay the same level.
