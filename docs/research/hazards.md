# Hazards research: fire, smoke, flashbangs, gas, extinguishers, sprinklers

Scope: side-view destructible tile grid (about 1 m tiles), 60 Hz TypeScript sim, three.js render, stealth AI.

## Read this first: how well sourced this is

- Every page fetch (WebFetch) failed in this session with DNS errors (en.wikipedia.org, gamedeveloper.com, 80.lv, developer.valvesoftware.com, wikiwand, cs2guide.pages.dev). The network proxy appears to block them. No page was opened and read in full.
- All sourced claims below come from WebSearch result summaries, which quote the pages listed. Treat them as second-hand and check the primary source before relying on a number.
- Sections marked **[Design]** are my own modelling choices, not findings. They are not sourced and are meant to be tuned in play.
- Anything I could not confirm is listed in "Could not verify".

---

## 1. Fire

### 1.1 Findings from games

| Game | What was found | Source |
|---|---|---|
| Far Cry 2 | Jean-Francois Levesque (Ubisoft Montreal gameplay programmer) spent about 1.5 years on the fire system. He gave a Gamasutra interview on how fire fuels and spreads, including interaction with AI and level design. Reviews note fire is out of your control once lit. The interview text itself was not readable. | https://gamedeveloper.com/game-platforms/interview-how-i-far-cry-2-i-s-fire-fuels-spreads , https://kotaku.com/the-story-of-far-cry-2s-fire-5077806 |
| Far Cry 2 (dev write-up) | A forum post by a developer who says they architected the Far Cry 2 fire propagation system. Author not confirmed as Levesque. | https://forum.devtalk.com/t/far-cry-how-the-fire-burns-and-spreads-2012/5121 |
| Noita | Petri Purho: "essentially complex cellular automata. Every pixel follows rather simple rules, but combined you get surprising results." GDC 2019 talk "Exploring the Tech and Design of Noita". No detail on fire in the results. | https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/ , https://gdcvault.com/play/1025695/Exploring-the-Tech-and-Design |
| Breath of the Wild | A "chemistry engine" separate from physics. Materials change state when touched by fire, water, ice, wind or electricity. Fire spreads through dry grass, wood, leaves, cloth. Attribution to a 2017 GDC talk (Dohta) is inconsistent across fan sources. No primary technical source found. | https://geekchamp.com/the-legend-of-zelda-breath-of-the-wild-makes-chemistry-just-as-important-as-physics/ , https://saschb2b.github.io/game-mechanics/games/zelda-botw/chemistry-engine |
| Minecraft | Per-block "encouragement" (how fast a neighbour ignites) and "flammability" (how fast a burning block is consumed). Fire has an age 0..15 that increments each tick. After age 3, fire with no flammable neighbour is put out on the next tick. At age 15 with no flammable block beneath it, it has a 25% chance per tick to stop. Spread chance is roughly (ignite odds + 40 + 7 x difficulty) / (age + 30), so older fires spread less. Rain has a 20-65% per-tick chance to extinguish. Humid biomes halve spread. These numbers come from community wikis, not Mojang. | https://minecraft.fandom.com/wiki/Fire , https://www.minecraftmaps.com/tools/fire-spread |
| Teardown, Dwarf Fortress | Not researched successfully. No source obtained. | none |

Takeaway for this game: the cheap, proven pattern is a per-cell "fire age" that increments, spreads to flammable neighbours with a probability that falls with age, and dies when it runs out of fuel or hits a moisture check.

### 1.2 Real fire physics worth borrowing

| Topic | Finding | Source |
|---|---|---|
| Flashover | Upper gas layer reaches about 500-600 C, and radiant heat flux at floor level exceeds about 20 kW/m2. Federal definition uses 600 C and 20 kW/m2. | https://www.law.cornell.edu/cfr/text/41/102-80.145 |
| Ventilation-limited flashover | A simulator page cites the Thomas correlation: minimum heat release Q = 7.8*A_T + 378*A_v*sqrt(H_v) kW. Larger openings need more heat release to flash over. Lower authority source. | https://homo-deus-lab.pages.dev/lab/fire-engineering/flashover-model/ |
| Smoke layer behaviour | Plume hits the ceiling, spreads as a ceiling jet, is deflected down at the walls, then builds a hot upper layer that thickens over time. Upper layers form quickly in compartments joined by corridors. | https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6046.pdf , https://www.nist.gov/publications/note-improving-corridor-floor-predictions-zone-fire-model-nistir-6046 |
| Sprinkler heads | A common head is a 155 F (68 C) glass bulb, K-factor 5.6 gpm per sqrt(psi), so flow scales with square root of pressure. The bulb liquid expands and shatters at its rating. Standard-response uses a 5 mm bulb, quick-response a 3 mm bulb. | https://qrfs.com/fire-sprinklers/reliable-ra1425-upright-sprinkler-qr-5-6k-brass-155f-f1fr56u1bn , https://cdn.shopify.com/s/files/1/2233/5109/files/RA1425_Spec_Sheet.pdf |
| Extinguishers | ABC 2.5 lb: about 9 s discharge, 9-15 ft range. ABC 5 lb: about 14 s, 12-18 ft. CO2 5 lb: about 9 s. CO2 stream range 3-8 ft, discharge time 8-30 s depending on size. | https://firealarm.com/wp-content/uploads/2025/09/buckeye_amera.pdf , https://www.naffco.com/co2-portable-fire-extinguishers-ul-listed , https://www.scribd.com/document/661034674/hand-portable-extinguishers |
| BLEVE | Fire-weakened pressure vessel fails in a fraction of a second, followed by a fireball if the contents are flammable. Propane fireball radius about 18 m for a 400 L tank, 38 m for 4,000 L, 81 m for 40,000 L. Responders work at 4 x radius. | https://tc.canada.ca/en/dangerous-goods/transportation-dangerous-goods/bleve-response-prevention |
| M84 and flammables | The M84 can ignite highly flammable liquids or vapours nearby. | search summary of https://en.wikipedia.org/wiki/M84_stun_grenade |

Backdraft: I found no source in this session. See "Could not verify".

---

## 2. Smoke

### 2.1 Counter-Strike 2

- Valve describes smoke as volumetric: it can be pushed by grenades, bullets and more, and fills spaces naturally. Source: https://developer.valvesoftware.com/wiki/Cs2 (via search summary).
- Reports say smoke spills out of windows, fills corridors, creeps over stairs. Bullets cut temporary holes. HE explosions push it aside briefly, then it reforms. Source: https://www.spieltimes.io/news/counter-strike-2-smokes-system-will-work/ , https://esports.gg/news/cs-go/counter-strike-2-innovates-in-the-way-smokes-are-used-in-game
- A third-party Unreal Engine 5 recreation reportedly used flood fill for space filling. This is a guess about Valve's method, not documented by Valve. Source: https://80.lv/articles/counter-strike-2-s-volumetric-smoke-recreated-in-unreal-engine-5

Takeaway: a flood-fill with a volume budget, plus "carve" events that temporarily zero density near bullets and blasts, reproduces the player-visible behaviour.

### 2.2 M18 smoke grenade

| Property | Value | Source |
|---|---|---|
| Burn time | About 50-90 s (one source: 1-1.5 min for older versions) | https://wiki.privacytools.io/wiki/AN_M18 |
| Fuse (M201A1 igniter) | 1.0-2.3 s | search summary of https://en.wikipedia.org/wiki/M18_smoke_grenade |
| Toxicity | Smoke harmful if inhaled even with newer mixes; displaces oxygen in enclosed spaces. HC-filled smoke (M8) is more toxic than M18; its toxicity is attributed to zinc chloride. | https://nap.nationalacademies.org/read/5582/chapter/7 |
| Coverage | Not found. | - |

### 2.3 Detectors

- Photoelectric detectors alarm at about 3 +/- 0.5 percent obscuration per foot, ionization about 1.5 +/- 0.5. Photoelectric responds best to smouldering, ionization to flaming fire. Dual-sensor alarms were faster in NIST tests. Source: https://www.nist.gov/publications/performance-dual-photoelectric-ionization-smoke-alarms-full-scale-fire-tests , https://www.rfwireless-world.com/Terminology/What-is-Obscuration.html

---

## 3. Flashbangs

### 3.1 Real M84

| Property | Value | Source |
|---|---|---|
| Sound | 170-180 dB within about 1.5 m (5 ft) | https://en.wikipedia.org/wiki/M84_stun_grenade , https://special-ops.org/?p=82240 |
| Light | Sources conflict: about 1 million, 4.5 million, or 6-8 million candela | same plus https://3dwarehouse-classic.sketchup.com/model/e5d7992d74774896e85d877ffb2f57c4/Stun-Flash-grenade-M84-updated |
| Fuse | About 1.0-2.3 s (M201A1 igniter) | search summary of the M84 and M18 pages |
| Effects | Flash blindness, deafness, tinnitus, inner ear damage within 5 ft. Disorientation. | https://en.wikipedia.org/wiki/M84_stun_grenade |
| Flash blindness duration | Depends on task and light conditions, hard to predict. No seconds figure found. | https://apps.dtic.mil/sti/trecms/pdf/AD1122501.pdf (not read in full) |
| Hearing | Temporary threshold shift usually recovers in hours to weeks. | https://pubs.asha.org/doi/10.1044/2025_JSLHR-25-00284 |

### 3.2 Counter-Strike

- Strength and duration depend on angle to the explosion and distance. Source: https://developer.valvesoftware.com/wiki/Flashbang
- Community table (CS:GO/CS2), angle from aim to full-blind time to total effect time: 0-53 deg: 1.88 s / 4.87 s; 53-72: 0.45 / 3.4; 72-101: 0.08 / 1.95; 101-180: 0.08 / 0.95. Source: https://counterstrike.fandom.com/wiki/Flashbang , https://csdb.gg/weapon/flashbang/ (community-derived, other guides disagree).
- Since CS:Source, victims also get temporary deafness with only ringing audible. Source: same Valve page.
- Rainbow Six Siege and Ready or Not: nothing obtained.

---

## 4. Rendering (three.js)

| Technique | Finding | Source |
|---|---|---|
| Noise-based fire/smoke | One write-up uses r170, WebGL2, half-float render targets, a baked 96^3 noise texture, hand-written bloom and composite. | https://www.ui-skills.com/skills/mengto/fire-smoke-skill-vfx |
| Ray-marched fire | Iteration count (default 20) and noise octaves (default 3) are the main quality/cost knobs. Older phones struggle with heavy noise. | https://app.unpkg.com/@wolffo/three-fire@1.3.0/files/dist/types/Fire.d.ts , https://discourse.threejs.org/t/help-wanted-three-fire-glsl-to-tsl/86088 |
| Soft particles | Depth-texture fade near geometry. Reference: http://blog.wolfire.com/2010/04/Soft-Particles | https://discourse.threejs.org/t/soft-particles-render/504.md |
| GPU particles | A compute system demo uses 64k particles and claims up to about 1M in practice. | https://discourse.threejs.org/t/gpu-driven-particle-system/94233.md |
| Colour | Fire textures may look wrong after colour-management changes. | https://discourse.threejs.org/t/points-transparent-textures-depth-artifacts-soft-particles/5927?page=2 |

No sourced material on flipbook sprites, heat distortion, scorch decals, or flashbang shaders.

---

## 5. Could not verify

- Far Cry 2 internal data structure (grid size, rules): interview unreadable. A GDC talk by Levesque was not confirmed to exist.
- Dwarf Fortress and Teardown fire implementation: no source.
- Noita's per-material fire rules (ignition, burn time): no source.
- Breath of the Wild technical details and talk attribution.
- M18 coverage volume and exact time to full bloom.
- Quantitative flash-blindness and afterimage duration for the M84; the candela figure (sources span 1 to 8 million).
- Rainbow Six Siege and Ready or Not flash implementations; CS2 smoke volume/voxel numbers.
- Backdraft thresholds and sprinkler RTI values, design density (0.1 gpm/ft2 not found), how many heads typically open.
- Electricity and water interaction, steam, wet-floor behaviour, alarm-to-door-release logic.
- Heat distortion, flipbook, and decal budgets.
- Whether the mirror/search-summary claims match the live Wikipedia text.

To close these gaps, allow en.wikipedia.org, gamedeveloper.com, developer.valvesoftware.com and gdcvault.com in the session network settings and rerun.

---

## 6. Recommended simulation design **[Design, unsourced numbers are tunable starting points]**

### 6.1 Grid and layers

- Use the existing 1 m tile grid for solids and fire. Run a separate coarse-in-time gas field on the same grid (one cell per tile, no sub-tiles). A 200x100 level is 20k cells, trivial at 60 Hz.
- Fields per tile (typed arrays): `fuel` (0-255), `heat` (0-255), `fireAge` (u8), `wet` (u8), `smoke` (u8 density), `gas` (u8 flammable gas), `toxic` (u8).
- Tick rates: fire and heat at 10 Hz (every 6th frame, staggered by row); smoke and gas diffusion at 15-20 Hz; wetness at 5 Hz; AI senses read the fields each AI tick (10 Hz). Rendering interpolates.

### 6.2 Per-tile material table

| Material | Flammability | Fuel (burn seconds) | Ignition heat | Structural effect |
|---|---|---|---|---|
| Wood | high | 20-40 | low | Burns away, becomes air or rubble |
| Door (wood) | high | 15 | low | Burns through, opens path |
| Brick, concrete, steel | none | 0 | n/a | Steel softens above a heat limit (optional), concrete spalls only with explosions |
| Glass | none | 0 | n/a | Cracks above a heat limit, breaks, feeds oxygen and vents smoke |
| Dirt | none | 0 | n/a | none |
| Water | extinguishes | n/a | n/a | Sets neighbours wet |
| Props: barrel, crate, gas cylinder | per prop | per prop | per prop | See 6.5 |

### 6.3 Fire update rules (10 Hz)

1. Burning tile: `fireAge++`, `fuel -= 1`. Emit heat into itself and neighbours.
2. Heat spreads each step: up 1.0x, sideways 0.5x, down 0.2x per neighbour (heat rises). Heat decays 10% per step.
3. A flammable neighbour ignites when `heat > ignitionHeat` and `wet == 0`, with probability `p = 0.3 * flammability / (1 + fireAge/30)` per step (Minecraft-style age falloff, per section 1.1).
4. Fire dies when `fuel == 0`, when `wet > threshold`, or when local oxygen is low (many burning tiles in a closed pocket with no open neighbour to air, then fire shrinks to smouldering and produces dense smoke).
5. Burnt-out tile: wood becomes air, leaves a scorch flag for the decal. Unsupported tiles above fall using the existing destruction code.
6. Flashover: if a closed room has smoke ceiling layer heat above threshold for 3 s, every flammable tile in the room ignites at once, with a big heat and smoke burst. Backdraft: if oxygen-starved smouldering room has a door/glass opened (tile removed), inject a fireball at the opening. Both are scripted triggers, not physics.

### 6.4 Smoke and gas (15-20 Hz)

- Each step, a cell gives a fraction of its density to neighbours with a buoyancy bias: up 40%, sideways 30% each, down 0-5% (smoke only; heavy gas inverts this). Solid and closed-door tiles block; open doors, broken glass and vents pass.
- Hot smoke (near fire) rises; cooled smoke stays and spreads, which fills rooms from the ceiling down.
- Decay: screening smoke grenade lasts 60-90 s then fades over 10 s (M18 figure, section 2.2). Fire smoke decays only when vented (open vents, broken windows drain upward 2%/step).
- Smoke grenade: after about 1.5 s fuse, inject density at a fixed rate for about 20 s up to a volume cap (about 150-250 tiles at full density); flood-fill capacity prevents infinite leaking. Explosions and bullets zero density in a small radius for 1-2 s (CS2 behaviour, section 2.1).
- Two smoke kinds: `screen` (harmless) and `toxic` (fire smoke, also CO). Only toxic hurts.

### 6.5 Props and interactions

| Prop | Behaviour |
|---|---|
| Explosive barrel | Heat above limit for 3 s, or damage, then explosion: radius 3 tiles, tile damage, ignites flammables, shoves smoke, deafens nearby guards. |
| Gas cylinder | Fire exposure for about 5 s, vents a jet (flame jet) first, then BLEVE: radius scaled down from section 1.2 (about 4-5 tiles for a small cylinder), fireball. |
| Gas leak | Emits `gas`; ignites if gas > 20% and heat or spark present, burns as a fast-moving flame front (spread 4 tiles/s), explosion if confined (gas > 60%). |
| Extinguisher | 14 s total discharge for a 5 lb ABC (section 1.2), cone range 4 tiles, sets `wet` on target tiles, kills fire in the cone, releases harmless white powder smoke (blocks sight lightly). CO2 variant: range 2 tiles, no residue. |
| Sprinkler | Per-head heat sensor, opens at heat equal to the 68 C analogue. Sprays 3x3 under it, sets `wet`, suppresses fire, lowers heat. Opens only the heads that exceed the threshold (not whole system). |
| Fire alarm | Smoke detector tile triggers when local smoke > about 20% (approximates 3%/ft); alarm sets guard state to evacuate/investigate, unlocks fire doors per level rules. |
| Water and electricity | Wet tiles conduct; a live wire or breaker tile electrocutes anyone on connected wet tiles. Hot fire plus water makes steam (smoke-like, scalds: low damage). |

### 6.6 Effects on guards and the player

| Hazard | Guard | Player |
|---|---|---|
| Screen smoke | Vision ray accumulates density; cumulative density above about 0.7 blocks sight, partial raises detection time. Guards can still hear. | Same raycast; render fog. |
| Toxic smoke / fire | Coughing (moves, drops weapon-ready state), damage rising with density; flee fire; alarm if they see fire. | Cough sound, health drain at 1-3 HP/s at high density, light vignette. |
| Flashbang | See 6.7. | See 6.8. |
| Fire contact | Panic, run to water, take burn damage; avoid burning tiles in pathfinding. | Burn damage; "on fire" state until wet. |
| Explosion | Blast damage; deafened if within blast; alerted by sound. | Same, with tinnitus ramp. |
| Alarm | Search/evacuate behaviours; guards ignore stealth bodies in favour of fire. | Informational HUD cue. |

### 6.7 Flashbang on guards

- Pop at fuse of 1.5 s. Affected if within 6 tiles with line of sight to the burst; deafened by sound regardless of facing within 5 tiles through open air (walls attenuate).
- Blind duration from a CS-style angle table (section 3.2, adjusted for a side view): facing the burst 4-5 s, side 2-3 s, back 1 s. Scale by `1 - dist/6`.
- States: blind (cannot see, wanders or covers eyes), deaf (does not hear footsteps for 8-10 s), stunned (first 1 s, cannot act). Then "search" state.
- Optionally fire wildly or backpedal at random when blind.

### 6.8 Flashbang on the player

- Same angle/distance table, shorter by about 30% for comfort: full white 0.7-1.2 s, then fade over 2-3 s, afterimage ghost of the last frame for up to 3 s.
- Audio: 4-6 kHz ringing, low-pass on all audio, ringing decays over 6-8 s; keep UI audio clear. Always cap total effect at about 5 s and never block pause or input prompts.

### 6.9 Rendering plan (three.js)

- Fire: instanced billboard flipbook (8x8 atlas) per burning tile with additive blending and a small emissive tint; one `InstancedMesh`, 1-3 quads per burning tile up to a cap of about 500 active; bloom on emissive only (selective bloom via threshold).
- Embers and sparks: one `Points` or instanced quads, cap about 1,500 live particles, cheap vertex-shader motion (no CPU update).
- Smoke: render the density field to a low-resolution `DataTexture` (one texel per tile, linear filtering), draw as a fullscreen quad or a quad per room with a 3-4 tap noise-perturbed lookup, tinted by ambient light (cheap lit smoke). Use a few hundred soft sprites for foreground wisps only. Avoid ray-marching unless profiling allows it.
- Heat distortion: render-target refraction pass over fire tiles only, optional on low settings.
- Scorch: write to a per-tile decal atlas, no new draw calls.
- Flashbang: full-screen post pass: white overlay alpha, previous-frame blend texture for afterimage, desaturation, slight blur; accessible toggle to soften or disable.
- Budgets (starting targets, unverified): total transparent overdraw under 2x screen area, under 3k particles, fire and smoke sim under 0.5 ms per frame on a mid laptop.

### 6.10 Test plan

- Determinism: seed fire random with the sim RNG, step on fixed ticks.
- Scenarios to script: closed room flashover, door-opened backdraft, sprinkler containment, barrel chain reaction, smoke screening a guard's patrol line, flashbang with guards facing and facing away.
