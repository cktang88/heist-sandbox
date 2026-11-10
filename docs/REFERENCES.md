# Design references

Research notes that the level, AI and art work is built from. Gathered from web search summaries only (full pages could not be opened), so treat sources as leads. Items marked *(suggested)* are our own starting values, not sourced.

The owner's own image links (two Reddit images of cyberpunk side-scrollers and one share.google link) could not be fetched from the build environment. Direction given in words: grungy cyberpunk, Intravenous 2/3 and Cyberpunk 2077 interiors, day or night, "super detailed and lived-in, not bare bones".

## 1. Making a cutaway room feel lived-in

1. Three layers per room: dark silhouetted props in front, the play lane in the middle, a lit wall or window behind. https://garagefarm.net/blog/environment-design-principles-for-building-immersive-worlds
2. One or two hero props per room (server rack, bunk, serving counter), then many small items. Roughly 40% effort on hero pieces, 60% on dressing. (same source)
3. Pack small spaces densely: tight ceilings, clustered machinery, loose trash, papers, tools. https://80.lv/articles/creating-a-gritty-industrial-cyberpunk-2077-inspired-room-in-ue5
4. Show wear: rust, stickers, scuffs, stains. Subtle beats obvious.
5. At most three "story" elements per room so it stays readable.
6. Avoid visible repeats; vary clutter per room. Night City is dense with signage, ads, graffiti. https://80.lv/articles/interview-how-cyberpunk-2077-s-night-city-was-built-almost-entirely-by-hand/ (Counterpoint: PC Gamer calls its clutter generic, "one house's worth spread across a city".)
7. Motivated, harsh light: flickering fluorescents, neon tubes, cables across the floor.
8. Every cutaway room needs a visible light source.
9. Rooms should read as systems the player can use: Intravenous 2 lists sneaking through shadows, tampering with lights, lockpicking. https://store.steampowered.com/app/2608270
10. Connect inside to outside: windows, signs, vents.

### Palette *(suggested)*

| Use | Colours |
|---|---|
| Walls | `#2a2f36` painted concrete, `#3a3f44` stained panel, `#1c2026` dark steel, `#5a4a3c` rust |
| Floors | `#23262b` worn tile, `#14161a` grating, `#3b2f2a` stained carpet |
| Trim | `#4b5560` pipes, `#8a7a3a` hazard stripe, `#6b6f73` cable sleeves |
| Neon | `#ff2d95` magenta, `#00e5ff` cyan, `#ffb000` amber, `#7cff4f` toxic green, `#ff3b30` alarm red, `#8a5cff` violet |
| Light | sodium `#ffb347` and cold fluorescent `#cfe8ff`, mixed in one room |

### Detail checklist

- **Walls:** dado rail with darker lower band, pipe and conduit runs on brackets, vent grilles, fuse box with hanging cover, light switch plates, posters and torn ads, graffiti, neon signs (one dead letter), wall screens, camera dome with red LED, exit sign, rust streaks, water stains, hazard stripes, stencilled room numbers, wall AC unit with drip stain, intercom, keypad and card reader, fire extinguisher, notice board, flickering strip light, peeling paint, bullet holes, window with blinds and neon spill.
- **Ceiling:** sagging cable bundles, exposed ducts, fluorescent tubes (one half-dead), dangling wires, sprinkler heads, smoke detector, lamp on a cord, dripping steam pipe, cable trays, loudspeaker, hazard-painted beam.
- **Floor:** loose cables, puddles, scattered paper, takeaway boxes, grating, drains, oil stains, rugs, crates and barrels, mop bucket, cardboard stack, wet-floor sign, cleaning robot, overflowing bin, cable reels, tape lines.
- **Surfaces:** crowded desk with monitor, mugs, cup noodles, book and paper stacks, keyboard, sticky notes, scrolling terminals, ashtray, half-dead plant, blinking server racks, flickering vending machine, water cooler, coffee machine, locker row, bunk bed, toolbox and tool wall, medical chair.
- **Exterior:** billboards, stacked rooftop AC units, antenna clusters, exterior pipes, fire escape, lit window grids, steam vents, searchlight, satellite dishes, sagging power lines, rain streaks, neon spill, distant megabuilding silhouettes.

## 2. What is in real rooms, and how they are lit

General knowledge, not sourced. Colour temperature in Kelvin: lower is warmer.

| Room | Typical contents | Lighting | Finish |
|---|---|---|---|
| Lobby / reception | curved desk, logo wall, sofas, coffee table, plants, turnstiles, kiosk, wall screen, rug | recessed downlights, LED cove strip, pendants, 3000K | stone or terrazzo, panelled or glass walls |
| Open office | desk clusters, monitors, task chairs, partitions, filing cabinets, printer, whiteboard, bins, plants, clock | ceiling panels 4000K, monitor glow | carpet tile, painted wall, grid ceiling |
| Executive office | large desk, leather chair, bookshelves, sofa, desk lamp, awards, drinks cabinet, blinds | desk and floor lamps 2700K, downlights 3000K | wood floor, rug, panelling |
| Conference | long table, chairs, wall screen, speakerphone, whiteboard, projector | dimmable downlights 3500-4000K | carpet, acoustic panels |
| Break room | fridge, microwave, coffee machine, sink, table, vending machine, noticeboard | panel 4000K, vending glow | vinyl, tile splashback |
| Cafeteria / kitchen | trays, serving counter, steel tables, hoods, fryers, racks, dish area | LED battens 4000-5000K | quarry tile, stainless |
| Restroom | stalls, sinks, mirror, hand dryer, dispenser, bin | 3500-4000K, strip over mirror | tile |
| Locker room | benches, lockers, drain, towels, shower stalls | sealed LED 4000K | tile, painted block |
| Barracks | bunks, footlockers, wall lockers, boots, notice board, fan, laundry | tube batten 4000K, dim red night light | vinyl or concrete |
| Rec room | sofas, TV, pool table, table tennis, vending machine, bookshelf, posters | floor lamps 2700K, TV glow, neon sign | carpet, wood panel |
| Gym | racks, benches, treadmills, mirrors, dumbbells, mats | linear LED 4000-5000K | rubber floor |
| Infirmary | beds, curtains, IV stands, monitors, cabinet, sink, trolley, exam light | panels 4000K, 6500K exam spot | sheet vinyl |
| Laboratory | benches, fume hood, microscope, centrifuge, sinks, shelving, eyewash, gas cylinders | panels 4000-5000K | epoxy floor |
| Server room | racks, cable trays, cooling units, raised floor, fire panel, console cart | 5000K+, often off, status LEDs | raised tile floor |
| Security control | console desks, monitor wall, chairs, radio, key box, logbook | dim indirect 3500-4000K, monitor glow | carpet, matte walls |
| Armoury | weapon racks, cages, ammo lockers, cleaning bench, sign-out desk | caged battens 4000K | concrete, steel mesh |
| Holding cells | steel bench, toilet, bars, camera, intercom | recessed vandal-proof 4000K | concrete |
| Archive | shelving, boxes, rolling stacks, ladder, trolley | sparse battens 4000K | concrete |
| Janitor closet | mop sink, bucket, mops, shelves, chemicals, vacuum | one bare bulb | concrete |
| Mechanical plant | boilers, pumps, pipes, ducts, valves, gauges, tanks | sparse industrial 4000K, dark corners | concrete |
| Electrical / generator | switchgear, transformers, generator, panels, hazard signs | caged LED 4000K, red beacons | concrete, yellow markings |
| Loading dock | dock doors, pallets, forklifts, racking, cages, bollards | high-bay 5000K, yellow dock lights | sealed concrete |
| Parking garage | columns, lines, signs, ramps, pipes, cars, bollards | linear LED ~3500K, dim | bare concrete |
| Stairwell | handrails, floor numbers, fire door, emergency light, extinguisher | batten ~4000K, green exit sign | concrete |
| Elevator lobby | call buttons, indicator, directory, bench, plant | downlights 3000-4000K | stone, metal doors |
| Rooftop | HVAC units, antennas, water tank, helipad, vents | red beacons, helipad lights, floods | membrane |
| Vault | heavy door, deposit boxes, trolley, keypad, camera | flat white 4000K | steel, concrete |
| Penthouse | sofa, bar, piano, art, rugs, plants, TV, glass wall, fireplace | layered 2200-2700K, city glow | wood, marble |

### Lighting rules

- Layer ambient, task and accent light; accent about 3x ambient to read. https://www.studiomatrx.org/guides/apartment-lighting-planning-guide
- Living and sleeping areas 2700-3000K; kitchens, bathrooms and work areas 3500-4500K. https://waclighting.com/blog/led-light-color-temperature-guide/
- Control rooms use dim indirect light and matte surfaces. https://www.homestyler.com/article/designing-efficient-surveillance-control-rooms
- *(suggested)* Mix two or three colour temperatures per room, leave dark corners and pools of light, add one failing tube, and use coloured accents from screens, vending machines, neon and exit signs.

### Building cross-section

- Office floor-to-floor is 12-14 ft: about a 9 ft ceiling plus a 1.5-3 ft void for ducts, pipes, sprinklers and cables. https://www.wbdg.org/FFC/GSA/gsa_usc_shell_office.pdf
- Elevators have a pit at the bottom, overrun above the top stop and a machine room above the shaft.

### Perimeter

- Fence at least 7 ft, topped with a 45-degree outrigger and three strands of barbed wire. https://open-exam-prep.com/study-guides/asis-cpp/physical-security/perimeter-lighting-cpted
- Floodlights shine outward at intruders. Fences only delay, so add CCTV poles and patrols. Gatehouses, guard towers and razor coil are common.

## 3. Security force behaviour

### Guard states *(timings suggested)*

| State | Behaviour |
|---|---|
| Patrol / post | follows a route or holds a station |
| Noticed | awareness meter fills (faster when close); pauses, faces it, says "Huh?"; 0.5-1.5 s |
| Investigate | walks to the spot, looks around 4-8 s, says "Nothing" and resumes; radios it in if evidence is solid (body, forced door, gunshot), 3-5 s to make the call, interruptible |
| Search | goes to the last known position, then fans out in pairs to nearby rooms for 20-45 s |
| Combat | fights with squad roles; if contact is lost, chases to the last known position, then searches |
| Caution | 60-120 s of heightened patrol after combat |
| Stand down | dispatcher calls all clear; some changes persist |

### Comms and escalation

- Knowledge is local until reported: a radio call, a shout within about 10 m, or the camera room seeing it.
- A dispatcher in the security room holds the one shared "intruder known / last known position" record.
- Guards check in every 45-90 s on a staggered schedule. A missed check-in is polled after 10 s, then a pair is sent to that guard's post.
- Player options: jam or cut comms (which itself prompts a physical check), or take out the camera operator.

| Site alert | What changes |
|---|---|
| 0 Normal | routes and posts, camera room active |
| 1 Unease | nearby guards investigate, one extra patrol |
| 2 Intruder suspected | floor search, elevators held, posts doubled |
| 3 Confirmed | response team deploys, floors sealed, flashbangs |
| 4 Lockdown | doors locked, elevators frozen, floor-by-floor sweep |

Levels decay slowly without contact and never fully reset.

### Behaviours that read as competence

1. Barks that explain intent: "if the AI didn't say it, it didn't happen" (F.E.A.R.). https://www.oreilly.com/library/view/game-ai-pro/9781482254792/K23980_C002.xhtml
2. A visible last known position and search around it (Splinter Cell Blacklist).
3. Cover-to-cover advance that reads as flanking (F.E.A.R.).
4. Reacting to missing colleagues and bodies (Hitman). https://www.gamedeveloper.com/design/the-ai-of-hitman-2016-
5. Radio call-ins the player can interrupt (Metal Gear Solid V).
6. Lasting adaptation after a raid.
7. Searching in pairs, unsearched areas first (The Last of Us).
8. Investigating disturbances instead of instant detection.
9. Attack tokens so not everyone rushes at once.

### Fairness rules

- Show what guards can see and a state icon above each head. https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules
- Grace period before detection; always bark at least a second before escalating.
- Patrols predictable in structure, varied in timing.
- Being spotted leads to search or combat, never instant failure.
- Guards act on the last known position, never the player's true position.

## 4. Earlier research this project already uses

- Gun feel: bigger tracers, muzzle flash, spread shown on the crosshair, shake scaled to impact.
- Realism: tone mapping, image-based lighting, textured physically based materials, few motivated lights, shadows, bloom on bright things, depth layering.
- Assets: see `public/textures/LICENSE.md`.
