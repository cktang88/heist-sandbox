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
| W / S | Climb ladders, stairs and ropes; ride elevators |
| Space | Jump. Tap again in the air to double jump. Grabs ledges |
| Hold Space while falling | Parachute |
| C or Ctrl | Crouch (quieter, hides behind low cover); slide when running |
| Mouse | Aim and use the tool in hand |
| R | Reload |
| 1-9, 0 or wheel | Pick a tool. Press 9 again for Frag; 7 again for Rope, then Grapple |
| E | Do the thing in reach: break in through a window (tap to smash, hold to cut quietly), pick locks, take down, hack, cut wires, switches, call elevators |
| F / V | Punch / kick (kick also tips tables and bursts doors) |
| Hold G | Drag furniture, or hold a guard from behind as a shield |
| T | Throw the nearest small object where you aim |
| Q or right-click | Set off all C4. C4 sticks to walls, doors and ceilings |
| Shift | Focus: slow motion, slowest when you hold still |
| Esc or P | Pause menu: controls, help, settings (art style, quality, site, seed, sound) |
| H / K or F1 | Help / controls list |
| Enter | New heist after winning or losing |

## Tools

| # | Tool | Quiet? | Use |
|---|---|---|---|
| 1 | Pistol | Yes | Drops unaware guards in one shot |
| 2 | Rifle | No | Fast fire; goes through doors |
| 3 | Shotgun | No | Nine pellets, huge up close, useless far away |
| 4 | Sniper | No | One heavy shot; goes through doors, brick and people |
| 5 | Rockets | No | Blast holes anywhere |
| 6 | C4 | Until it goes off | Throw, then press Q. Breaks even the steel vault |
| 7 | Drill / Rope / Grapple | Mostly | Tunnel slowly; tie a rope at an edge; or fire a hook, reel with W/S, swing with A/D |
| 8 | Drone | Yes | Fly it with the move keys to scout, click to detonate |
| 9 | Smoke / Frag | Yes / No | Hide in smoke, or roll a frag down the stairs |
| 0 | Flash | No | Blinds and deafens anyone looking |

## Things the world lets you do

- The gold case is hidden. Question guards who surrender, are tied up or are held as a shield (about 70% tell the truth); read notes and hack files for better clues. Go loud and the guards move it.
- Walk past a hole blown in a floor, hold S over it to drop through, or jump up through it.
- Shoot out lamps, cameras, alarm buttons, radio relays and fuse boxes.
- Push a desk against a door to block it, or under a hole in the ceiling to climb up.
- Blow up a stair flight or cut an elevator cable to stop guards following.
- Destroy a floor and whatever stood on it falls; cars catch fire and explode.
- Shoot fuel drums and gas cylinders; fire spreads and sprinklers answer.

The crosshair ring widens as a gun gets less accurate, so spread is never a surprise.

## How stealth works

- Guards show what they can see as a torch beam. Stay out of it, or behind something solid.
- Noise draws guards to look. Loud tools carry a long way.
- A guard who spots you radios it in. The site alert rises in steps (0 to 4): first one guard looks, then squads search, then the alarm rings, the elevators lock down and three armoured responders drive in.
- Cut the radio relay and guards must run to an alarm button instead. Cut the power and they go to the fuse box.
- Slow motion kicks in briefly when you are spotted, when a bullet just misses, and when a blast takes out a guard.

## The world reacts

- Anything you cut off from the ground falls: blow out a wall and the floors above come down, crushing whoever is underneath.
- Downed guards go limp and get thrown by later blasts.
- Medkits and ammo boxes are scattered around the site.
- Even-numbered seeds flip the level, so the van and the building swap sides.
- Sound is built in, and drops in pitch during slow motion. It starts after your first click or key press.

## Graphics and sound

- The game is drawn in real 3D, viewed from the side: photo-scanned wall textures, moonlight, lamps and torches that cast shadows, glow around bright things, film-style tone mapping and a little lens grain.
- Gunfire and explosions are real recordings. Everything else is generated.
- Third-party assets are public domain (CC0), listed in `public/textures/LICENSE.md`, except the furniture models in `public/models2/`, which are CC BY 4.0 and credited in `public/models2/CREDITS.md`.

If it runs slowly, add one of these to the address:

| Add | Effect |
|---|---|
| `?quality=low` | Keeps 3D, drops shadows and sharpness |
| `?render=2d` | The earlier flat view, which needs no graphics card |

## Code layout

- `src/game/` is the whole game with no browser code: tiles, physics, guards, tools, explosions. `step.ts` advances one frame; `world.ts` holds the state.
- `src/render3d/` draws the world in 3D: level geometry (`levelMesh.ts`), lights (`lights.ts`), people (`people3d.ts`), effects (`fx3d.ts`), lens effects (`post.ts`).
- `src/render/` holds the 2D pieces: the HUD, the markers drawn over the 3D view (`overlay.ts`), the skeleton poses both views share (`human/pose.ts`), and the fallback flat renderer.
- `src/inputDevice.ts` turns keyboard and mouse into the `Input` the game reads; `src/audio.ts` plays the sound events the game records.
- Add `?seed=1` to the URL to replay the same level. The default site is the big complex (a 20+ storey tower, depot, quarters, silos); add `?site=outpost` for the small one.
