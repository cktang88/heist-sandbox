# Cyberpunk 2077: environment, lighting, stealth and hacking reference

Research date: 2026-11-10. Purpose: reference for a side-view (2.5D) browser infiltration game (three.js), grungy cyberpunk, day or night.

How to read this file. Every claim carries a source URL. Labels used:
- **[READ]** I opened the page and read the text.
- **[READ-PARTIAL]** I opened it but only part of it was readable (page size limit or dynamic content).
- **[SNIPPET]** I saw it only in a search-result snippet, not on the page.
- **[VIEWED]** I downloaded the image and looked at it (resized) to describe it.
- Anything I could not confirm is in section 12.

Numbers quoted for quickhacks come from a community wiki (Fextralife) that was last edited in September 2026 and reflects the 2.x patch era. They are patch-dependent and are not official CDPR statements.

---

## 1. The four visual "styles" (the backbone of the art direction)

Primary sources: Jakub Knapik (VP, Global Art Director) and Kacper Niepokolczycki (Environment Art Director) in an 80.lv interview [READ] https://80.lv/articles/interview-how-cyberpunk-2077-s-night-city-was-built-almost-entirely-by-hand/ ; Marthe Jonkers (Senior Concept Artist) at Gamescom 2019 in RPG Site [READ] https://www.rpgsite.net/interview/8896-cyberpunk-2077-interview-exploring-the-environment-with-senior-concept-artist-marthe-jonkers and Gamereactor [READ-PARTIAL] https://www.gamereactor.eu/cities-of-the-future-art-design-in-cyberpunk-2077/ ; the in-game lore text of the official artbook, as transcribed by a community design wiki that credits the Digital Dragons 2022 talk "Creating diverse dystopian Cyberpunk 2077 Night City" (I did not watch the video; I read the wiki transcription) [READ] https://game-design-research.gitbook.io/cyberpunk-2077-design-wiki/cyberpunk-design-resources/style/entropism (sibling pages: .../kitsch, .../neo-militarism, .../neo-kitsch).

**Key idea.** The styles are time layers, not district themes. The art directors spent more than a week on an offsite organising them into a chronology of the city's history, then every district is a different mix of layers plus its own colour coding (80.lv interview above). Jonkers: seeing a bright yellow building with very rounded windows tells you it is Kitsch, "so you kind of know how old the building is and you know who built it" (RPG Site above). Watson is the worked example: destroyed by an earthquake and rebuilt, so Entropism buildings carry Kitsch layers on top (RPG Site above).

| Style (chronological order) | Meaning and catchphrase | Look: shapes, materials, colour | Where it shows up | Source |
|---|---|---|---|---|
| 1. Entropism | "Necessity over style". Style of poverty after the Fourth Corporate War; crude, ugly, durable. Knapik: "bleached, 80s-inspired entropy, our take on retro Cyberpunk" | Practical, almost no decoration; subdued palettes; harsh angles; very cheap materials (Jonkers) | Neglected parts of the city; vintage examples still in use | design wiki entropism page; 80.lv; RPG Site |
| 2. Kitsch | "Style over substance". Lingua franca of the street; spread with braindance culture and cyberware as display | Colourful, eye-catching, garish; rounded angles and softer shapes (Jonkers). Knapik: "almost naive, 60s-inspired, vibrant, yet very plasticky" | Every neighbourhood, especially recreation and entertainment | design wiki kitsch page; 80.lv; RPG Site |
| 3. Neomilitarism | "Substance over style". Corporate, forceful, functional, high quality; cold, threatening elegance, formal, visible militaristic accents | Knapik: "very corporate, intimidating, power-projecting, and utilitarian"; chrome, black and graphite is how the neo-kitsch page describes the corporate overclass palette | Wealthier parts, corporate zones, business districts; Arasaka and Militech aesthetics | design wiki neo-militarism page; 80.lv |
| 4. Neokitsch | "Style and substance". Ultra-rich (the 0.1%); luxury as forceful display | Gold, silver, platinum; real wood, ivory, natural furs; Knapik: "fake, pseudo-natural shape-driven". Jonkers: animal print or wood panelling signals extreme wealth because animals are extinct | Celebrity, braindance-star, magnate and CEO spaces | design wiki neo-kitsch page; 80.lv; RPG Site |

**Rule of contrast.** Niepokolczycki: the team put contrast "in either architecture, storytelling, or vistas almost everywhere". Example: a regular-looking house in Rancho Coronado with an aerial vehicle crashed through its roof and NCPD investigating (80.lv interview above).

**World-building toolset per district.** Some districts residential and dirty, some shaped by Japanese corporate expansion (Japantown), some on the shore with industrial warehouses and harbours (80.lv interview above). Concept artists used lore from Mike Pondsmith's Cyberpunk 2020 as a base for district personalities; each district has "its own personality" and was designed to be recognisable by fashion, building style and NPC personality [READ] https://gamingbolt.com/cyberpunk-2077s-districts-have-their-own-distinct-visual-style (quotes Jonkers from VG24/7).

## 2. Districts: what I could and could not confirm

What the sources actually say:

- **City Center.** "Night City's corporate showcase. Sleek skyscrapers form a brutalist, fortress-like skyline, presenting the unrivaled power of megacorps in all its arrogance. Since 2020, the City Center has become the most fortified and secure part of Night City" (official concept-art tweet text, quoted) [READ-PARTIAL, boilerplate-heavy page] https://www.gamesradar.com/cyberpunk-2077-concept-art-shows-high-tech-city-center-and-polluted-santo-domingo . GamesRadar describes the pair of images as shining skyscrapers and neon advertisements, with a skyline "pulled straight from the original Blade Runner" (flying cars, towers fading into foggy sky) and a street-level view in California sunshine (same page).
- **Westbrook.** "Considered by many to be the best place to live and have fun in Night City" (official tweet quoted) [READ-PARTIAL] https://www.gamesradar.com/new-cyberpunk-2077-concept-art-shows-off-the-mega-rich-westbrook-district . This is the Neokitsch heartland per the style pages, but I did not find an article that states that explicitly.
- **Santo Domingo.** Described as polluted with "crowded megabuildings" and grime (GamesRadar page above; PC Gamer headline) [SNIPPET for the PC Gamer line] https://www.pcgamer.com/cyberpunk-2077-concept-art-shows-the-crowded-megabuildings-of-santo-domingo
- **Watson.** "Very Asian inspired", elements that remind of Japan or China but with one of the four styles layered on top so it is "not literally Japanese architecture"; very colourful because of the earthquake-and-rebuild layers (RPG Site Jonkers interview). Aftermath's walkthrough of the Kabuki roundabout: a lively pedestrian market in the middle of a traffic circle with street-food vendors and a shop for guns and cyberware, open 24 hours; the team closed traffic in places to make denser crowds, "tight streets of an Asian-inspired city" [READ] https://aftermath.site/cyberpunk-urban-design/
- **Pacifica / Grand Imperial Mall.** Only a mention in a review that the Pacifica demo shows the Grand Imperial Mall infiltration [READ] https://www.thegamer.com/cyberpunk-2077-stealth-mechanics-hacking-sneaking-playstyle/ . Jonkers confirms Pacifica "is different from Watson" yet "still one city" (RPG Site above).
- **Heywood.** PC Gamer article exists on gang-controlled Heywood concept art [SNIPPET] https://pcgamer.com/the-latest-cyberpunk-2077-concept-art-shows-gang-controlled-heywood
- **Dogtown (Phantom Liberty).** Demolished, abandoned, vandalised, almost post-apocalyptic; tools were sand, dust and overgrowth, with more of them as you go toward abandoned casinos and spas, used as environmental storytelling (80.lv interview above).
- Layout: CDPR had an urban planner (Jonkers) and then two urban planners on the team who acted as "the voice of common sense" against artists wanting flamboyant sci-fi (RPG Site; Aftermath above).

Not covered by anything I could read: Corpo Plaza specifics, Arasaka Tower, Konpeki Plaza, megabuilding interiors, ripperdoc clinics and the Afterlife bar as authored spaces. See section 12. The nearest visual evidence is the screenshots in section 10 (neon bars and clinic-cross neon).

## 3. Signage, advertising, neon, screens

- Night City is "extraordinarily dense with signage, advertisements, graffiti, props, architecture, crowds, and environmental storytelling" (question text) and artists placed "buildings and advertisements to trash containers and individual sheets of paper" by hand; procedural tools were tested but rejected except a spline road tool that places roads, bridges and overpasses plus decorations that artists then adjust [READ] https://80.lv/articles/interview-how-cyberpunk-2077-s-night-city-was-built-almost-entirely-by-hand/
- The team admits some places went "noisy": they later wrote guidelines for Phantom Liberty on grouping colours, shapes and details and keeping negative space "where the eyes can rest" (same page). Treehouse Ninjas' lead artist: distribute broad, mid and high-frequency detail, and avoid recognisable repetition (below, section 5).
- In-world graphic design (logos, billboards, magazines, books) was outsourced in part to Pixel Mafia [SNIPPET, search result summary only]; I did not open a primary page for this.
- Decals are used extensively and also cover texel-density problems (80.lv interview above).
- Neon recipe from a student 80.lv piece (not CDPR, but a useful cheap-real-time recipe): neon = emissive cylinder mesh plus a point light with a source radius and length; billboards = translucent emissive material with a panner to animate; extra fill lights to fake GI; pipes and wires as spline-mesh components; decals for graffiti [READ] https://80.lv/articles/lights-and-color-in-cyberpunk-environments
- UI as a layer of glass: Knapik wanted a physical, retro 80s-electronics HUD "projected via the player's cybernetic eyes" and built it with Nuke prototypes (Foundry Q&A below).

## 4. Cabling, pipes, vending machines, clutter

Sourced detail is thin: no CDPR page I could read documents pipe or cable kits specifically. What is sourced:
- Wires and pipes as spline-mesh blueprint components (student piece above; method only, not CDPR).
- Vending machines, lights, screens, jukeboxes, speakers, fog machines and fuse boxes are hackable "distract" devices (gameplay reference) [READ-PARTIAL] https://space4games.com/en/games-en/cyberpunk-2077-hacking-guide/ . So set dressing doubles as gameplay hooks.
- Scale props: "sheets of paper, bottles, benches" were used so the player reads building scale in first person (80.lv interview above).
- Placement can break gameplay: "a dumpster in the wrong spot could ... even block important NPCs" (Treehouse Ninjas below).

## 5. Set dressing and building methods (how a location is made)

Treehouse Ninjas (outsource studio, about 130 locations, mainly Street Stories, in nearly every district), Mauro Frau interview [READ-PARTIAL] https://80.lv/articles/making-locations-for-cyberpunk-2077 and a second interview with four artists [READ] https://80.lv/articles/creating-lighting-and-environments-for-cyberpunk-2077/ :

1. Story briefing (backstory, key props and encounters, outcomes).
2. Art briefing (moodboards, concept art, style, colour progression; each district "had its visual grammar", plus the social context: gangs, nomads, cops, corpos).
3. Level-design briefing (multiple paths for different playstyles; "show, don't tell, or even better do, don't show").
4. First environment pass on a colour-coded grey-box, "broad but very accurate", architecture and central dressing.
5. Draft lighting early, playtest feedback, then set dressing, decals pass, polish.
6. Final lighting.

Methods quoted from the four-artist interview:
- **Kitbashing**: once the central library was large, the most effective approach was kitbashing existing models into new prefabs; new assets only when story needs something unique.
- **Microstories**: broken glass, a half-finished painting, a disassembled vehicle; "what was the desk owner doing before he abandoned that desk? What did the guy eat before he left that workspot?"
- **Real-world metrics**: window and door placement is "unforgiving"; the brain notices when it does not fit.
- **Positive and negative space, rhythm of busy and empty areas**, step back to let the eye rest.
- **One artist per location** from blockout to final lighting, so light and dressing are designed together.

CDPR itself: environment art is split between open world (art driven) and quest locations (level design blockout first, then art), with level designers paired with artists [READ] 80.lv by-hand interview above. First-person view forced texel density to **2x The Witcher 3** and new level-design metrics; decals relieve density problems.

## 6. Lighting practice (interior and exterior)

**Philosophy.** Knapik, a film VFX supervisor: "build a game world that behaves like a lighting sandbox. Every light change needed a predictable, physically grounded outcome", because a day-night cycle and weather make hand-lighting every location under every condition impossible. Offline Arnold path-tracing renders were used to verify engine systems early [READ] 80.lv by-hand interview above; same idea in the Foundry Q&A where he built a reference database with Nuke and an external path tracer, compared HDR data from both, and notes first-bounce is physical but later bounces are approximated [READ] https://foundry.com/insights/film-tv/cyberpunk-2077-night-city-nuke

**Tone mapping.** Instead of a typical tone-mapper they used a classic film 3D LUT system: a custom `.cube` file authored in Nuke, with separate LUTs for special modes (scanning mode, tank vision, the 2020s flashback) (Foundry Q&A above).

**GI and lights, classic mode (REDengine).** GI probes dynamic for all lights within a distance of the camera at a manually set world resolution of mostly 1.5 m to 4 m; hybrid indirect that works on all platforms [READ-PARTIAL] https://www.nvidia.com/en-us/geforce/news/cyberpunk-2077-ray-tracing-overdrive-mode-interview/ . Strict shadow budget of about **10 active shadow-casting lights** (80.lv by-hand interview). Shadow tech details: cascaded shadows each 4x bigger than the previous, last cascade covers the whole 256 km2 map; interval-based cascade selection; fixed per-frame count of local shadow maps that artists budget; static maps cached [READ] https://history.siggraph.org/wp-content/uploads/2022/06/2021-Talks-Dybisz_Shadows-Optimizations-in-Cyberpunk-2077.pdf

**Path tracing (Overdrive).** Every loaded light casts shadows, even ones never meant to; energy balance needs it. Artists needed tricks when lights sit close to walls. Two bounces were chosen as the sweet spot; indirect specular added (Nvidia interview and 80.lv interview above). It began as a Photo Mode idea (Nvidia interview).

**Interior lighting practice from the artists** (80.lv four-artist interview):
- Lighting has to work for the whole 24-hour cycle even in interiors, and "under different sun angles as much as under night lighting".
- Use light and shadow to guide the player; a grate or bars casting shadow stripes means keep the dressing simple so it stays readable.
- NPCs must not fall into darkness: playtest where enemies walk or climb; "clear visibility while keeping dramatic contrast and nice gradients, definitely avoiding flooding/flattening the space with light".
- Apartments: light treated as an art tool for mood, cosy and peaceful.
- GDC 2022 session "Cyberpunk 2077: Bringing Light to Night City" (Knapik, Dave Yablonsky, Voon Kent Poo) covers one interior and one open-world production case; I read only the announcement, not the talk [READ] https://gdconf.com/news/find-out-how-cyberpunk-2077-lit-night-city-gdc-2022-session

**Colour temperature, volumetrics, fog, emissives.** I found no CDPR source giving Kelvin values or fog parameters. What I can say from images (section 10): mixed warm tungsten/sodium orange against cyan and magenta neon, haze that makes beams visible, wet ground that doubles every light. These are my own observations, not sourced facts.

**Colour scripts.** No source found for a formal per-mission colour script. The nearest: a "main colour progression" in each art briefing and "colour coding that best matched" each district theme (Treehouse Ninjas, Knapik).

**Weather and time of day.** Dynamic day-night cycle and weather (Wikipedia gameplay section) [READ] https://en.wikipedia.org/wiki/Cyberpunk_2077 ; Knapik wanted players to feel "the passage of time: from the energy of scorching daylight to the vibrant colours of night slowly blending in through the dusk" (Foundry Q&A). Daylight Night City is a deliberate contrast: GDC blurb says "cyberpunk looks best at night (ideally in the rain)", and the game also brought "daytime" (GDC announcement above).

**Crowd and vehicles (brief).** Cars are almost always in motion, rarely parked; the city is car-centric but "Cyberpunk 2077 isn't a game about driving" (Aftermath). Crowds are denser where traffic is closed (Aftermath).

## 7. Gameplay: stealth and hacking

### 7.1 Core structure
- Two main playstyles, Netrunner (hacking) and Solo (combat); movement includes sprint, cover, double jump and slide, many unlocked by cyberware from a ripperdoc; game can be completed without killing anyone (non-lethal options) [READ] https://en.wikipedia.org/wiki/Cyberpunk_2077
- Four damage types: Physical, Thermal, Electric, Toxic (same page).

### 7.2 Quickhacks (community wiki data, 2.x era)
Mechanics: you need a cyberdeck; quickhacks cost RAM units, RAM recovers outside combat; hacks can be queued on a target and some modify later ones (for example, make them untraceable); categories are Covert (infiltration), Combat (damage), Control (impede, strong against bosses) and Ultimate (costly, can eliminate instantly) [READ] https://cyberpunk2077.wiki.fextralife.com/Quickhacks . Access Points are physical ports for the local network; Ping reveals them [same page].

| Quickhack | Category | Effect (as listed) | Source page |
|---|---|---|---|
| Ping | Covert | Untraceable; reveals enemies and devices on the network; 16 s; +25% smart-weapon lock speed on pinged enemies; lets you quickhack through walls | https://cyberpunk2077.wiki.fextralife.com/Ping_(Quickhack) |
| Whistle | Covert | Target becomes alert and moves to your position; upgraded: not alerted when moving there; works in combat | https://cyberpunk2077.wiki.fextralife.com/Whistle |
| Bait | Covert | Untraceable; lures an enemy to your position without alerting; in combat forces them out of cover; via a camera they walk to the camera; second upload turns them back | https://cyberpunk2077.wiki.fextralife.com/Bait |
| Memory Wipe | Covert | Untraceable; target does not notice you for a short time; forces enemies out of combat state | https://cyberpunk2077.wiki.fextralife.com/Memory_Wipe |
| Request Backup | Covert | Range 20 m; calls one enemy to the target's location; with Bait up to 4 enemies | https://cyberpunk2077.wiki.fextralife.com/Request_Backup |
| Reboot Optics | Control | Blinds target; in combat reduces accuracy; resets detection progress; +15% headshot damage | https://cyberpunk2077.wiki.fextralife.com/Reboot_Optics |
| Weapon Glitch | Control | Detonates primary weapon, forcing sidearm; reduces accuracy; disables smart-targeting and cover penetration | https://cyberpunk2077.wiki.fextralife.com/Weapon_Glitch |
| Cripple Movement | Control | Disables enemy movement and dodge cyberware; more susceptible to melee finishers | https://cyberpunk2077.wiki.fextralife.com/Cripple_Movement |
| Cyberware Malfunction | Control | Stacks to 5; disables cyberware; extra damage taken; at 3 stacks electrical damage over time; at max, overload deals massive damage | https://cyberpunk2077.wiki.fextralife.com/Cyberware_Malfunction |
| Sonic Shock | Combat | Untraceable; deafens, scrambles comms so enemy cannot talk to allies, is ignored by allies' senses; on a target already hit by Memory Wipe and Reboot Optics they lose consciousness | https://cyberpunk2077.wiki.fextralife.com/Sonic_Shock |
| Overheat | Combat | Sets target on fire, damage over time, melts armour up to -40% | https://cyberpunk2077.wiki.fextralife.com/Overheat |
| Contagion | Combat | Poison over time that spreads to 4 enemies within 8 m; bursts if combined with burn; weak against robots | https://cyberpunk2077.wiki.fextralife.com/Contagion |
| Short Circuit | Combat | Electrical damage; extra against mechs, robots, drones, turrets; EMP effect | https://cyberpunk2077.wiki.fextralife.com/Short_Circuit |
| Synapse Burnout | Combat | Heavy damage scaling +10% per RAM unit spent (max +400%) | https://cyberpunk2077.wiki.fextralife.com/Synapse_Burnout |
| System Reset / System Collapse | Ultimate | Cripple the nervous system, target passes out without noise (Collapse is untraceable and silent knockout) | https://cyberpunk2077.wiki.fextralife.com/System_Reset , https://cyberpunk2077.wiki.fextralife.com/System_Collapse |
| Suicide | Ultimate | Forces target to shoot themselves | https://cyberpunk2077.wiki.fextralife.com/Suicide |
| Cyberpsychosis | Ultimate | Target attacks nearest friend or foe, or kills themselves if alone; 60 s | https://cyberpunk2077.wiki.fextralife.com/Cyberpsychosis_(Quickhack) |
| Detonate Grenade | Ultimate | Target detonates their grenade; also weakspots on robots, drones, turrets | https://cyberpunk2077.wiki.fextralife.com/Detonate_Grenade |

Device hacks (from the hacking guide) [READ-PARTIAL] https://space4games.com/en/games-en/cyberpunk-2077-hacking-guide/ : **Distract Enemies** (device malfunctions, attracts nearby enemies and keeps them there; works on vending machines, lights, screens, computers, vehicles, forklifts, generators, jukeboxes, speakers, fog machines, fuse boxes and more); **Remote Deactivation** (open doors, turn cameras on and off; elevator terminals, lights, turrets, smart glass, booby traps, terminals, doors, cameras). GamesRadar adds: scan to disable or remote control cameras, turn turrets friendly, distract with vending machines [READ-PARTIAL] https://gamesradar.com/au/cyberpunk-2077-hacking-breach-protocol-quickhacks

### 7.3 Breach Protocol
Every cyberdeck has it; it is a code-matrix minigame started at an Access Point or on a networked enemy or device, uploads daemons that affect all connected enemies and devices. ICEpick daemon lowers RAM costs of quickhacks on the network; Datamine daemon yields money, crafting components or occasionally a new quickhack [READ] https://cyberpunk2077.wiki.fextralife.com/Quickhacks and https://space4games.com/en/games-en/cyberpunk-2077-hacking-guide/ . The skill levels add Breach time (+5% steps), components acquired and RAM [READ] https://cyberpunk2077.wiki.fextralife.com/Breach+Protocol

### 7.4 Stealth, alert states, cameras and turrets
- Crouch to sneak; when hidden the screen edges darken. Scan and tag enemies so they stay visible. Grab from behind: lethal or non-lethal takedown. Bodies can be found by patrols and raise the alert, so hide them in containers such as bins and wardrobes. Enemies marked with a red skull are above your level and cannot be grappled [READ] https://gameshedge.com/?p=42781
- Cameras and turrets detect by sight only, not sound; hostile cameras show an orange detection line, friendly green; they trigger alarms that alert nearby enemies (same page).
- Reviewer criticism: stealth is rudimentary, patrols are predictable, hiding bodies is largely pointless because enemies rarely discover them unless distracted, level design often forces aggression [READ] https://www.thegamer.com/cyberpunk-2077-stealth-mechanics-hacking-sneaking-playstyle/ . Useful as a list of what to avoid.
- Perks: Overclock (quickhack without enough RAM), Copy-Paste (hacking an enemy netrunner who targets you spreads your hack), Eye In The Sky (highlights nearby cameras and access points) [READ-PARTIAL] https://gamesradar.com/au/cyberpunk-2077-hacking-breach-protocol-quickhacks
- Netrunner counter-hack: quickhacks have a "trace" progress, and System Collapse and Memory Wipe reduce it (wiki rows above); enemy netrunners can target you (Copy-Paste perk). I did not find a page describing the exact trace mechanic.
- Formal alert-state names (unaware, suspicious, combat) were **not** found in a readable source. The mechanic of "detection progress" is mentioned in Reboot Optics ("resets detection progress"); that is the extent of it.

### 7.5 Movement cyberware and weapons
- Kerenzikov: slows time 60% for 2 to 3.75 s when aiming during slide, dash or dodge; cooldown 6 to 8 s [READ] https://cyberpunk2077.wiki.fextralife.com/Kerenzikov
- Double jump and slide (Wikipedia above); I did not read a dedicated page on dash or double-jump numbers (Reinforced Tendons page returned table data without prose).
- Weapon classes: **Power** (classic ballistics, bullets can ricochet off hard surfaces), **Tech** (hold to charge to penetrate cover and walls), **Smart** (homing bullets, needs Smart Link cyberware, deals less damage to balance the aim help) [READ] https://cyberpunk2077.wiki.fextralife.com/Power+Weapons , https://cyberpunk2077.wiki.fextralife.com/Tech+Weapons , https://cyberpunk2077.wiki.fextralife.com/Smart+Weapons
- Body disposal: a Fextralife "Body Disposal" page was almost empty; the gameshedge guide above is the source.

## 8. Technical and production facts worth knowing

- REDengine 4 built new for the game; physically based pipeline new to CDPR [Foundry Q&A].
- Night City lit fully dynamically with GI, nothing pre-baked because of data size, verticality and the day-night cycle [Foundry Q&A].
- Path tracing replaced a probe grid; RTXDI lets a hundred or more lights cast shadows [Nvidia interview].
- Official digital artbook exists at https://www.cyberpunk.net/artbook/en/ (page is a JavaScript app; my fetch returned no text) [NOT READ]. Print book: The World of Cyberpunk 2077, Dark Horse [SNIPPET].

## 9. Takeaways relevant to the stated game

See section 11.

## 10. Images (24 described, all viewed)

Source: Steam store page screenshots for Cyberpunk 2077 (app 1091500), from the Steam appdetails API https://store.steampowered.com/api/appdetails?appids=1091500 . I downloaded each, resized it into contact sheets and looked at them. Descriptions are mine. Environment-relevant ones first.

| # | URL | What it shows (viewed) |
|---|---|---|
| 1 | @@CP02@@ | First-person gunfight in an industrial hall: orange muzzle flash against a dark teal-green space, sodium-yellow overhead strip lights, wet floor, sparks, a hovering red-lit drone. Warm light only where the action is. |
| 2 | @@CP05@@ | Garage interior: retro blue/yellow/white sports car under hard overhead light, a mechanic welding with a spray of sparks, tyres, barrels, floor stains, dusty haze. Practical lights plus welding sparks as a moving light source. |
| 3 | @@CP06@@ | Low-angle view up a concrete wall with narrow slot windows and a large teal stencil mural of a skull-faced figure in a red-striped garment. Graffiti as scale and storytelling on a plain surface. |
| 4 | @@CP10@@ | Night market under an overpass: vertical pink neon sign, magenta and cyan fairy lights, chain-link fence, hawker stalls, haze that makes light scatter. Layered depth with warm, cool and pink separations. |
| 5 | @@CP12@@ | Night plaza with a green-glowing motorcycle, palm trees, a neon bird sign on a building and a wet reflective surface. Single saturated accent colour against a teal-dark base. |
| 6 | @@CP16@@ | Rain-wet night street with a teal and orange canopy for a "TURBO" shop, towers with lit window grids, billboards on poles, a tree for organic contrast. |
| 7 | @@CP19@@ | Street under an elevated road: orange guard rails, a yellow taxi, a red neon sign high up, mixed pedestrians; orange and red against grey concrete. |
| 8 | @@CP21@@ | Dark control-room interior with a pink and cyan neon sign reading "LIZZIE'S BAR" top left, small red indicator lights, a character lit by the sign. Light from a sign motivating the shot. |
| 9 | @@CP22@@ | Neon bar interior: glowing white and magenta bar counter, cyan geometric-pattern wall panels, ceiling LED strips in magenta; a character with a blue feathered collar. Emissive furniture as the main light source. |
| 10 | @@CP23@@ | First-person interior: gang members with red cybernetic eyes aiming guns, dim brown-orange warehouse, red glows as accent. Enemy eyes read as the brightest points in a dark room. |
| 11 | @@CP24@@ | Narrow Japantown-style street at dusk: wooden facades, red paper lanterns, overhead cables, Japanese-style signage (the latin-script text looks like "HO" followed by katakana, low resolution), a black sports car with a red light strip, neon in the shadows. |
| 12 | @@CP25@@ | Johnny from behind, Samurai logo vest and chrome arm, sunlit dusty street, long palm shadows, a stadium in the haze, a teal cross neon (clinic or pharmacy) top left. Daylight cyberpunk. |
| 13 | @@CP13@@ | Rooftop view across stacked megabuildings under a pale hazy sky, flying vehicles, smoke and yellow gas at the figure's feet. Atmospheric perspective for scale. |
| 14 | @@CP14@@ | Daytime street under a concrete overpass: green hatchback, shopfront with sign, a tall spire in haze, a hovering craft. Clean daylight, plenty of signage. |
| 15 | @@CP15@@ | Golden-hour boulevard: palm trees, elevated road with a cyan edge-light strip, a high-rise backdrop, strong backlight and haze. |
| 16 | @@CP17@@ | Daylight scene: a character with blue mohawk and sword, shotgun, palms, graffiti, low-rise buildings with megatowers behind. Contrast of low and huge. |
| 17 | @@CP18@@ | Pickup truck through muddy water at golden hour, ragged block towers with stacked container-like volumes behind. Entropism silhouette. |
| 18 | @@CP03@@ | Night street, man in a long coat aiming a pistol, police lights red and blue behind, a cyan scrolling "CAUTION" LED sign, tower silhouettes, orange-red sky glow. |
| 19 | @@CP04@@ | Character with spiked hair against a bright graffiti wall (skull logo, pink and purple), cyan and magenta ambient. Kitsch palette. |
| 20 | @@CP01@@ | Inside a police-style car at night: warm dashboard light on faces, blurred cool city lights beyond the windscreen. |
| 21 | @@CP11@@ | Portrait in a yellow jacket with cyan rim light, holographic screens in teal and orange behind. |
| 22 | @@CP20@@ | Figure in a dark coat against a junkyard and a lattice pylon in desaturated green-grey fog. Entropism / wasteland mood. |
| 23 | @@CP08@@ | Daytime chase: a yellow sports car drifting with a gull-wing door open beside an NCPD cruiser, tyre smoke. |
| 24 | @@CP09@@ | Roadblock with wrecked cars, police cruisers and dust. |

(Image 7 in the Steam set is a character-creator UI screen and is not listed. Images are Steam store marketing screenshots; do not copy them into the repository.)

---

## 11. What our game should take from it (side-view, three.js, browser)

1. **Use the four styles as a layer system for the complex.** Tag every wall module with a style age (Entropism, Kitsch, Neomilitarism, Neokitsch). Outer perimeter and maintenance areas Entropism (cheap, angular, desaturated); mid-level canteens and recreation Kitsch (rounded, saturated); security core Neomilitarism (black, graphite, formal); executive suite Neokitsch (wood, gold, natural motifs). Players read "how dangerous and how rich" from material alone. (Sources: sections 1 and 2.)
2. **Rule of contrast per room.** Put one deliberate contradiction in each room (a fancy executive carpet next to a bullet-riddled vent; a crashed drone in a lobby). Cheap to author, grounds the world. (80.lv by-hand interview.)
3. **Style-based visual tells for gameplay.** Neomilitarism rooms = hostile, camera and turret coverage; Kitsch = civilians and noise; Entropism = hiding places and vents. Same logic CDPR uses for "who built it, how old".
4. **Light-budget rule.** Cap shadow-casting lights to about 10 per visible screen section (CDPR's non-RT budget) and fake the rest with emissive meshes plus unshadowed point lights or baked light sprites. In three.js, `PointLight` shadows are expensive; use 2 to 4 shadow casters plus many cheap lights. (Knapik interview, Dybisz paper.)
5. **Neon recipe.** Emissive tube mesh plus a small unshadowed point light with radius, billboards as emissive planes with scrolling UV, plus bloom. Build a `NeonSign` prefab with colour, flicker pattern and a light. (Student neon recipe, section 3.)
6. **Wet ground doubles every light.** Ground and floor materials with high gloss and a cheap screen-space or planar reflection strip; puddle decals blended with a mask. Observed in images 4, 5, 6.
7. **Mixed colour temperature in each room.** One warm practical (tungsten or sodium) against one cool or saturated neon rim. Define a per-room palette of 1 warm, 1 cool, 1 accent, in line with the "main colour progression" in CDPR's art briefs.
8. **Darkness readability rule.** Enemies and guards never fall into pure black: give each patrol path a minimum fill light or a rim-light shader on actors; keep dramatic contrast with gradients rather than flooding the scene (Treehouse Ninjas lighting advice).
9. **Light shapes guide the player.** Slat or grate shadow stripes across a wall mean "keep the dressing simple there". Use gobo textures on spotlights so stripes can also mark hiding spots. (Treehouse Ninjas.)
10. **Day and night from one setup.** Treat sun direction and intensity as the only difference; interiors are lit by practicals and a skylight leak. Provide a LUT-based grade per time of day (CDPR used a custom 3D `.cube` LUT instead of a plain tone map); three.js can apply a 3D LUT in a post pass. (Foundry Q&A.)
11. **Per-mode LUTs.** Separate LUTs for special vision modes (scan mode, night vision, thermal) exactly as CDPR did for scanning and tank vision.
12. **Kitbash a library, then dress.** Build 30 to 50 modular wall, floor and prop modules and kitbash into prefabs; add a decals pass (grime, graffiti, cable runs) per room. Avoid recognisable repetition by rotating and mixing styles. (Treehouse Ninjas.)
13. **Microstory per room.** Require one authored microstory per room (a half-eaten meal, a broken terminal, a guard rota on a whiteboard). Add an editor field for it so level designers cannot skip it. (Treehouse Ninjas.)
14. **Detail-frequency rule.** Each screen should contain broad (architecture), mid (machines, signs) and high-frequency (decals, wires) detail, with at least one quiet area to rest the eye. Review each room for "noise". (Treehouse Ninjas; Knapik's Phantom Liberty guidelines.)
15. **Scale props.** Place objects with obvious scale (paper, bottles, chairs, crates) next to doors and machinery so a side-on camera reads the room size. (80.lv interview.)
16. **Props double as gameplay hooks.** Vending machines, jukeboxes, screens, fog machines, fuse boxes, forklifts as hackable or shootable distraction devices with a visible tell. (Hacking guide.)
17. **Three-tier hacking verbs in 2D.** Covert (ping, bait, memory wipe), control (blind, disable weapon, cripple), ultimate (silent knockout). Map to a radial menu with RAM-like energy that recovers out of combat. Queue hacks with modifiers (for example, "untraceable" tag). (Quickhack table.)
18. **Camera and turret rules.** Cameras detect by vision only and show an orange cone, friendly green after hack; turrets can be flipped friendly; a hacked camera can lure a guard to the camera instead of you. Side-view cones are simple 2D wedges. (Gameshedge guide; Bait row.)
19. **Detection as a meter, not a binary.** Use a per-guard "detection progress" that fills, can be reset by a blind or memory-wipe action, and raises alert on reaching full. (Reboot Optics row; mechanic otherwise undocumented, so tune ourselves.)
20. **Bodies matter.** Found bodies raise alerts; give containers (bins, lockers) as disposal; fix CDPR's reviewer-noted weakness by making patrols actually check body spots and recompute routes. (Gameshedge; The Gamer critique.)
21. **Sound-blind vs sight-blind guards.** Sonic Shock deafens and cuts comms; Reboot Optics blinds. Model hearing radius and vision cone as separate stats on each guard, and let hacks hit each independently. (Quickhack rows.)
22. **Network breach as a short mini-game.** A 20 to 30 s code-grid puzzle at a wall terminal that applies one buff to every hackable thing on the screen (reduced RAM cost, camera loop, door unlock), with a reward variant (credits or hack part). (Breach Protocol.)
23. **Movement kit.** Double jump, slide and a slow-motion aim window (Kerenzikov: 60% slow for 2 to 3.75 s after slide or dash, 6 to 8 s cooldown). Make the slow-mo trigger from a slide, since side view slides are readable. (Kerenzikov page.)
24. **Three weapon classes as design axes.** Power (ricochet), Tech (charge to punch through thin cover), Smart (homing but weaker). Side-view: ricochets can bounce off metal walls, charged shots penetrate one wall layer, smart weapon auto-aims within a cone. (Weapon pages.)
25. **Non-lethal parity.** Everything achievable without killing, with knockout hacks and takedowns, as CDPR supports. (Wikipedia.)
26. **UI as in-world glass layer.** Retro 80s HUD with scan lines and slight chromatic offset reading as projected optics; the HUD can glitch when EMPed. (Foundry Q&A on UI.)
27. **Advertising as world content.** Procedurally pick ad textures from a small set of corporate brands per district style; keep emissive ad panels as rhythm anchors for the camera (busy and empty beats). (80.lv interviews.)
28. **Verticality and layered depth.** In side view, use 3 depth layers (foreground silhouettes, play plane, background megabuildings with fog and distant lit windows). Observed in images 13, 14, 15.
29. **Scripted-light shoot-outs.** Lights that can be shot or hacked to change cover; treat light as a gameplay variable (links to the COD and Battlefield file). Cyberpunk's own lights are largely unhackable, so this is our extension.
30. **Iterate with blockout colour-coding.** Grey-box levels using a colour grammar (walkable, cover, hack target, vent) before art, as Treehouse Ninjas did.

---

## 12. Could not verify / gaps

- Specific authoring write-ups for Corpo Plaza, Arasaka Tower, Konpeki Plaza, megabuilding interiors, ripperdoc clinics and the Afterlife: nothing readable found. Only generic district and style text above.
- Official Night City Wire episode notes and artbook text: not opened. The artbook site is a JavaScript app (fetch returned no text), and the Night City Wire pages were not found in my searches.
- The Digital Dragons 2022 talk (video): not watched. The design-wiki transcription of its style text was read.
- The GDC 2022 lighting talk: only the announcement read, not the talk or slides.
- CDPR tech-blog posts on cdprojektred.com: not found in search; I did not open any.
- Colour temperatures (Kelvin), fog and volumetric parameters, per-light-type settings: none published in anything I read.
- Pixel Mafia's role in in-world signage: search snippet only.
- Exact alert-state names and thresholds, enemy netrunner trace mechanic, dash and double-jump numbers, perk lists for stealth: not found in readable form. Quickhack numbers are community-wiki values for a 2026 patch state and can change.
- Reinforced Tendons, Mantis Blades and Body Disposal pages returned tables or almost nothing.
- Colour scripts as a formal document: none found.
- A few pages (PC Gamer Heywood, PC Gamer Santo Domingo, GamesRadar concept-art pages) returned mostly cookie and newsletter boilerplate; I used only the lines that were clearly article text, and otherwise marked SNIPPET.
- Domus article on Night City (https://domusweb.it/en/architecture/gallery/2020/12/21/night-city-how-the-cyberpunk-2077s-megalopolis-was-built.html) returned a redirect with no body; not read.

## 13. Full link list

Read in full or in part:
- https://80.lv/articles/interview-how-cyberpunk-2077-s-night-city-was-built-almost-entirely-by-hand/
- https://80.lv/articles/creating-lighting-and-environments-for-cyberpunk-2077/
- https://80.lv/articles/making-locations-for-cyberpunk-2077
- https://80.lv/articles/lights-and-color-in-cyberpunk-environments
- https://foundry.com/insights/film-tv/cyberpunk-2077-night-city-nuke
- https://www.nvidia.com/en-us/geforce/news/cyberpunk-2077-ray-tracing-overdrive-mode-interview/
- https://history.siggraph.org/wp-content/uploads/2022/06/2021-Talks-Dybisz_Shadows-Optimizations-in-Cyberpunk-2077.pdf
- https://gdconf.com/news/find-out-how-cyberpunk-2077-lit-night-city-gdc-2022-session
- https://www.rpgsite.net/interview/8896-cyberpunk-2077-interview-exploring-the-environment-with-senior-concept-artist-marthe-jonkers
- https://www.gamereactor.eu/cities-of-the-future-art-design-in-cyberpunk-2077/
- https://gamingbolt.com/cyberpunk-2077s-districts-have-their-own-distinct-visual-style
- https://aftermath.site/cyberpunk-urban-design/
- https://www.gamesradar.com/cyberpunk-2077-concept-art-shows-high-tech-city-center-and-polluted-santo-domingo
- https://www.gamesradar.com/new-cyberpunk-2077-concept-art-shows-off-the-mega-rich-westbrook-district
- https://game-design-research.gitbook.io/cyberpunk-2077-design-wiki/cyberpunk-design-resources/style/entropism
- https://game-design-research.gitbook.io/cyberpunk-2077-design-wiki/cyberpunk-design-resources/style/kitsch
- https://game-design-research.gitbook.io/cyberpunk-2077-design-wiki/cyberpunk-design-resources/style/neo-militarism
- https://game-design-research.gitbook.io/cyberpunk-2077-design-wiki/cyberpunk-design-resources/style/neo-kitsch
- https://en.wikipedia.org/wiki/Cyberpunk_2077
- https://cyberpunk2077.wiki.fextralife.com/Quickhacks (and the per-hack pages listed in section 7.2, plus /Breach+Protocol, /Stealth, /Kerenzikov, /Power+Weapons, /Tech+Weapons, /Smart+Weapons)
- https://space4games.com/en/games-en/cyberpunk-2077-hacking-guide/
- https://gamesradar.com/au/cyberpunk-2077-hacking-breach-protocol-quickhacks
- https://gameshedge.com/?p=42781
- https://www.thegamer.com/cyberpunk-2077-stealth-mechanics-hacking-sneaking-playstyle/
- https://store.steampowered.com/api/appdetails?appids=1091500

Seen only as search snippets:
- https://www.pcgamer.com/cyberpunk-2077-concept-art-shows-the-crowded-megabuildings-of-santo-domingo
- https://pcgamer.com/the-latest-cyberpunk-2077-concept-art-shows-gang-controlled-heywood
- https://www.cyberpunk.net/artbook/en/ (artbook; not readable)
- https://blog.megascans.se/?p=3671 and https://80.lv/articles/creating-cyberpunk-2077-world-with-megascans-assets (opened; no usable body text returned)
- https://www.gfinityesports.com/article/cyberpunk-2077-cd-projekt-red-building-night-city
- https://www.pcgameshardware.de/Cyberpunk-2077-Spiel-20697/Specials/Technik-Interview-Raytracing-1353245/
- https://www.archdaily.com/954939/cyberpunk-2077-is-an-architecture-critique-with-nothing-to-say
- https://www.gamepressure.com/editorials/retrofuturism-of-cyberpunk-2077-how-the-setting-is-outdated-and-w/cyberpunk-romance/z81c4

Image URLs: listed in section 10 (all from the Steam appdetails API above).
