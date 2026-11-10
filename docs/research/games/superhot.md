# SUPERHOT / SUPERHOT VR / SUPERHOT: MIND CONTROL DELETE (Superhot Team) - reference for Orcfall Command

Research pass date: 2026-11-10. Inspiration only: mechanics and feel, never names, characters, art or levels.

Source labels: **[read]** opened and read; **[snippet]** only a search-result snippet, unverified; **[memory]** not found in a source, flagged.

Apps: SUPERHOT 322500 (25 Feb 2016), SUPERHOT: MIND CONTROL DELETE 690040 (16 Jul 2020; Early Access Dec 2017). SUPERHOT VR released late 2016 (Oculus Touch first), not on Steam under these two ids. Metacritic PC 82 (Superhot). [read: Wikipedia, Steam appdetails]

## 1. Origin and core loop

- Born in the 2013 7 Day FPS Challenge by a Lodz, Poland group (Blue Brick). Creative director Piotr Iwanicki. Inspirations named by him: the Flash game "Time4Cat" plus a music video; starting premise was "a turn-based FPS", boiled down to "time moves when you move FPS". [read: Game Developer/IndieGames interview, GamingBolt interview]
- The jam version "did one thing good and one thing only. It did the 'time moves as you move' well but it wasn't too good of a game." It exploded on YouTube and Greenlight; a Kickstarter asked $100k and about doubled it; the full game took about 2.5 years, 8 extra months on the first rebuild. [read: Game Developer interview, Steam "5 years old" post]
- Iwanicki: "We don't have any special device that slows time for 10s and then recharges for 30s. We weave the time control mechanism into the very fabric." "I don't think of SUPERHOT as a time-manipulation game. It's not a puzzler, it's not Braid. It's an action game that scales its pace to your skills." "Play at your own pace. Always on the edge of your skills. If the game is too slow for you and you feel safe - play faster. The action gets too hectic - stop to think and game stops with you." [read: both interviews]
- "In SUPERHOT you are the weapon." When out of bullets you throw the gun; paintings, TV sets and bottles are all usable. Best moments are improvisation; levels "give possibilities to inspire improvisation rather than require you to play exactly as we designed." [read: GamingBolt]
- Level philosophy: tight spaces where every wall corner counts; "starting level from the middle" of the scene: not a game about walking. They iterated the AI a lot and watched play. [read: GamingBolt]
- Design cut: GDC 2016 talk "Game Design and Mind Control": the game originally had large exploration sections; "When you're walking between bullets... it's a much different speed than moving in the context of the environment. So for [that] to be satisfying, the walking has to be quite slow. Our gameplay with just exploration was quite boring." They removed it. [read: PCGamesN coverage of the talk]
- Time rewind considered and rejected: it must be tightly integrated into the whole game ("adding time rewinding OR adding something else or polishing everything up"). [read: GamingBolt]

## 2. The exact time rule

Published description: time "progresses at normal speed only when the player moves or fires a gun, otherwise time is slowed"; looking around also advances time; the game "moves faster when they look around, move or shoot". Holding jump slows time so the player can plan an aerial gunfight. In VR only deliberate body movement advances time; head turns and small twitches do not. Developers: "it isn't a freeze... time doesn't stop when the player stands still; it just moves very leisurely"; scale follows motion magnitude. [read: Wikipedia; snippet: search summary of dev statements]

**Not published**: the idle time-scale (my recollection is a floor near 0.05 to 0.1 of real time), the curve from input magnitude to time scale, per-action costs, smoothing time constants. [memory, unverified] No dev or community source in this pass gave numbers; fan clones (itch.io, Godot/Unity tutorials) only describe approaches. Implementation hint from Unity docs-style sources: scaled time affects `deltaTime`, so UI, camera look and player input must use unscaled time. [snippet]

Observed design consequences (from the sources):
- One hit kills the player. Restart is instant and the level replays so failure is cheap. [read: Wikipedia]
- Enemy bullets leave a red trail that shows path and source, subtly letting the player identify the shooter. [read: Wikipedia citing The Verge]
- Enemies have awareness like the player and can dodge bullets; they do not auto-pickup; the player must press a pickup control, so weapon choice is deliberate. [read: Wikipedia]
- Sound stays loud in slow motion: "we prefer the silver roar of bullets flying right beside you... creative fiction provided by reverbs and other live processing effects". [read: Game Developer interview]

## 3. Weapons, enemies, bosses, structure

SUPERHOT (campaign about 31 levels, "as long as Portal"): pistol, assault rifle, shotgun (cut before release; players still email to bring it back), katana (can deflect bullets), thrown objects (bottles, billiard balls, ashtrays, etc.), punching; weapons have limited ammo and break; at the end of each level the player is forced to throw the gun away. Late campaign adds "hotswitch": jump into an enemy's body, previous body dies, cooldown, new body drops weapons. Endless mode; challenge mode with restrictions (time limit, specific weapon); replay editor and the Killstagram sharing site. [read: Wikipedia, Steam post, PCGamesN]

VR: levels are small spaces; after a wave you grab a floating object to teleport to a new area; "mindwave" telepathic kill replaces hotswitch; the team dropped the original teleport style for body presence on Touch controllers; they rewrote bullets, collision and enemies. [read: Wikipedia; snippet: UploadVR, Road to VR]

MIND CONTROL DELETE (roguelite):
- Map of text-mode nodes; each node is a sequence of consecutive maps; enemies spawn endlessly until you reach the required kill count; you have hearts (2 by default) and die back to the node start, losing run modifiers. Four floors, a glitched fifth, a post-game requiring a 2.5-hour data recovery "timer" and later the Pure core. [read: Wikipedia, Game Informer]
- Cores (chosen before a sequence): MORE (3rd heart), CHARGE (leap and punch), RECALL (thrown katana returns and slices), HOTSWITCH, plus EMPTY (post-game) and PURE (1 heart, no hacks). Each of Dog, Nindza, Addict bosses uses one core against you: invulnerable, appear randomly with a musical stab. [read: Wikipedia, ScreenRant, Game Informer]
- Hacks: pick one of two random every few maps; examples: bouncing bullets off walls, instant reload on kill, slow nearby bullets, faster movement, Headshot Flow (bullets hop from headshot to headshot), grenade-like "throwables become bullet-spawners", start with a katana, Super Punches (merged Iron Fist + Strong Punches), Mass Deflect, Lightning Reflexes; Deflect Bullets became a default ability in Beta 4. Devs cut under-powered hacks and added two for every one removed, merged hacks so choices are competitive. Some are "absolute duds" (e.g., kill by jumping on). [read: Steam Beta 4.0.0 post, Game Informer]
- Enemy variants added in early access devlogs: exploding mushroom hazards (a burst of bullets, "beautiful destruction with a puzzlish twist", later infected enemies that explode on contact or proximity), concrete enemies (only part vulnerable; hitting concrete stuns), glitched-weapon enemy (turns anything he holds red/unusable), shielded enemies with flying shields usable as cover, spiky enemies that explode into projectiles, weapons that dissolve on death. [read: Steam devlogs #7, #14, #15, Game Informer]
- Glitch barriers: planes popping up mid-level so known levels change; "cracks in the system" theme; behaviour-tree system for story unlocks. [read: Devlog #11, #6]
- Economy: Hot Coins unlock MODs per MIND; Ninja and Addict "MINDs" got intro dojo levels; early dev honesty: shipping updates for updates' sake produced a confusing, cluttered game, so they stopped and re-tested with fresh players. [read: Steam devlog 16, Skills Pay The Bills]
- Difficulty overhaul in Beta 4 improved flow; later critics: luck-driven hack draws; the 8-hour (some say 2.5-hour) post-game timer is a pain. [read: Game Informer]

## 4. Visual language

White world, red enemies, black items/weapons/player hands. Reasons from sources: small team could not make AAA assets, prototype time limit and scarce resources shaped it; the palette keeps threats and usable things legible instantly; post-process was used to make objects pop; chromatic aberration and a few non-red accents exist. "The player's mind does half of the work." [snippet: team interview via Killscreen, Kickstarter update; Wikipedia says white/grey environment, red enemies, black weapons] Faceted low-poly crystal red enemies shatter into glass-like shards (Killscreen: bullets "shatter" enemies). Menu shell is a fake DOS/ASCII OS (Omni-piOS), amber/white text on black.

## 5. Game feel

- Shatter-on-hit with red triangles, short yellow-white flash at the wound, enemy limbs thrown; bullet tracers as red lines with a black pointed slug; thrown gun spins; glass breaks in slow motion. [read: screenshots, Killscreen]
- Hit feedback: the takedown "didn't feel powerful enough" so they added the gun splatter. [read: Game Developer interview]
- Replay: after each level the whole run replays at full speed, the payoff for planning (Game Informer: "watching it back at normal speed shows just how awe-inspiring your moves are"). [read]
- Voiceover chant "SUPER HOT". Music: none during play in the base game (MCD adds some key-area music). [read: Steam post; Game Informer]

## 6. Screenshots (Steam CDN; all 16 viewed)

SUPERHOT:
1. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/322500/ss_ae4a994de7b15e3cec3e56ae714cf7a44c7188cf.1920x1080.jpg - Pale-blue white alley with AC units; a red enemy mid-shatter with a swarm of red triangles, second runner in the distance, black pistol viewmodel with a polygonal shard.
2. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/322500/ss_1e3ef7d9d9654c6189e6680502a0ce3068d1aef7.1920x1080.jpg - Chain-link cage; three red enemies in close combat, a black shotgun/club stuck in one, big black fist in foreground.
3. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/322500/ss_fbd718c60719f045e4e4ee1d23d159ecabb3a171.1920x1080.jpg - White office; five red bullet-trails with black tips converging from the left, a downed enemy, an enemy aiming.
4. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/322500/ss_7d2f3db42595a665912155fa44a9b65f807fd483.1920x1080.jpg - Black screen terminal "guruCHAT" in pale cyan monospace framed boxes (chat on the fake OS).
5. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/322500/ss_82e641a68d684effec7b1c9ad5d17a70f9cb82ea.1920x1080.jpg - Corridor; katana held low with enemies advancing, a red enemy shattering, one white bystander figure far down the hall.
6. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/322500/ss_98b769b11caf672fda92891b325c9a3525bff2d7.1920x1080.jpg - Narrow bright alley with fire escape; assault rifle muzzle flash lights the corridor; three red enemies and a burst of shards.
7. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/322500/ss_f027e1abfd94f4f84f9a0c7520a8238a5533b59b.1920x1080.jpg - Subway platform, headlamps of a white train, a ragdolled red enemy flying, black revolver foreground.
8. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/322500/ss_298fcbe1a5464113bfcd77c521b5318a76a31b40.1920x1080.jpg - Black "Omni-piOS" file-browser UI with red title bar, folder list (apps, demos, games, VR, art, videos) and an "INCOMING MESSAGE" dialog.

MIND CONTROL DELETE:
9. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/690040/ss_2aa74cc135fcc68fca7d18cbcf5233a73fd6fa25.1920x1080.jpg - Cluttered white workshop; many thin red arrows/bullets spraying, a thrown rifle sticking in an enemy, floppy-disk badge bottom-right.
10. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/690040/ss_3534fce79a0dc8899451a081c2c9deae674e9b7d.1920x1080.jpg - Katana mid-air, an open black hand blocking, red bullets littering the air.
11. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/690040/ss_ab67cbe1377e73eb7c0375f454c00d2f636cae3f.1920x1080.jpg - First-person throwing-star in foreground, enemy hit with pistol and a swarm of bullets; showing the new weapon types.
12. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/690040/ss_d1b37ceb67d8916a719fad1af842bc7a315dac00.1920x1080.jpg - Spiky "exploding" enemy variant bursting into red spikes; glass enemies, shield-less melee crowd.
13. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/690040/ss_dea8a97bdc43937547adcd95ed4b3fbc58f49c9c.1920x1080.jpg - "HACK-YOUR-MIND" menu: hex dump background, items wpnmstr.hack / 4HP.hack, description "Increased range and speed of melee weapons", hearts top-left.
14. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/690040/ss_3c90e79c0bca3e25793ec2d809fd599591baff8c.1920x1080.jpg - A punch landing on a large red enemy, white mannequin-like figures behind.
15. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/690040/ss_f7adb4dc3b1c88964e4a2caed5b4303eb5a5e711.1920x1080.jpg - Chaotic mid-fight: shotgun, handgun flung in the air, many shards and yellow-orange flashes, shotgun viewmodel.
16. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/690040/ss_b40a8807acf0ced77d27579f6b399d2d8180bb58.1920x1080.jpg - "SELECT-CORE" menu listing MORE, HOTSWITCH, RECALL, CHARGE (highlighted red) with description "Jump towards an enemy and punch them in the face"; a node graph; "press [Enter] to start".

## 7. Reception

Praise: "Braid of first-person shooters"; makes the shooter play like strategy; Polygon 9/10, GameSpot 8, IGN 7.5; John-Wick feeling; the pause-for-thought pace; MCD elevates it with a roguelike. Criticism: short campaign; "The Verge: narrative passable"; MCD luck-based hacks and duds, grindy enemy variants, long post-game wait; some reviews say MCD's combat is less puzzle-like. [read: Wikipedia, Game Informer; snippet: godisageek, gamingtrend]

## 8. What our game should take from it (adapted, original)

1. **Slow-mo as a resource-free, input-driven dial.** Our "occasional slow motion" should be a movement-scaled time factor, not a battery: idle is not zero but low, speed scales with input magnitude.
2. **Use unscaled time for aiming/UI.** Camera and cursor must stay responsive during slow motion; split a global `dt` from `playerDt`.
3. **Red/black/white equivalent for readability.** For the side-view game, tint hostile projectiles and guards with a single threat colour (our palette: warm amber/red) and make interactables (C4 spots, lockpick doors) a consistent contrasting tone; keep the rest muted.
4. **Bullet trails.** Show a faint tracer line behind enemy bullets so the source and path are readable at any time scale.
5. **Dodgeable projectiles.** Bullet speed in slow-mo is a few body-lengths per second; at normal speed make hits unavoidable without foresight, so slow-mo is "the tool for planning".
6. **Replay at normal speed after an objective.** Record player inputs/state and play back the infiltration at speed with a shareable clip: this is the reward loop and a marketing tool.
7. **Instant restart.** One hit kills; restart under one second with the same layout to support experiment-heavy play.
8. **Improvisation inventory.** Throwables and environment items double as weapons (empty gun thrown, fire extinguisher, chair).
9. **Explicit weapon pickup.** Do not auto-pick up; one button to grab; allows choosing C4 vs rocket vs rifle mid-fight.
10. **Start in the middle.** Open infiltration set-pieces mid-action in some missions rather than long approach walks. Cut slow traversal (Superhot removed walk exploration).
11. **Core + hack roguelite layer (optional).** Pre-run "core" (loadout archetype) and in-run pick-1-of-2 "mods" (bouncing bullets, instant reload on kill) for replayable heists; cap synergies and merge weak ones as MCD did.
12. **Enemy variants that alter the plan, not stats.** Armoured guard needs flanking, drone that jams radios, explosive guard, shield carrier whose shield can be borrowed as cover.
13. **Invulnerable stalker "boss" that uses your abilities.** A countermeasure squad leader that appears with an audio stab and must be evaded.
14. **Glitch/alert escalation of level state.** Alarm stages alter the same level (lights off, new reinforcements), echoing MCD's glitch barriers.
15. **Diegetic fake-OS menu.** Mission select as an in-world terminal; fits a hacking/infiltration theme and doubles as lore delivery.
16. **Slow-mo for jump/fall.** Parachute descent and a held-jump slow-motion window for aerial shooting (Superhot: holding jump slows time).
17. **Sound design in slow motion.** Keep gunfire loud, add low-pass/reverb on slowed audio rather than silence, as the devs did.
18. **Test with fresh players.** MCD's devs stopped shipping content and re-tested with unfamiliar players when the UI and flow were confusing; schedule early cold-playtests.
19. **Challenge modes.** No-restart, speedrun, single-weapon-only variants multiply content cheaply.
20. **Time-based stealth variant.** Sneaking at a crawl advances guard patrols slowly, letting players plan patrols; speed up when you sprint (a natural link between "quiet vs loud" and time).

## 9. Could not verify

- Time-scale minimum/curve, per-action costs, blend/smoothing, bullet speed numbers (none published).
- Enemy accuracy/AI numbers; weapon ammo counts; katana deflect rules.
- Full hack list and per-hack effects; core unlock details beyond the sources; the real length of the MCD end-game timer (sources say 2.5 hours in Wikipedia and ScreenRant, 8 hours in Game Informer; maybe patched).
- The team interview on visual style and the Kickstarter "making black and white pop" update: only seen as snippets (Killscreen, Reddit mirror not used).
- GDC talk video/slides content beyond PCGamesN's summary (GDC Vault page not opened).
- Voices of VR / Road to VR interview text (pages returned no body text).
- Superhot Fandom wiki (not attempted, same bot-block class).

## 10. Links

Read:
- https://store.steampowered.com/api/appdetails?appids=322500 and ?appids=690040
- https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=690040&count=60&maxlength=0 (devlogs 5-16, Beta 4.0.0 post, patch notes)
- https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=322500&count=40&maxlength=0 ("SUPERHOT is 5 years old")
- https://en.wikipedia.org/wiki/Superhot
- https://en.wikipedia.org/wiki/Superhot:_Mind_Control_Delete
- https://www.gamedeveloper.com/disciplines/the-origin-and-future-of-frozen-time-fps-hit-superhot-and-the-positive-crunching-behind-it
- https://gamingbolt.com/?p=224325
- https://gamedeveloper.com/design/video-game-design-and-mind-control-in-i-superhot-i- (GDC 2016 intro page)
- https://www.pcgamesn.com/superhot/superhot-exploration-was-cut-because-it-wasnt-fun-builds-narrative-around-the-cult-abusive-relationship-or-drug-of-mobile-games
- https://gameinformer.com/review/superhot-mind-control-delete/superhot-mind-control-delete-review-forward-motion
- https://screenrant.com/find-all-core-hacks-superhot-mind-control-delete/
- https://www.killscreen.com/superhot-wants-get-inside-your-brain-and-change-how-you-think.md (partial)

Snippet only:
- https://roadtovr.com/interview-superhot-vr-game-designer-joy-slow-motion-full-body-experience/, https://voicesofvr.com/?p=3928, https://voicesofvr.com/?p=821, https://uploadvr.com/superhot-dev-working-core-vr-experience/
- https://lr.eu.psf.lt/r/SUPERHOTbackers/comments/2tfaxd/friday_update_8_making_a_black_and_white_game_pop (Reddit mirror; not opened)
- https://godisageek.com/reviews/superhot-mind-control-delete-review/, https://gamingtrend.com/feature/reviews/random-hot-superhot-mind-control-delete-review/, https://www.windowscentral.com/superhot-dlc-mind-control-delete-review
- https://civetgamesstudio.itch.io/time-mechanic, https://dev.to/blaze_faisal/superhot-unity-developer-chaos-but-in-a-fun-way-4dpi (clones)
- Screenshots: the 16 URLs in section 6.
