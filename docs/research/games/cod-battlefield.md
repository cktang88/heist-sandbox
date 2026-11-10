# Modern military shooters reference: Call of Duty (MW 2019, MWII, MWIII) and Battlefield (6, with V/2042 notes)

Research date: 2026-11-10. Purpose: reference for a side-view (2.5D) browser infiltration game (three.js) with a realistic special-forces operative.

Labels used:
- **[READ]** I opened the page and read the text.
- **[READ-PARTIAL]** I opened it but only part was readable (size limit, boilerplate, dynamic content).
- **[ABSTRACT]** I read the official abstract page of a paper or talk but not the slides or PDF.
- **[SNIPPET]** I saw it only in a search-result summary, not on the page. Treat as unverified.
- **[VIEWED]** I downloaded and looked at the image (resized).
Anything I could not confirm is in section 9.

Date caution: Battlefield 6 launched October 2025 and has had live updates since. Numbers from EA's gunplay post describe Update 1.3.3.0 (June 2026) and may have changed again.

---

## 1. Rendering and art

### 1.1 Call of Duty engine overview (Infinity Ward, Modern Warfare 2019)
Source: Activision's "Initial Intel" interview with Michal Drobot (Principal Rendering Engineer, head of Infinity Ward Poland) [READ] https://blog.activision.com/call-of-duty/2019-06/Initial-Intel-Call-of-Duty-Modern-Warfares-game-engine-is-put-through-its-paces
- A new purpose-built engine, over five years of work; target is realism at 60 fps on consoles and more on PC.
- Photogrammetry field trips (for example, the Arizona desert) produced more than 2 TB of data, so compression was a major problem on consoles with "a couple of gigs of RAM".
- Laser scans were used to capture how surfaces reflect, not only how they look. Semi-transparent items that serve gameplay were called "pretty damn hard".
- Weapons got a separate lighting setup: different parts reflect differently; fingerprints, an oily rainbow-like coating on cleaned metal, powder-coat, ceramic, translucent magazines.
- Characters: performance capture with wrinkle and skin tension detail, subdivision surfaces and an adaptive tessellation tech whose detail drops with distance to hold 60 fps.

### 1.2 Photogrammetry pipeline (Joel Emslie, Art Director)
Source [READ] https://blog.activision.com/call-of-duty/2019-06/Initial-Intel-How-Photogrammetry-is-Helping-to-Shape-Call-of-Duty-Modern-Warfare-into-a-new-high-watermark-for-graphics-in-gaming
- Teams scanned rubble, garbage by a highway, quarry bricks, ruins, even a whole Russian tank; custom poles for angles; drones for coasts, deserts, mountains and forests.
- A close-up "tiling technique" adds detail when near a surface, roughly **64 pixels per inch** versus the usual 16 or 32.
- Scanned "meat bag" corpses: an in-house developer lay in a rig where 160 to 200 cameras fire at once, about six hours of processing per pose.
- Far, mid and close periphery: a sniper with a 12x scope can look at distant scanned geometry as well as walls up close.
- Everything must be photographic, including characters, or "it looks awful"; even the operator-select screen is a photographed prop-house projection with parallax.

### 1.3 Materials and measurement (Activision Central Tech publications)
- Reflectometer: a handheld device with six LEDs and six light sensors in an arc, measuring a roughly 1/8 inch square patch, calibrated against Spectralon for diffuse albedo, then fitting albedo, smoothness and specular F0; built during WWII to author physically measured material values [READ] https://www.activision.com/cdn/research/Reflectometer_Material_Capture.pdf (abstract page https://research.activision.com/publications/2024/11/Reflectometer_Material_Capture)
- Material Advances in Call of Duty: WWII (Danny Chan): Lambertian microfacet diffuse with multiscattering, mipmapping normal and gloss maps by relating gloss to average normal length, auto-generated cavity maps for occlusion in normal-map cavities [ABSTRACT] https://research.activision.com/publications/archives/material-advances-in-call-of-dutywwii (PDF: https://www.activision.com/cdn/research/MaterialAdvancesInWWII.pdf; I downloaded it but only used the abstract)
- Practical Multilayered Materials (Infinite Warfare): materials as stacks of media each with a BRDF and macro properties (thickness, scattering, absorption), examples car paint, lacquered wood, ice, translucent plastic, optimised for Forward+ [ABSTRACT] https://research.activision.com/publications/archives/practical-multilayered-materials-in-call-of-dutyinfinite-warfare
- Real-World Measurements for Advanced Warfare: measuring albedo, gloss and luminance to build intuition for values [ABSTRACT] https://research.activision.com/publications/archives/real-world-measurements-for-call-of-dutyadvanced-warfare
- Separable Subsurface Scattering technical report (skin) https://research.activision.com/publications/2020-03/separable-subsurface-scattering-expanded-technical-report [ABSTRACT only: title]

### 1.4 Lighting, shadows and volumetrics (Activision)
- Precomputed Lighting Advances in MW (Sloan, Silvennoinen): improvements to baking and runtime, efficient SH encoding, "hallucinating" higher frequencies from linear SH [ABSTRACT] https://research.activision.com/publications/2020-09/precomputed-lighting-advances-in-call-of-duty--modern-warfare
- Large-Scale Global Illumination in Call of Duty: compressed precomputed lighting with reconstruction directly from compressed data, visibility-based sampling of precomputed volumetric lighting [ABSTRACT] https://research.activision.com/publications/2021/09/large-scale-global-illumination-in-call-of-duty
- UberBake: a traditional static bake extended with a small set of features that update precomputed lighting at runtime in response to player interactions at little cost [ABSTRACT] https://research.activision.com/publications/2020-09/the-design-and-evolution-of-the-uberbake-light-baking-system
- Neural Light Grid: learned irradiance volume storing probe weighting functions, cheap to evaluate on basic hardware (also in SIGGRAPH Advances 2024) [ABSTRACT] https://research.activision.com/publications/2024/08/Neural_Light_Grid
- Volumetric GI at Treyarch: irradiance volumes as an alternative to lightmaps so moving objects and effects get the same lighting as the environment [ABSTRACT] https://research.activision.com/publications/archives/volumetric-global-illumination-at-treyarch
- Impulse Responses for Precomputing Light from Volumetric Media (Dubouchet): precomputing the effect of fog, smoke and cloud volumes on surrounding surfaces [ABSTRACT] https://research.activision.com/publications/2019-07/impulse-responses-for-precomputing-light-from-volumetric-media
- Raytraced Shadows in MW (Olejnik, Kozlowski of NVIDIA): ray tracing integrated into a Forward+ engine with minimal content change, many local area lights, noise cleanup [ABSTRACT] https://research.activision.com/publications/2020-10/raytraced-shadows-in-call-of-duty--modern-warfare (full presentation PDF is about 100 MB, not read)
- Shadows of Cold War: automatic scaling from ray-traced shadows at the high end to a dynamic-resolution shadow-map system with contact hardening inside a fixed memory budget for any number of lights [ABSTRACT] https://research.activision.com/publications/2021/10/shadows-of-cold-war--a-scalable-approach-to-shadowing
- Dark Water (MWII) lighting: the new shadow system with PCSS soft shadows made lighting easier (quote truncated in the page I read) [READ-PARTIAL] https://www.callofduty.com/blog/2022/08/call-of-duty-modern-warfare-II-dark-water-deep-dive
- Frostbite (Battlefield's engine): SIGGRAPH Advances 2015 talk "Towards Unified and Physically-Based Volumetric Lighting in Frostbite" (Sebastien Hillaire) [READ course page, talk itself NOT read; slides are a 158 MB PPTX] https://advances.realtimerendering.com/s2015/index.html ; GIBS, Frostbite's surfel-based dynamic GI, shipped in College Football 25 and "an upcoming open world action game", targeting 60 fps on current consoles [ABSTRACT] https://advances.realtimerendering.com/s2024/index.html ; EA also lists a Position Based Material Point Method for destruction research [READ] https://ea.com/news/ea-technology-siggraph-2024
- Content scaling at 60 fps: "Lima Oscar Delta" covers static and dynamic LOD, automatic mesh simplification, large player counts, expansive maps [ABSTRACT] https://research.activision.com/publications/2020-09/lima-oscar-delta--scaling-content-in-call-of-duty--modern-warfar ; software variable-rate shading (Drobot) [ABSTRACT] https://research.activision.com/publications/2020-09/software-based-variable-rate-shading-in-call-of-duty--modern-war ; adaptive voxel-based order-independent transparency for the Call of Duty engine, 2026 [ABSTRACT] https://research.activision.com/publications/2026/adaptive-voxel-based-order-independent-transparency (important for smoke and glass overlap).
- HDR in Call of Duty (colour pipeline, HDR display) https://research.activision.com/publications/archives/hdr-in-call-of-duty ; dynamic temporal AA and upsampling https://research.activision.com/publications/2020-03/dynamic-temporal-antialiasing-and-upsampling-in-call-of-duty ; controller-to-display latency throttle https://research.activision.com/publications/2020-11/controller-to-display-latency-in-call-of-duty [all ABSTRACT]
- Caldera: Activision released an open dataset of the Warzone map Caldera for non-commercial research [ABSTRACT] https://research.activision.com/publications/2024/07/Caldera-Advances-in-Real-Time-Rendering
- Battlefield 6 does not use ray tracing or path tracing and supports DLSS 4 [SNIPPET from a search summary; conflicting beta report]. Digital Foundry's beta and console verdicts were reported as highly polished and 60 fps stable on Series S [SNIPPET from third-party write-ups, I did not reach the Digital Foundry pages themselves].

### 1.5 Night missions, night vision, thermal, IR (spectral rendering)
Primary source: Drobot interview [READ] https://blog.activision.com/call-of-duty/2019-06/Initial-Intel-Call-of-Duty-Modern-Warfares-game-engine-is-put-through-its-paces , plus a Polish journalist's visit write-up [READ] https://www.gamepressure.com/editorials/call-of-duty-modern-warfare-ready-for-next-gen-we-visited-infinit/spectral-rendering-night-time-revolution/z31a1

Findings:
- "Night vision is just seeing infra-red". All lighting in the game carries an infrared spectrum, so the engine effectively always renders IR in case NVGs go on; it is not a green post filter.
- FLIR and "deep infra-red" for thermal; **lights with thermal emission** (dim but hot) are simulated.
- **IR patches** on operators' gear are visible in NVG and almost invisible in normal view, for friend-or-foe identification.
- IR lights on weapons and helmets cast shadows only visible via NVG; IR laser sights show up with NVGs on.
- In the Townhouse mission you can shoot out the lights and use NVG; the same rooms look right with natural lights because light behaviour is handled per spectrum.
- Different generations of devices: modern Tier 1 NVG versus 1960s and 70s ones with blur and artifacts; drone and thermal footage degraded with a deliberate JPEG-like compression-artifact look (blue and red artifact squares), called the "Shittify" filter by Drobot in the interview.
- The visit write-up reports the team shot a laser through a multi-lens NVG optic to measure how light disperses, to reproduce the wide-angle, multi-lens distortion (this is the journalist's account, not a quote from the team).
- Thermal reveals storytelling: which vehicles just turned off engines, fresh tracks in sand.
- Dark Edition NVG product images exist but are marketing [SNIPPET].

### 1.6 Muzzle flash, tracers, smoke, dust, explosions, debris, decals, weather, colour grade, camera
- Impact fidelity: effects are keyed to weapon power. A .50 cal on a wall differs from a smaller round; big rounds send targets flying and disintegrate doors better; sparks, smoke and impact effects "have to be representative of the power" [READ] https://blog.activision.com/call-of-duty/2019-07/Modern-Warfare-Initial-Intel-Detailing-Advancements-in-Animation-and-Authenticity
- Battlefield 6: seam and surface emitters listen to debris activation and explosion shockwaves and choose VFX by the object's visual material; the same parameters feed audio [READ] https://www.ea.com/en/news/how-battlefield-6-redefined-destruction
- Dark Water: realistic water was a focus, rain emitters in audio, PCSS soft shadows (Dark Water page above). Splash effects reused as boat effects elsewhere (same page).
- Muzzle flash specifics, tracer rendering, volumetric smoke implementation, decal systems, weather and colour grading in COD or BF6: no primary source found. The OIT talk and the volumetric impulse-response paper above are the closest.
- Battlefield 6 destruction VFX and the choreography of camera, audio and animation: a secondary article describes a DICE designer treating combat "as choreography" (a dancer-turned-designer) [READ-PARTIAL, opinion piece] https://finalboss.io/how-battlefield-6-quietly-used-choreography-to-make

## 2. Weapon handling and gun feel

### 2.1 Call of Duty (MW 2019) animation and feel
Source: Mark Grigsby (Animation Director) [READ] https://blog.activision.com/call-of-duty/2019-07/Modern-Warfare-Initial-Intel-Detailing-Advancements-in-Animation-and-Authenticity
- **Active Idle**: old idles swayed like on a ship's deck; new idle uses quick muscle micro-movements. Weapon is not "bolted to the camera": movement on stairs, head leads when looking and the gun follows.
- Weight by class and calibre: an LMG is stiffer than an assault rifle; reloads vary with weight and type, and mags are physically shown.
- **Staged reloads**: reload from empty (reload and rack) versus tactical reload (replace a partly used mag) are separate animations.
- **ADS reload**: the weapon stays on target while reloading when aiming down sights, instead of dropping off to the side.
- Navy SEAL advisors and firing-range sessions for animators.
- Scopes show slight magnification even at the hip; higher scopes use the tech team's lens work.
- Gunsmith: over 60 attachments across muzzle, barrel, underbarrel, laser, optic, stock, rear grip, magazine, with a cap of **5 attachments** so tuning is a trade-off between accuracy, damage, movement and aim speed [READ-PARTIAL] https://www.gamesradar.com/call-of-duty-modern-warfare-gunsmith-system
- Per-attachment effects (compensator vs muzzle brake, bipod strongest accuracy attachment only when crouched or prone) [SNIPPET, community guides].

### 2.2 Battlefield 6 gunplay: EA's own numbers
Source: EA "Battlefield Combat" post by Battlefield Studios (David Sirland, Florian Le Bihan) [READ] https://www.ea.com/en/games/battlefield/battlefield-6/news/bf-combat-gunplay (dated around Update 1.3.3.0, 30 June 2026)
- Three skills: aiming, **recoil compensation**, **weapon knowledge**.
- Recoil: a pass to make recoil direction "more consistent and predictable"; the SOR-556 MK2 is the example. Some variation kept so one gun is not the default choice.
- Bullet deviation: slightly increased after the first shot; rewards bursts and tap fire at range, full auto stays viable up close.
- Ballistics: muzzle velocity lowered for most weapons, especially SMGs; **increased drag makes bullets lose velocity and drop significantly past about 150 m**; medium range stays snappy.
- **Time to kill**: close-quarters benchmark **200 to 300 ms** for automatic primaries, similar to BF3 and BF4. They explain slowing it to 300 to 400 ms would make outnumbered fights nearly impossible.
- Damage multipliers: limbs and lower torso reduced for all classes except shotguns and sidearms (about one extra shot to kill), headshots slightly stronger on automatics.
- Ammo attachments: hollow point or synthetic tip raise the headshot multiplier to 1.50x or 1.75x (1.57x to 1.8x for automatics after the update) at the cost of penetration through destructible pieces and bodies. This is a **skill economy** using an Attachment Points budget.
- Snipers: each sniper rifle except the Mini Scout has a range "Sweet Spot" with extra lethal damage, shown by a rainbow-tinted glint; ranges were shortened.
- Archetypes: SMGs as mobility powerhouses, LMGs as "heavy position anchors".
- Online feel: a 60 Hz tick rate, no random bloom, burst rhythm [READ-PARTIAL, secondary] https://www.gfinityesports.com/article/how-battlefield-6s-new-movement-and-gunplay-actually-work

### 2.3 Battlefield 6 movement and stance (kinesthetic combat)
- Crouch-sprint, slide, roll, dive through windows; mounting weapons on walls and barriers stabilises recoil; drag-and-revive moves downed teammates behind cover; leaning around corners [READ-PARTIAL, secondary] https://www.gfinityesports.com/article/what-is-battlefield-6s-kinesthetic-combat-system and https://www.gamesradar.com/games/battlefield/battlefield-6s-new-revive-system-is-the-perfect-showcase-for-its-more-physical-combat-and-ive-fallen-in-love-with-dragging-teammates-around-like-meaty-potato-sacks
- Diving into cover gives a short invulnerability window [secondary Gfinity article only, treat as unverified].
- Revive details from EA help: dragging while reviving slows it; cancelling keeps progress; defibrillator is faster, a full charge returns full health and one charge can revive several; fatal headshots are not revivable [READ] https://help.ea.com/en/articles/battlefield/battlefield-6/class-guide/

### 2.4 Suppression, hit markers, audio feedback, ballistics in CoD
No primary source found for suppression visuals, hit-marker design or CoD bullet-velocity numbers. See section 9.

## 3. Tactical equipment (how each works; numbers only where published)

### Call of Duty Modern Warfare (2019) [READ-PARTIAL] https://gamesradar.com/get-to-know-your-equipment-loadout-in-call-of-duty-modern-warfare
- **Heartbeat sensor**: iPad-sized; pings a **180-degree arc** in front of the user and shows heartbeats and roughly which way people move; does not display objects; seen enemy on sensor is not instantly visible when you enter the room.
- **Snapshot grenade**: makes a brief 3D holographic image of the blast area and highlights enemies caught in it.
- **Decoy grenade**: gunfire sounds and fake radar signatures.
- **EMP drone**: remote-flown; EMP disables electronics in the area including minimaps and red-dot and holographic sights; also hits your team.
- **Semtex** (sticky explosive) and **Thermite** (sticky, burns "up to 4,000 degrees Fahrenheit for several seconds", blocks doorways).
- **Deployable cover**: a small bulletproof wall; weapons can mount on top; destructible.
- **Trophy system**: destroys up to three pieces of enemy equipment entering its perimeter.
- Flash blinds and deafens, stun slows movement and aiming; C4 sticks and is remote-detonated; claymore is a proximity mine; recon drone marks enemies [SNIPPET from a search summary of multiple guides; also https://mp1st.com/news/call-of-duty-modern-warfare-field-upgrades-and-equipment-tactical-lethal-complete-lists opened but not read in detail].

### Call of Duty MWII (2022)
- Heartbeat sensor runs on a battery charge; thermite is an adhesive incendiary that deals damage over time and obscures vision; proximity mines are best against vehicles; drill charge buries into surfaces before exploding [SNIPPET, https://www.ggrecon.com/guides/mw2-equipment-field-upgrades-perks/].

### Battlefield 6
- Assault: Adrenaline Injector (sprint boost, reduced explosive damage, resistance to flash and stun and to debuffs, hear footsteps) [READ] https://help.ea.com/en/articles/battlefield/battlefield-6/class-guide/ and https://www.pcgamer.com/games/fps/battlefield-6-classes ; grenade launcher for wall damage [READ] https://www.gamesradar.com/games/battlefield/battlefield-6-destruction/
- Engineer: repair torch, mines and rockets vs vehicles; Support: supply bag, defibrillator; Recon: **Motion Sensor** (detects and displays moving enemies, vehicles and gadgets nearby), Auto-Spot when ADS looking at hostiles, hold-breath sniping (EA help above); Recon C4 destroys walls (GamesRadar destruction page).
- Stun and flash grenades exist for Assault (MK141 Mod 0 stun, M84 flash) per a fan wiki [SNIPPET]; smoke clears spotted markers inside it [SNIPPET].
- No published blind durations, radii or damage for BF6 gadgets found. Breaching charges as a named gadget and claymores in BF6: not confirmed.

## 4. Destruction in Battlefield

Primary source: EA, "How Battlefield 6 redefined destruction" (Nov 2025) [READ] https://www.ea.com/en/news/how-battlefield-6-redefined-destruction ; secondary: GamesRadar guide [READ-PARTIAL] https://www.gamesradar.com/games/battlefield/battlefield-6-destruction/

What it says:
- **Goal**: "systemic and controlled": "a war-torn battlefield, not a moon landscape". Destruction results "stay", creating ruins and **level-designed debris piles** that reshape the space.
- **Chaos agents**: players and world assets (soldier impulse damage, ragdoll impulse, vehicle dynamics, persistent crashes) affect destruction.
- **Part-based destruction and debris spawning** were made extensible so destruction links to gameplay (damage to players beneath collapsing buildings, debris falling away more realistically). Frostbite reworked the **health transition system** so teams can attach custom processes (alter state, modify gameplay, spawn assets) on a health change.
- **Networking**: prioritisation and culling of part destruction and debris for 64-player matches; bandwidth optimised.
- **Seam and surface emitters** react to debris activation and shockwaves, using VFX by visual material; same parameters drive audio.
- Tools: debugging tools and editor changes to tweak destructible materials.
- Platform note: dropping old consoles helped (technical director quote, via TweakTown) [SNIPPET, the page itself returned almost no text].
- **"Tactical Destruction"** (GamesRadar): structures or parts collapse in consistent, repeatable ways when damaged enough, the same rubble every match, so players can learn it. You cannot level buildings; they reduce to a skeletal framework; some routes are indestructible to restrict vehicles; stairs and parts of upper floors can be indestructible (Iberian Offensive example); rubble can pile up to help climbing. Weapon tiers: grenades weak against structure; Recon C4 and Assault grenade launcher good for walls; Engineer RPGs and IFVs and tanks for buildings; every class can carry a sledgehammer for light demolition.
- Authoring details, memory and CPU budgets, and BF V or 2042 specifics: not found (the search returned only the BF6 article; EA confirms the destruction and physics teams have worked closely since BF 2042).

## 5. Audio design

Source: Stephen Miller (Audio Director, Infinity Ward) [READ] https://blog.activision.com/call-of-duty/2019-07/Modern-Warfare-Initial-Intel-Creating-an-Orchestra-of-Incredible-Audio-Effects-Weapon-Sounds-in-Call-of-Duty-Modern-Warfare
- Each weapon "must have its own unique voice", partly from operating system (gas piston, direct impingement, bolt action).
- Shell casings are audible in 3D space with physics before they hit the ground; "a nice thump to the chest" on firing.
- Recordings in the desert and other places with about **90 microphones per shot**, **20 for the player perspective**; separate hip and ADS perspectives.
- Three environment systems: (1) reverb and slap-delay DSP, (2) an atmospheric layer playing with every shot, (3) a **weapon reflection system**: the game finds where the sound will hit geometry and plays a specific sound at those locations, delayed at the speed of sound, so big spaces boom and confined spaces are muffled and dry; same applied to explosions.
- Each trigger pull layers about 12 or 13 simultaneous sounds [SNIPPET from search summary].
- MWII reportedly has an entirely new occlusion system and a new reverb engine [SNIPPET, https://sportskeeda.com/esports/3-audio-improvements-look-modern-warfare-2-new-reverb-engine-improved-3d-directionality ; not opened].
- Dark Water audio: hydrophone-microphone boat recordings, rain "emitters" placed through the mission (Dark Water page above).

## 6. Special-forces mission design

- **MW2019 "Clean House"**: a night raid on a townhouse where combatants and civilians look alike. Early versions started at street level with an APC and a house twice as big with three times the enemies, relying on cover-based AI; the team threw it out because it felt like standard Call of Duty. The final version has about **ten enemies**, tight stairs and rooms, and "virtually everything ... is unique to that particular location", with many custom animations and scripts [READ] https://vg247.pages.dev/posts/modern-warfare-s-clean-house-mission-was-originally-three-times-bigger (a mirror of VG247's report quoting Zeid Reike and Jacob Minkoff).
- **MW2019 "Going Dark"**: reviewers describe an open-ended night compound infiltration where you can explore and shoot out lights [SNIPPET, https://www.videogameschronicle.com/review/modern-warfare-2019/]. Separately, Drobot's lights-and-NVG remark (section 1.5) refers to the Townhouse (Clean House) mission, not Going Dark. No direct design write-up found for Going Dark. An IW AI-engineer dev-diary page (Jocelyn Chew) exists but returned no text.
- **MW2019 "The Wolf's Den"**: described by a guide as capturing "the Wolf" in tunnel networks with a cut-the-wire disarm mini-game [SNIPPET]; no design analysis found.
- **MWII "Dark Water"**: Infinity Ward's vertical-slice mission. First half, an oil-rig assault that "feels like Clean House: military guys doing military stuff"; second half, a ramp jump onto a moving cargo ship. The oil rig used footage of smaller rigs and advice from military consultants. The ship was ripped apart and rebuilt **at least four times bigger**; moving containers push the player and AI must path around them and react [READ] https://www.callofduty.com/blog/2022/08/call-of-duty-modern-warfare-II-dark-water-deep-dive
- **MWII "Alone", "Recon by Fire"**: no design material found.
- **AI behaviour (MWII)**: built with Navy SEAL input; enemies "preserving their lives", the player can "engage or disengage" so encounters vary [READ] https://www.gfinityesports.com/article/modern-warfare-2-ai-improvements
- Design insight from Clean House: shrink the space, cut enemy count, and invest in bespoke animation and scripting instead of generic cover AI.

## 7. Images (17 described, all viewed)

Source: Steam store screenshots from the Steam appdetails API. Battlefield 6 is app 2807960 https://store.steampowered.com/api/appdetails?appids=2807960 ; the Call of Duty HQ listing (app 1938090) https://store.steampowered.com/api/appdetails?appids=1938090 , whose screenshots are marketing for the current Call of Duty line, game version not stated. Descriptions are mine.

| # | URL | What it shows (viewed) |
|---|---|---|
| 1 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2807960/da4272c45a80ab463989f6b8f6a8f2d26d088732/ss_da4272c45a80ab463989f6b8f6a8f2d26d088732.1920x1080.jpg | BF6: desert canyon, a light attack helicopter over a wheeled armoured vehicle, bright blue sky, a fireball and dust trails, many tiny soldiers. Colour: warm dust against saturated sky. |
| 2 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2807960/d1760577af2328ae8a21a2b66760baddd0eba015/ss_d1760577af2328ae8a21a2b66760baddd0eba015.1920x1080.jpg | BF6: Las Vegas-style strip, infantry fighting vehicle, red smoke grenades, flying debris, palm trees, helicopter. Smoke is a saturated red accent. |
| 3 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2807960/539f35d16112e907d311b98ba01be7dd82806dd8/ss_539f35d16112e907d311b98ba01be7dd82806dd8.1920x1080.jpg | BF6: infantry advancing behind an armoured truck on a wet street; one hotel façade has a large hole, showing authored structural damage. |
| 4 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2807960/71f64c5dff4a8670180e0e361e762de8a2a32be3/ss_71f64c5dff4a8670180e0e361e762de8a2a32be3.1920x1080.jpg | BF6: soldiers at a Las Vegas sign amid fireballs and orange smoke; strong rim light and warm key. |
| 5 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2807960/e0c079e63b6a3373ce8dbbc68d7333750a1f5c9b/ss_e0c079e63b6a3373ce8dbbc68d7333750a1f5c9b.1920x1080.jpg | BF6: close view of helmeted operators with goggles in a dark interior, shallow depth of field, cool tones. |
| 6 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2807960/eb944cda3be9eafb4c989cd54a637842d8adafe6/ss_eb944cda3be9eafb4c989cd54a637842d8adafe6.1920x1080.jpg | BF6: a transport helicopter landing in tall grass, tanks, burning fires, smoke columns, pale overcast light. |
| 7 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2807960/cc983220f06f837ad4ab47e4a4c8ce7f3f5d8503/ss_cc983220f06f837ad4ab47e4a4c8ce7f3f5d8503.1920x1080.jpg | BF6: a soldier dragging a downed teammate through rubble, sparks and dust, shallow depth of field: the drag-revive. |
| 8 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2807960/db3fd546d56f039784876c0f232ce124218ba980/ss_db3fd546d56f039784876c0f232ce124218ba980.1920x1080.jpg | BF6: tank on a rubble pile, dust cloud and thrown debris, blue-grey light, ruined concrete. |
| 9 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1938090/ee5f6b6aebe4dc9e86b49c4e309d361b132df308/ss_ee5f6b6aebe4dc9e86b49c4e309d361b132df308.1920x1080.jpg | CoD: operator in a doorway with a burning building behind, orange firelight rim, sparks, rifle. |
| 10 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1938090/6b8f4040a1e923f036e04d9eb21ecb0f866be57e/ss_6b8f4040a1e923f036e04d9eb21ecb0f866be57e.1920x1080.jpg | CoD: close-up of a bearded face, wet skin, cool teal light; shows scanned-character skin detail. |
| 11 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1938090/10d6a60711209aa8019cedab4667532af49f5d2a/ss_10d6a60711209aa8019cedab4667532af49f5d2a.1920x1080.jpg | CoD: autumn forest, soldiers with NVG-mounted helmets, god rays through trees. |
| 12 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1938090/c487faffcf6ee3dab12f7973265fc0608c621275/ss_c487faffcf6ee3dab12f7973265fc0608c621275.1920x1080.jpg | CoD: canyon waterfall, a ghillie-suited operator and others splashing through water, wet reflections. |
| 13 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1938090/22eeb7b79a4053916a834d83330fe3934bd9650b/ss_22eeb7b79a4053916a834d83330fe3934bd9650b.1920x1080.jpg | CoD: desert wrecks (bus, pickup), a soldier with a launcher, dust. |
| 14 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1938090/3b091c0e1911b3b070baa3ae40471a9ec4a98ab7/ss_3b091c0e1911b3b070baa3ae40471a9ec4a98ab7.1920x1080.jpg | CoD: dim vehicle interior with two characters, low-key light. |
| 15 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1938090/ef9d52864b9713b4cab9a89229a5904479762ebe/ss_ef9d52864b9713b4cab9a89229a5904479762ebe.1920x1080.jpg | CoD: hooded figure with a rifle in a snowy town, strong depth of field. |
| 16 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1938090/e84101a7dbd98363f74472d8f00bdf6bdd12a1ad/ss_e84101a7dbd98363f74472d8f00bdf6bdd12a1ad.1920x1080.jpg | CoD: foggy facility at dusk with three silhouetted operators and a volumetric light shaft. Good low-light fog reference. |
| 17 | https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1938090/93aa0eac83c48c377f3468b3ba2991d88ac4acad/ss_93aa0eac83c48c377f3468b3ba2991d88ac4acad.1920x1080.jpg | CoD: gas-mask operator and a helicopter against bright sky, heavy kit detail. |

Note: I could not obtain MW2019 night-vision or thermal screenshots with a licence-clean URL. Activision's Dark Edition NVG product images were seen only as search results.

---

## 8. What our game should take from it (side-view, three.js, browser)

1. **Per-spectrum lighting for vision modes.** Give every light a visible colour and an `ir` intensity (and optionally `heat`). Night vision and thermal then re-render the same scene using the IR/heat channel instead of a green tint. In three.js, keep a second material parameter set (or a uniform) per emissive material and swap in a post pass. (Drobot interview, section 1.5.)
2. **IR-only information.** IR patches on friendly operators, IR laser sights and IR strobes on guards are invisible normally and glaring in NVG; guards with NVG see your IR patch. Gives a visible reason to carry NVG and a stealth counter-risk.
3. **Hot objects without bright light.** "Thermal emission" lights and hot engines/servers glow only in thermal; use for finding a guard room's recent activity (a just-stopped generator) as storytelling, as in the thermal drone example.
4. **Shoot-the-light.** Lights are destructible (and optionally switchable) and the shadow, visibility and NVG look all update correctly. Because the lights have per-spectrum values, darkness is a real gameplay tool, as in Townhouse. Implement lights as entities with health, a `ShadowMap`-free fake cone, and a light-grid visibility value used by guard vision.
5. **Old-device realism as a style knob.** Cheap NVG or drone feeds show blur, noise and compression blocks (the "Shittify" filter). Implement as optional shader passes (blur, chromatic, block quantisation on red and blue channels) on specific items such as a stolen drone camera.
6. **Weapons get their own lighting rig.** For a side-view hero, light the operative and gun with a dedicated rim and key rig independent of the world so the weapon's silhouette always reads (CoD uses separate weapon lighting).
7. **Material realism through measured values, cheaply.** Keep a small table of measured albedo/gloss/F0-style values per material (concrete, painted steel, rubber, glass, oiled metal) and reuse everywhere; clamp metals, avoid pure white or black albedo (the Reflectometer rationale).
8. **Close-detail tiling.** For hero surfaces the player sees up close (concrete, plaster, brick), add a second tiling detail normal map that fades in by distance (CoD's 64 ppi tiling).
9. **Layered periphery.** In side view use three depth layers: play plane, near-mid dressed set, far backdrop with fog (the far/mid/close periphery idea). Cheap sprites or low-poly cards for far.
10. **Staged weapon animation.** Separate tactical reload and empty reload animations (rack on empty), reload while aimed (ADS reload keeps the weapon on target), and weight classes (LMG slower and stiffer). In 2D: a reload that does not drop the aim cone is a strong feel boost.
11. **Active idle.** Idle breathing, micro-weight shifts and a slight lag between head/torso/weapon turns, not a looping sway. A few bones in a three.js skeletal rig with procedural noise.
12. **Predictable, learnable recoil pattern per gun** (BF6): store a recoil path per weapon as a fixed vector sequence plus small randomness; first shot accurate, deviation increases after the first shot, so tap and burst fire are rewarded. In side view the "pattern" is vertical climb plus slight horizontal drift on the aim line.
13. **Attachment budget.** Gunsmith-style slots with a point budget (BF6 Attachment Points; CoD's 5 attachments cap) where every pick has a trade-off: suppressor reduces noise but lowers velocity; hollow-point raises headshot damage but lowers penetration.
14. **Ballistics with drag.** Simulate bullets as projectiles for long shots, with velocity decay and drop beyond about 150 m in scaled game units, instant hit-scan below that (BF6 approach). Side view makes lead and drop easy to display with a faint tracer.
15. **Penetration by material.** Hollow-point vs armour-piercing choice maps to what a bullet passes through: thin wood and drywall yes, steel no. Needs a per-material penetration value and a damage falloff per layer. (BF6 penetration trade-off; numbers by material not published, so tune ourselves.)
16. **TTK tuning targets.** Aim for 200 to 300 ms effective kill time vs unaware or flanked targets for the player, so a 1-versus-2 flank is winnable, then slow average TTK with body-part multipliers (headshot highest; limbs lower). Use the same table for guards.
17. **Mounting and bracing.** Let the operative brace on cover edges or windowsills to cut recoil and spread, with a visible mount animation. In side view a "crouch behind low cover to mount" is trivial.
18. **Revive/drag analog.** A dragged downed ally or a hostage moved to cover before interaction; slows the move; cancel keeps progress. Useful for a hostage-extraction or injured-teammate objective.
19. **Equipment as information tools.** Heartbeat sensor (180 degree arc, shows only living things and facing, still needs line of sight to confirm), snapshot-style room scan (a hologram of positions that lasts seconds), motion sensor (only moving things), recon drone, decoy (gunfire noise and fake signals), EMP (disables guard optics and cameras but also your own gadgets), trophy-style countermeasures. Each has a battery or charge limit (MWII heartbeat sensor battery).
20. **Breaching hardware as authored traversal.** Thermite (burn through a door lock or vent grate over several seconds, noise-free but bright; blocks a doorway), C4 (remote-detonated wall breach with debris), drill charge (buried, quieter) are gated by a noise value and a destruction tier.
21. **Tiered destruction with rules.** Follow "systemic but controlled": limited breakable walls, fixed rubble outcomes, indestructible structural spine and key routes, debris piles that become cover or climb routes, sledgehammer for light demolition, explosives for walls, heavy ordnance for structure. Same rubble each time so players can learn and plan. In a 2D grid: breakable tiles with HP tiers and authored debris prefabs.
22. **Health-transition hooks.** Each destructible has states (intact, damaged, broken) and a hook per transition that can swap the model, spawn debris, play sound and VFX, and change AI nav (BF6 health-transition system). One data table drives mesh, particles, sound and pathing.
23. **Material-keyed FX and audio.** One "visual material" parameter set drives debris VFX and impact audio for every surface (BF6 seam and surface emitters). Concrete, glass, metal and wood each have a particle preset and a sound bank.
24. **Weapon sounds with environment reflection.** Cast a few rays from the shooter in the 2D level, find nearby wall distances and open space, and trigger reflection and tail samples accordingly (CoD's weapon reflection system). In Web Audio: a convolution reverb send per room type, a short slap-delay based on measured wall distance, and a dull low-pass in tight rooms.
25. **Layered gunshots.** Layer a close shot, mechanical action, shell ejection with a physical bounce sound, and a body "thump" cue per shot; separate player and third-person mixes. Keep a small sound bank per weapon "system".
26. **Occlusion.** Occlusion by walls and doors low-passes and attenuates; simple raycasts between listener and source in the 2D grid are enough. (MWII occlusion exists; implementation not published.)
27. **Mission structure: small spaces, bespoke beats.** As in Clean House: fewer enemies (about ten) with hand-authored behaviours and animations, tight spaces, and a civilian-versus-combatant ambiguity can beat generic cover shooters.
28. **Mission structure: two-phase set pieces.** Dark Water pairs a methodical assault with a vehicle set piece. For us: a quiet infiltration level followed by a loud extraction chase.
29. **Open-ended night compounds.** Going Dark style: a compound with multiple entries, light switches to shoot out, and objectives in any order; give each room two or three approaches (vent, door, window).
30. **AI that can be disengaged.** Guards that preserve their lives (take cover, retreat), allow the player to break contact, and do not repeat the same behaviour every run.
31. **Vision pipeline: tier visual realism, not only fidelity.** Prioritise readable silhouettes and a strict colour discipline for gameplay information (friend, foe, light, IR) before decoration; CoD treats "visual accuracy as critical for gameplay" in its transparency work (OIT abstract).
32. **Order-independent transparency for smoke.** Smoke, glass and particles overlap constantly; budget a cheap OIT approach (weighted blended OIT in three.js) so thick smoke grenades remain legible and do not pop. (Adaptive voxel OIT abstract.)
33. **Fixed shadow budget, scalable quality.** A fallback chain from real shadows to cheap contact shadows or blob shadows, within fixed memory, scaled by device (Shadows of Cold War approach). On the web: detect GPU tier and choose.
34. **Bake what is static, patch what is dynamic.** Bake lighting for static geometry into lightmaps or light probes, and apply runtime deltas for doors opening or lights shot out (UberBake idea, the "extend static baking with a few dynamic hooks" pattern).
35. **Lens and optics realism as flavour.** Scopes with slight magnification at the hip, lens distortion and vignette on NVG optics, and a hold-breath sway damper for sniper scenes in the side-view (zoomed) camera.

---

## 9. Could not verify / gaps

- No primary source found for: muzzle-flash and tracer rendering, smoke and dust simulation details, decal systems, weather, colour grading and camera effects in CoD or BF6. I only have the OIT abstract, the volumetric-media abstract and general FX statements.
- Suppression effects, hit-marker design, audio hit feedback and CoD bullet velocity and penetration numbers: no source read.
- Equipment numbers: no published durations, radii, damage for flashbang, stun, smoke, C4, claymore, thermite (beyond "4,000 degrees Fahrenheit for several seconds" and the 180-degree sensor arc), drones, breaching charges, heartbeat sensors in CoD or BF6. A fan wiki and a different game's wiki were seen in search results and deliberately not used.
- Whether BF6 has claymores or a named breaching charge: not confirmed.
- Digital Foundry pages themselves: none opened. All Digital Foundry content here comes through third-party summaries and is labelled SNIPPET. I did not reach the Eurogamer site (the search tool blocks it).
- SIGGRAPH Advances: I read course pages and abstracts for Frostbite (volumetrics 2015, GIBS 2024, Serac 2024) and Activision talks, but not the slides. The Frostbite volumetric PPTX (158 MB) and the Raytraced Shadows PDF (about 100 MB) were too large to read in this session. No Frostbite destruction talk was found in the Advances index.
- Frostbite details for BF V and BF 2042 destruction authoring, memory and CPU budgets: not found; only EA's BF6 article, which says the destruction and physics teams have worked closely since 2042.
- MW2019 "Going Dark" and "The Wolf's Den", MWII "Alone" and "Recon by Fire": no design write-ups found. Going Dark facts are from review snippets only.
- Jocelyn Chew's Infinity Ward AI dev-diary page returned no text.
- BF6 TweakTown destruction article: opened but returned almost no text.
- Dark Edition NVG, MWII occlusion and the 12 to 13 layered sounds per shot came from search snippets and were not verified on the page.
- Battlefield 6 and CoD numbers can change after patches; the BF6 gunplay numbers are for Update 1.3.3.0.
- Battlefield 6 "Aim Assist 2.0" (mentioned in an MP1st snippet), the 60 Hz tick rate and diving invulnerability appear only in secondary articles.

## 10. Full link list

Read in full or in part:
- https://blog.activision.com/call-of-duty/2019-06/Initial-Intel-Call-of-Duty-Modern-Warfares-game-engine-is-put-through-its-paces
- https://blog.activision.com/call-of-duty/2019-06/Initial-Intel-How-Photogrammetry-is-Helping-to-Shape-Call-of-Duty-Modern-Warfare-into-a-new-high-watermark-for-graphics-in-gaming
- https://blog.activision.com/call-of-duty/2019-07/Modern-Warfare-Initial-Intel-Detailing-Advancements-in-Animation-and-Authenticity
- https://blog.activision.com/call-of-duty/2019-07/Modern-Warfare-Initial-Intel-Creating-an-Orchestra-of-Incredible-Audio-Effects-Weapon-Sounds-in-Call-of-Duty-Modern-Warfare
- https://www.gamepressure.com/editorials/call-of-duty-modern-warfare-ready-for-next-gen-we-visited-infinit/spectral-rendering-night-time-revolution/z31a1
- https://www.callofduty.com/blog/2022/08/call-of-duty-modern-warfare-II-dark-water-deep-dive
- https://research.activision.com/publications (index) and the paper pages listed in section 1: /2024/11/Reflectometer_Material_Capture, /archives/material-advances-in-call-of-dutywwii, /archives/practical-multilayered-materials-in-call-of-dutyinfinite-warfare, /archives/real-world-measurements-for-call-of-dutyadvanced-warfare, /2020-03/separable-subsurface-scattering-expanded-technical-report, /2020-09/precomputed-lighting-advances-in-call-of-duty--modern-warfare, /2021/09/large-scale-global-illumination-in-call-of-duty, /2020-09/the-design-and-evolution-of-the-uberbake-light-baking-system, /2024/08/Neural_Light_Grid, /archives/volumetric-global-illumination-at-treyarch, /2019-07/impulse-responses-for-precomputing-light-from-volumetric-media, /2020-10/raytraced-shadows-in-call-of-duty--modern-warfare, /2021/10/shadows-of-cold-war--a-scalable-approach-to-shadowing, /2020-09/lima-oscar-delta--scaling-content-in-call-of-duty--modern-warfar, /2020-09/software-based-variable-rate-shading-in-call-of-duty--modern-war, /2026/adaptive-voxel-based-order-independent-transparency, /archives/hdr-in-call-of-duty, /2020-03/dynamic-temporal-antialiasing-and-upsampling-in-call-of-duty, /2020-11/controller-to-display-latency-in-call-of-duty, /2024/07/Caldera-Advances-in-Real-Time-Rendering
- https://www.activision.com/cdn/research/Reflectometer_Material_Capture.pdf
- https://www.activision.com/cdn/research/MaterialAdvancesInWWII.pdf
- https://advances.realtimerendering.com/s2015/index.html
- https://advances.realtimerendering.com/s2024/index.html
- https://ea.com/news/ea-technology-siggraph-2024
- https://www.ea.com/en/news/how-battlefield-6-redefined-destruction
- https://www.ea.com/en/games/battlefield/battlefield-6/news/bf-combat-gunplay
- https://help.ea.com/en/articles/battlefield/battlefield-6/class-guide/
- https://www.gamesradar.com/games/battlefield/battlefield-6-destruction/
- https://www.pcgamer.com/games/fps/battlefield-6-classes
- https://www.gfinityesports.com/article/what-is-battlefield-6s-kinesthetic-combat-system
- https://www.gfinityesports.com/article/how-battlefield-6s-new-movement-and-gunplay-actually-work
- https://www.gamesradar.com/games/battlefield/battlefield-6s-new-revive-system-is-the-perfect-showcase-for-its-more-physical-combat-and-ive-fallen-in-love-with-dragging-teammates-around-like-meaty-potato-sacks
- https://finalboss.io/how-battlefield-6-quietly-used-choreography-to-make
- https://gamesradar.com/get-to-know-your-equipment-loadout-in-call-of-duty-modern-warfare
- https://www.gamesradar.com/call-of-duty-modern-warfare-gunsmith-system
- https://vg247.pages.dev/posts/modern-warfare-s-clean-house-mission-was-originally-three-times-bigger
- https://www.gfinityesports.com/article/modern-warfare-2-ai-improvements
- https://store.steampowered.com/api/appdetails?appids=2807960 and https://store.steampowered.com/api/appdetails?appids=1938090

Seen as search snippets only (unverified):
- https://mp1st.com/news/call-of-duty-modern-warfare-field-upgrades-and-equipment-tactical-lethal-complete-lists
- https://www.ggrecon.com/guides/mw2-equipment-field-upgrades-perks/
- https://sportskeeda.com/esports/3-audio-improvements-look-modern-warfare-2-new-reverb-engine-improved-3d-directionality
- https://www.videogameschronicle.com/review/modern-warfare-2019/
- https://www.tweaktown.com/news/108149/battlefield-6-technical-director-unveils-the-magic-trick-for-next-gen-destruction/index.html
- https://www.purexbox.com/news/2025/10/digital-foundry-delivers-its-verdict-on-the-xbox-versions-of-battlefield-6
- https://nerdschalk.com/battlefield-6-beta-earns-rave-reviews-from-digital-foundry-a-technical-triumph-in-the-making/
- https://gameinformer.com/2019/08/26/the-impressive-new-tech-behind-call-of-duty-modern-warfare
- https://mp1st.com/news/battlefield-6-gadgets-list-for-all-classes-available-at-launch
- https://battlefield.fandom.com/wiki/Flashbang (fan wiki)
- https://newsroom.activisionblizzard.com/p/deep-talent-how-infinity-ward-brough
- https://infinityward.com/news/2020-04/DevDiary_JocelynC

Image URLs: section 7 (all from the Steam appdetails API URLs above).
