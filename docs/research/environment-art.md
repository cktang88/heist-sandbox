# Environment Art Reference: lived-in cyberpunk megacomplex (2.5D side view)

Status: second pass. Pages were opened with curl/pandoc (not search snippets) unless listed under "Snippet-only" or "Could not verify". Where a rule below is my own design inference, it is marked **[inference]**. All hex values are **proposals** (nothing in the sources gives hex codes).

## 0. Corrections to the earlier pass

| Earlier claim | What the actual page says | Source |
|---|---|---|
| RawConcrete is "photo-textured brick" | The developer states the graphics are "entirely hand drawn, no downscaling of photos, no photobashing or anything of the sort (we tried, doesn't work in practice, too many problems)". Treat it as hand-painted photorealism, not photo collage. | S1 |
| RawConcrete thread explains layering/lighting/pixelation/parallax | The thread has 13 posts. The dev post gives no layering, shader or parallax detail. Only comments: realism-paced walking, 90s-and-later film mood as reference, the "level artist is quite skilled". Technique detail is NOT in this thread. | S1 (via `/753551.json`) |
| Intravenous is a side-view reference | Intravenous 3 is explicitly "a top-down action game" and Intravenous 1/2 are described as "A LOVE LETTER TO EARLY SPLINTER CELL GAMES", reviewers call it top-down. Use it for stealth/light *systems*, not for side-view composition. | S2, S3, S4, S17 |
| Silo/data-centre/barracks architecture facts | Not verified from opened pages (see section 9). | - |

## 1. Source list (opened and read)

| ID | URL | What it gave |
|---|---|---|
| S1 | https://discussions.unity.com/t/wip-highly-photorealistic-pixelated-2d-3d-side-scroller-called-rawconcrete-update-10/753551 (JSON: append `.json`) | Hand-drawn, no photobashing; film-mood reference; realistic walk pace |
| S2 | https://store.steampowered.com/app/1486630/Intravenous/ (via `/api/appdetails?appids=1486630`) | Light-based visibility, shoot out lights, circuit breakers, vents, lockpick, bottles, flashlights |
| S3 | https://store.steampowered.com/app/2608270/Intravenous_2/ | "Sneak through shadows, tamper with lights, lockpick doors"; reactive AI |
| S4 | https://store.steampowered.com/app/4383190 | Intravenous 3: top-down, AI reacts to sound and movement, guards key areas together |
| S5 | https://80.lv/articles/making-locations-for-cyberpunk-2077 | Treehouse Ninjas pipeline; four styles; POV hierarchy; day/night constraint |
| S6 | https://80.lv/articles/creating-lighting-and-environments-for-cyberpunk-2077/ | Micro-stories, kitbashing, lighting NPC visibility, broad/mid/high frequency detail |
| S7 | https://80.lv/articles/interview-how-cyberpunk-2077-s-night-city-was-built-almost-entirely-by-hand/ | CDPR art directors: rule of contrast, controlled chaos, noise problem and Phantom Liberty guidelines |
| S8 | https://www.rpgsite.net/interview/8896-cyberpunk-2077-interview-exploring-the-environment-with-senior-concept-artist-marthe-jonkers | The four styles and time layers; Watson district history |
| S9 | https://80.lv/articles/see-how-level-design-lighting-helped-make-the-last-of-us-more-immersive | Yellow/red accents for interactables; cold light = danger, dark = safe path |
| S10 | https://80.lv/articles/how-naughty-dog-created-the-immersive-world-of-the-last-of-us-part-ii | Painted ambient shadows; interior lighting via area lights outside windows; storytelling puzzle; edge-wear/dirt generators with grunge masks |
| S11 | https://blog.playdead.com/articles/the_lighting_of_inside/lighting_of_inside.html | Hand-placed decals for bounce/spec/rim/AO/shadow; side-scroller fixed camera enables targeted fidelity |
| S12 | https://80.lv/articles/environment-storytelling-in-dishonored-2/ | Object wear stories; dust decals marking removed paintings; effort only where visible |
| S13 | https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules | Binary light/dark; character as light gem; encounter space = screen + 0.5-0.75 screen |
| S14 | https://80.lv/articles/the-last-night-pixel-art-cyberpunk-open-world | Pixel-art cyberpunk: 3D low-poly with pixel-art textures under a fixed platformer camera |
| S15 | https://80.lv/articles/this-war-of-mine-a-game-about-civilians-in-war | Side view chosen to show multi-storey buildings; everything 3D, far background flat; sepia/hand-drawn look |
| S16 | https://gamedeveloper.com/design/writings-on-the-wall-sharing-accessible-narratives-through-environmental-design | Environmental narrative must not rely on text alone |
| S17 | Steam/GOG reviewer text via search (https://www.gog.com/en/game/intravenous) | Reviews: doors frustrate; AI does not always re-light. Snippet-level |

## 2. Fifteen principles

| # | Principle | Evidence |
|---|---|---|
| 1 | **Layer time, not just objects.** Every space should show several eras (original build, patch jobs, current tenant). Night City encodes four chronological styles (entropy, kitsch, neomilitarism, neokitsch). | S7, S8 |
| 2 | **Use a contrast rule.** Put one deliberate incongruity per area (a crashed AV through a normal house). It grounds the world. | S7 |
| 3 | **Controlled chaos, not noise.** CDPR admits some areas became too noisy and later wrote guidelines to group colours, shapes, details and keep negative space where the eye rests. | S7, S6 |
| 4 | **Distribute detail by frequency**: broad, mid, high; leave resting areas. | S6 |
| 5 | **Every dressing choice is a micro-story** (broken glass, half-finished painting, disassembled vehicle). | S6, S12 |
| 6 | **Wear tells use.** Dust decals where paintings hung, moisture-weakened fabric, torn wallpaper edges. | S12 |
| 7 | **Spend detail only where it is seen**; hidden parts get quick recipes. | S12 |
| 8 | **Kitbash a library into prefabs** to get unique-looking rooms cheaply; avoid recognisable repetition. | S6 |
| 9 | **Light must be motivated and justified**, and must survive 24h and every path. For a fixed-time game, light each room for both day and night variants. | S5, S6 |
| 10 | **Light is gameplay**: cold searchlight = danger, dark = safe route; binary light/dark makes stealth readable. | S9, S13, S2 |
| 11 | **Keep actors readable.** NPCs must not fall into darkness; clear visibility with dramatic contrast, never flatten with fill. | S6 |
| 12 | **Accent colour marks interactables** (yellow/red), so decoration can be dense without hiding gameplay. | S9 |
| 13 | **Fixed camera permits targeted fidelity**: hand-place bounce, rim, AO and shadow decals where the camera sees them. | S11 |
| 14 | **Dressing must not break gameplay**: a dumpster in the wrong spot blocks NPC paths; clear clutter near interaction zones. | S6, S10 |
| 15 | **Narrative must be legible without text**; do not rely on a written scrawl alone. | S16 |

Extra, from side-view design: keep an encounter space to about one screen plus 0.5-0.75 screen in any direction; larger 2D spaces make players feel lost (S13). Side view was chosen in This War of Mine specifically to show people living in a multi-storey building (S15), which matches a cutaway tower.

## 3. Room-by-room dressing guide (28 room types)

Legend: values are **[inference]** composites built from the principles above and general real-world plausibility; the sources supply the principles (wear, micro-story, motivated light), not these specific prop lists. "Story" is one vignette each.

| # | Room | Hero props | Medium props | Small clutter | Wall | Floor | Ceiling | Lighting | Story vignette |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Ground lobby | Reception desk with logo wall, turnstiles, scanner arch | Potted plants, security podium, bench, directory board | Visitor badges, lanyards, umbrella stand, coffee cups | Polished stone panels, logo, scuffs at hip height | Polished tile with scuff lanes and mop-wet patch | Coffered with recessed strips, one dead tile | Cool white downlights, red turnstile LEDs | Cleaner's wet-floor sign beside a bullet-chipped panel nobody replaced |
| 2 | Security checkpoint | Metal detector, X-ray belt, glass booth | Lockers, bins, camera monitors | Plastic trays, confiscated lighters, taped notices | Painted block with yellow safety lines | Rubber-tread, hazard tape | Exposed conduit, dome cams | Hard fluorescent, amber alarm beacon | Booth radio plays a match; guard's chair turned away from monitor |
| 3 | Open-plan office | Rows of desks with CRT/flat monitors, cubicle walls | Printers, water cooler, filing cabinets, whiteboard | Mugs, sticky notes, plants, cables, cardboard boxes | Partition fabric with pinned notices, ceiling stains | Carpet tiles, worn paths to coffee | Drop tiles, a few missing, exposed ducts | Cold strip lights, monitor glow; half of rows off at night | One desk with family photo and cold noodles, owner gone |
| 4 | Executive suite | Huge desk, city window, display cabinet | Sofa, bar cart, holo-frame | Cigars, paper stack, tablet | Wood veneer, dark fabric, corporate art | Dark wood or carpet, rug | Cove lighting, acoustic panels | Warm lamp, neon spill through glass | Expensive art leaning unhung; shredder jammed |
| 5 | Server / data hall | Server racks in rows, cooling units, UPS | Cable trays, patch panels, hot/cold aisle doors | Labels, spare drives, tag lanyards, fan dust | Painted steel, cable ladders | Raised floor tiles, some lifted | Overhead cable trays, sprinklers | Blue/green status LEDs, cold white aisle strips | A lifted floor tile exposing sleeping cables and a lunchbox |
| 6 | Network closet | Rack, router stack | Ladder, spare cables | Labels, zip ties, dust | Bare block | Concrete | Low, conduit | Single bare tube, LED blink | Taped note "DO NOT UNPLUG - ASK DAVE" |
| 7 | Mechanical plant floor | Chillers, boilers, big AHUs | Pipes with valves, pumps, control panel | Gauges, tool bag, warning labels, drip bucket | Pipe racks, painted pipe bands, stains | Painted concrete, drain, puddles | Dense duct and pipe runs | Orange work lamps, steam backlight | Mop bucket under a leaking valve with a growing rust streak |
| 8 | Electrical substation / switchgear | Switchgear cabinets, transformers | Cable risers, breaker panels | Padlocks, tags, hazard signs | Concrete, warning stripes | Rubber matting, drain | Busbar trunking | Red indicator lamps, one failing flicker | Lockout tags from a maintenance shift never removed |
| 9 | Stairwell | Landing doors, fire hose cabinet | Handrails, signs, extinguisher | Cigarette butts, graffiti, flyers | Painted block with floor numbers | Concrete treads, worn nosing | Pipe along ceiling | Green exit sign, caged bulb | Smokers' corner on a landing with a stolen chair |
| 10 | Corridor | Doors with plates, security cam | Fire extinguisher, notice board, vending alcove | Dropped papers, trolley, scuffs | Dado stripe, door frames, scuffs | Vinyl with wheel marks | Strip lights, vent grille | Pooled light, flicker bay | One door taped over with police tape |
| 11 | Elevator lobby / core | Elevator doors, indicator panel | Call panel, directory | Gum, scratches, ad poster | Steel plates, mirrors | Stone | Downlights | Cool light, amber floor indicator | Service lift with a hand-written "OUT OF ORDER" |
| 12 | Break room / canteen | Vending machines, microwave, tables | Fridge, notice board, sink | Cups, crumbs, takeaway boxes | Cheap tile, calendar | Sticky lino | Tile ceiling stain | Warm tube, vending glow | Fridge note "WHO TOOK MY LUNCH" |
| 13 | Restroom | Stall row, sinks, hand dryer | Mirror, bin, mop cupboard | Paper towels, graffiti | White tile, grout dirt | Tile with puddle | Vent | Cold flickering strip | Graffiti naming a guard captain |
| 14 | Armoury | Weapon racks, cage door, ammo shelves | Cleaning bench, lockers | Casings, oil rags, sign-out clipboard | Painted block, pegboard | Concrete | Caged lamps | Single hard white | Sign-out sheet with a name crossed out |
| 15 | Barracks | Bunk beds, lockers, table | Footlockers, boot rack, TV | Magazines, socks, cards, energy cans | Pin-ups, schedules | Lino, mud trails | Pipes, fan | Warm bunk lamps, TV flicker | One bunk made hospital-neat; the rest chaos |
| 16 | Guard post / control room | Monitor wall, console, chair | Radio, kettle, schedule board | Cups, cables, comics | Pinned maps, cabling | Worn carpet | Drop ceiling | Monitor glow, desk lamp | Guard asleep, one monitor paused on a game |
| 17 | Lab | Bench, fume hood, sample fridge | Centrifuge, cabinets, hazard bins | Test tubes, labels, gloves | White tile, biohazard signs | Chemical-resistant floor, spill | Fume duct | Cool white, UV spot | Sealed case with a broken seal |
| 18 | Ripperdoc / medical clinic | Surgery chair, cyberware shelf, diagnostic screen | Instrument trolley, cooler | Blood-stained gauze, wires, parts | Mismatched tile, posters of implants | Stained lino | Surgical lamp | Pink-magenta neon, hard task lamp | Half-built arm on the table beside a customer's coat |
| 19 | Warehouse / cargo | Shelving, pallet racks, forklift | Crates, barrels, trolleys | Strapping, labels, wrap | Corrugated steel, numbers | Painted lanes, oil stains | Roof trusses, hanging lights | Sodium pools, dark aisles | Pallet with one crate opened and re-sealed |
| 20 | Loading dock | Truck bay, roller shutters, dock leveller | Forklift, bollards | Straps, pallets, trash | Bumper rubber, hazard paint | Oil-stained concrete | Rails, fans | Floods, truck headlights | Driver asleep in cab, engine running |
| 21 | Parking structure | Cars, ticket barrier, pillars | Bays, signs, dumpsters | Oil, cones, receipts | Painted pillars, level numbers | Marked concrete, drains | Ducts, sprinkler pipes, lamps | Sparse tubes, one flicker | Car alarm cycling in empty level |
| 22 | Kitchen / canteen back | Range, extractor, cold room | Trolleys, sinks, shelves | Pots, rags, grease | Steel, tile | Wet tile, mat | Extractor hood | Warm bright, steam | Staff meal on a counter abandoned mid-bite |
| 23 | Maintenance / janitor | Sink, shelves, mop cart | Chemicals, ladders | Rags, wires | Pegboard | Stained | Pipe | Bare bulb | A hidden bunk and radio |
| 24 | Vent / duct crawl | Duct, fans | Grille, junction | Dust, rats | Metal | Ribbed metal | - | Slatted light | Nest of foil wrappers |
| 25 | Rooftop | AC units, antennas, water tank | Pipes, satellite dishes | Cables, cigarette tins | Parapet | Tar, puddles | Sky | Sign glow | Lone chair facing the skyline |
| 26 | Storage silo interior | Hopper, conveyor, catwalk | Ladders, gauges | Dust, spillage | Curved concrete or steel | Grating | Funnel top | Shafts, caged lamps | Dust-covered footprints loop |
| 27 | Sewer | Pipe mouths, grating, walkway | Valves, ladders | Rats, litter, graffiti | Wet brick, slime | Shallow water | Vault | Green drips, one torch | Shopping trolley shrine |
| 28 | Perimeter gatehouse | Barrier, booth, spotlight | Kennel, sign, cam | Cups, leaflets | Corrugated, cage | Painted concrete | Roof overhang | Floodlight cone, red lamp | Guard dog bowl beside empty chair |

Reality checks on real architecture: mechanical floors are typically reached only by service lifts, need perimeter louvers (no glass), and a rule of thumb is about one per 10 tenant floors (search-result text from Wikipedia "Mechanical floor", snippet-level; see section 9).

## 4. Facade and exterior guide

From the references (the owner's, not opened images) plus principles:

- **Facade layers:** (1) base wall with discolouration and stains, (2) windows with mixed states (lit, dark, blinds, taped), (3) balconies with plants, laundry, AC units, (4) signage and neon, (5) cables and pipes crossing the face, (6) water stains under ledges. **[inference]**
- **Rule of time layers:** mix at least two building eras on one facade (S7, S8).
- **Contrast rule:** one incongruity per block (S7).
- **Signage system:** vertical neon on the edge, horizontal shop signs at street level, a corp logo high up, hand-painted overlay; keep sign colours to two per block (readability, S7).
- **Detail frequency:** broad (block shapes, towers), mid (balconies, AC), fine (cables, stickers); leave plain wall areas as rest (S6, S7).
- **Perimeter:** double fence, razor wire, floodlight cones in fog, guard towers, signs, power lines, kennel, rain and puddle reflections **[inference]**.
- **Tower:** podium, shaft, mechanical floors every ~10th floor (snippet source), crown with antennas and beacons.
- **Annex and silos:** corrugated, rust streaks, pipework, catwalks, floodlights.
- **Walkable vs backdrop:** apply full detail only on the playable plane; background gets silhouette plus window lights.

## 5. Foreground / background layering for a 2.5D camera

Evidence: This War of Mine is fully 3D under a side camera with the far background flat (S15); The Last Night uses 3D low-poly with pixel-art textures (S14); INSIDE hand-places decals precisely because the camera is fixed (S11). Recommended stack **[inference]**:

| Layer | Depth | Content | Treatment |
|---|---|---|---|
| F2 | very near | Fence wire, rain streaks, hanging cables, pipes | Heavy blur, dark, 10-20% screen, low contrast |
| F1 | near | Pillars, plants, lamp posts occluders | Dark silhouette, rim light only |
| Play | 0 | Floor, walls, props, characters | Highest detail, accent colour for interactables (S9) |
| M1 | behind wall | Back-room silhouettes, signage, windows | Mid contrast, tinted fog |
| M2 | distance | Annex, silos, tower | Silhouette, window dots |
| B | far | Skyline, sky, mist | Flat, gradient, haze |

Rules: hand-place bounce/rim/shadow decals on the play plane (S11); keep actors lit (S6); cutaway fourth wall: show interior as a lit box with a darker outer wall thickness and a rim to read as a cutaway (S15 side-view logic).

## 6. Colour scripts (proposed hex values)

Night (main):

| Role | Hex |
|---|---|
| Sky top | #0b0f1e |
| Sky horizon haze | #2a1d3f |
| Distant tower silhouette | #141a2e |
| Concrete mid | #3a3f4d |
| Concrete lit | #6b7280 |
| Neon magenta | #ff2d95 |
| Neon cyan | #19e3ff |
| Warm window | #ffb347 |
| Sodium lamp | #ff9a2e |
| Alarm red | #ff3b30 |
| Safe-interactable accent | #ffd60a |
| Rain reflection | #3a86ff |

Day (overcast industrial):

| Role | Hex |
|---|---|
| Sky | #8f9aa6 |
| Haze | #b9c0c7 |
| Concrete | #7d8288 |
| Rust | #8a4b2d |
| Window dark | #2b3340 |
| Billboard accent | #e0533a |
| Foliage | #4f6b45 |

Dusk (sky, per references): #1d1b3a, #6a3d7a, #e07a4f, with warm window #ffc266.

## 7. Intravenous: lighting-as-stealth takeaways

- Visibility depends on how well-lit the environment is, and steps make noise (S2).
- Interaction set: shoot lights out, vents, circuit breakers, lockpick doors, throw bottles, shoot door locks (S2, S3).
- Enemies use flashlights in darkness, radio suspicious activity, take cover (S2); Intravenous 3: coordinate and guard key areas (S4).
- Reviewer caveats: many doors, AI does not always re-light (S17, snippet-level).
- Dressing implication: each room needs a visible light source and a switch/breaker fiction that the player can read at a glance **[inference]**.

## 8. Anti "empty concrete" checklist

1. Every room has at least one hero prop, three medium props and a dozen small ones.
2. Every wall has a stain, a notice or a service item.
3. Every ceiling has a service run (duct, tray, pipe).
4. Every floor has traffic wear.
5. Each room has a story vignette.
6. Each room has a motivated light source and a second colour.
7. Add signage and wayfinding (numbers, arrows, stencils).
8. Add human traces (cups, coats, notes).
9. Group props into clusters with negative space between.
10. Keep an accent colour reserved for interactables.

## 9. Could not verify

- RawConcrete: layering, shader, pixelation, parallax and lighting methods are not in the forum thread; possibly in its video, devlogs or other threads (not found).
- Intravenous 2 level descriptions, room types and devlogs by Explosive Squat Games: no devlog opened. Only Steam text and reviewer snippets.
- Wikipedia "Mechanical floor" (the 1-in-10 rule and louvers): the page was opened but my extraction returned only navigation text; the claim comes from search-result text. Treat as unverified.
- Real architecture for data centres, barracks, silos, tank farms, parking and perimeter security: not read. Table entries are general knowledge.
- Katana ZERO, Huntdown, Sanabi, Deadbolt, Gunpoint, Little Nightmares, Shadow Complex, The Swindle, Door Kickers: Action Squad, Replaced: no page opened. Replaced and Katana ZERO are from search-result text only.
- Mark of the Ninja postmortem (jikguard) opened but its content was not extracted (page returned site chrome); S13 is the verified source.
- IO Interactive and other Arkane talks, GDC talks on prop clustering: not opened. Naughty Dog "prop clustering" is not directly sourced.
- Cyberpunk 2077 neon/signage/vending/cabling specifics and Arasaka/Konpeki/ripperdoc breakdowns: ArtStation returned 403 and cyberpunk.fandom 403; not opened.
- All hex values and room props are design proposals, not extracted data.
