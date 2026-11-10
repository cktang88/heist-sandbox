# Broforce (Free Lives, 2015) - reference for Orcfall Command

Research pass date: 2026-11-10. Inspiration only: mechanics and feel, never names, characters, art or levels.

Source labels used below:
- **[read]** I opened and read the page.
- **[snippet]** I only saw a search-result snippet. Treat as unverified.
- **[memory]** Not found in a source this pass. Written from general knowledge, flagged so nobody treats it as fact.

Access note: both Broforce wikis (Fandom, wiki.gg) returned a bot block (Fandom: empty body, wiki.gg: Cloudflare challenge). I did not use mirrors or proxies to get around that. So per-bro stat tables, exact terrain HP tables and enemy stat tables are **not available** in this pass. See "Could not verify".

## 1. Core facts

- Developer Free Lives (Cape Town), publisher Devolver Digital, Unity engine. Began as "Rambros", a 48-hour Ludum Dare 23 entry (April 2012) that won first place for "fun". Early Access 7 Apr 2014, full release 15 Oct 2015, final free expansion "Broforce Forever" 8 Aug 2023. [read: Wikipedia, GamesBeat]
- Creative director Evan Greenwood. Three and a half years of development; sold over 1 million copies while still in Early Access and about $3M by May 2016. [read: OfferZen]
- Metacritic PC 83, IGN 8.8, PC Gamer 78. [read: Wikipedia]
- Steam description: up to four players, "dozens of different bros", Bro-Op and Deathmatch, "Explosion Run" time-attack levels with exploding terrain, "fully destructible everything", Exploding Red Barrels, level editor with sharing. [read: Steam appdetails]

## 2. Core loop and why it is fun (developer + critic statements)

Level template: get mission, kill bad guys, rescue caged prisoners, kill the big bad, raise the flag, helicopter out while the scenery explodes. RPS/PC Gamer review: "a plotline now so mechanical, that Free Lives went ahead and turned it into a mechanic." [read: PC Gamer review via Steam news]

Developer statements (all [read]):
- Greenwood, GamingBolt Jan 2015: "terrain destruction was never meant to produce any extra strategic depth. Terrain destruction was implemented entirely because it feels badass and that suited the theme... emergent strategies... was a wonderful side effect. I think what caused this effect to be so pronounced was our focus on chain reactions. It's actually really hard to destroy just one block of terrain in Broforce, and we try to build levels that are poised to self destruct, and that encourages players to think about pulling the trigger."
- Same interview: "enemies almost never approach you. At any time you can hang back and try figure out the ultimate infiltration strategy." Caution is nearly always easier, yet "players don't tend to be cautious. There seems to be a tension between reliving one's murderous action hero fantasies and not being killed oneself." The mooks are "pretty incompetent".
- Greenwood, Game Developer Apr 2014: "designer ego vs. player agency... freedom of expression is more important than curating the experience." Difficulty is "situated in the player's tactical choices and their caution"; "very few enemies actually engage with you until you cause a ruckus around them. This might be 'stealth' in another game, but in Broforce, it's a way for players to not be overwhelmed." They give "a lot of lives, checkpoints and other boosts".
- GamesBeat Aug 2014: "The lucky packet nature of Broforce minimizes the need for balance. When you randomly get the exact best bro for the task... can be a lot of fun, but you can also get the exact worst bro... it adds to the challenge." On soft-lock: "We try not to put anything in the game that forces players to play the level in a certain way. Destroying a level to the point of being incomplete-able isn't in their interest, so we'd rather they learn that for themselves." Some levels last as little as 20 seconds. Old bros are revisited to stay relevant; ideas come from random conversations (example: the TNT-thrower's TNT now sticks to enemy faces).
- OfferZen 2017: constant open build-and-feedback loop. "If people say 'This is cool', you should probably stop working on it" - the signal is people wanting an hour-long conversation about it. Ruan Rothmann/Greenwood style prototype testing with the public from the first jam build.
- Forever update post (Steam, 2023): they tried procedural levels and a roguelite spin-off; "the ideas were bad and the execution worse" and were scavenged into a campaign refresh. Useful honesty: procedural generation was tried for a destruction game and abandoned.

Critics: Waltorious (blog) says two central ideas make it work: the roster with forced random bro switching, and block-based destructible terrain with chain reactions; "ladders... are never destroyed, so even when everything else is gone bros can still get to the end"; one hit kills; Hard mode makes enemies fast to fire, turning it into a stealth game; Ironbro mode. [read] PC Gamer review: co-op is a spectacle but "easy to lose track of your character... collapsing a bridge on all your friends' heads"; levels reuse jungle and enemies, "fatigue sets in quickly". [read]

## 3. Movement [mostly unavailable as numbers]

Published facts:
- Every bro can climb any surface (wall-cling climbing) infinitely, per PC Gamer review; Waltorious: "Every bro can climb walls." [read]
- Double-tap a direction to dash/run faster and jump farther (not explained in-game; a keyboard Dash key was added in the Jan 2019 patch). [read: Waltorious, Steam changelog]
- Bros differ in movement speed, jump height and backup melee. [read: Waltorious]
- Ladders are indestructible; zip lines exist; scaffolding, lifts and diagonal elevators exist. [read]
- Pixel speeds, gravity, jump height, coyote time: **not published**. [memory] The feel is fast, floaty-snappy with strong air control and wall-climb replacing wall-jump; I could not confirm numbers.

## 4. Combat and weapons

Structure (all bros): primary weapon, a limited-ammo special, a melee, plus drops from ammo crates that refill specials. [read: Waltorious, PC Gamer, Steam news]. One-hit death. Caged prisoners = extra life and a forced random bro switch. Roster size: 23 bros Aug 2014 [GamesBeat], 35 by 2018 [Waltorious], plus six added by Forever in 2023 [Steam news].

Archetypes seen in sources (names are Free Lives' parodies; do not copy):
- Machine gun + grenade (starter). [snippet via wiki search]
- Shotgun + muscle enhancer; sawed-off shotgun + chainsaw; boomerang that must be picked up (ammo crate allows holding several); chakram that can stack; minigun leap (fires behind you to launch); harpoon that can be charged to travel farther and pierce; TNT thrower whose TNT sticks to enemy faces; sniper that is a one-shot "tiny rifle" with a row of bullet-icons for ammo; green targeting-matrix special that marks and kills; rifle-leg that doubles as a jetpack; summon a tank (several tanks if several ammo crates); hologram decoy grenade; ranged "stake throwing" self-resurrecting slayer; dual shotguns plus a mind-effect; acid-spitting ceiling-climber with explosive teleport; bouncing bomb and freeze grenade. [read: PC Gamer review, Steam news; snippet: wiki entries]
- Some bros' main weapon is melee and the melee button hides a strong special. [read: Waltorious]
- Mechanical design insight: ammo icons communicate behaviour (a neat row of bullets means one-shot kills). [read: PC Gamer review]

Enemies ("mooks") and behaviours:
- Masked soldiers are largely passive until alerted ("incompetent"). A lookout with binoculars runs around shouting the group name and alerts everyone. [read: Waltorious]
- Suicide mooks explode when hit or when they reach you; kamikaze mooks detonate on hitting the ground so they can be thrown as projectiles; stunned enemies take no action. [snippet]
- Alien facehugger-like enemies kill mooks and turn into xeno-like enemies, i.e. enemy-versus-enemy interactions. [read: PC Gamer review]
- Terrain-type enemies: Bone Wurm 125 HP, Acid Crawler 150 HP, Terrorkrawler boss 600 HP. [snippet - unverified]
- Forever additions: motorbike maniacs that ram or explode, large machine-gun placements, blimps carrying troops and bazooka users, barbed wire and sandbags in cities. [read: Steam news]
- Bosses: end-of-level devil/big-bad, helicopter boss, mook-launcher boss (tuned harder in a patch), Satan with a true form whose laser can destroy his own legs. [read: Steam changelogs]. Solo play with an unlucky bro can make bosses "close to impossible". [read: PC Gamer]
- Traps: spikes, mine fields, saw blades, quicksand. [snippet]

Friendly fire: there is no friendly fire between bros in co-op, but terrain collapse and explosions still harm or strand allies, which is the main griefing vector. [read: PC Gamer review says "even without friendly fire"]. Deathmatch modes exist and bros are loosely balanced there. [read: GamesBeat]

## 5. Destruction systems

What is sourced:
- Levels are built from blocks, nearly all destructible if they take enough damage from weapons or explosions. [read: Waltorious, GameDeveloper]
- Even a whip can destroy terrain; players often carve under footpaths rather than use them. [read: PC Gamer review]
- Exploding red barrels and propane tanks (a propane tank "rockets across that pit and explodes"), bridges that tumble, giant vehicles that fall from the sky, blocks and barrels you can push off ledges. [read: Waltorious, RPS; snippet]
- Chain reactions are the design focus: "really hard to destroy just one block." [read: Greenwood]
- Dirt about 5 HP, rock about 12 HP. [snippet - unverified]
- Soft-lock prevention: indestructible ladders, bros climb any surface, a very generous checkpoint/lives system, and level start states that always have an exit route; Free Lives explicitly will not force a route but lets players trap themselves. [read: Waltorious, GamesBeat]
- Hard-mode and custom levels can force hard enemy settings; tiles "reset correctly" on restart (bug note), so the map is stored as a restorable tile grid. [read: Steam changelogs]
- Performance: repeated notes on frame-rate and load-time optimisation, install size cut from 1.45 GB to 500 MB (Jan 2019); Unity engine. Chain-link destruction needed network sync; terrain tiles needed resetting. [read: Steam changelogs]
- Developer talk on the destruction tech (data structure, falling-block flood fill, debris pooling): **not found**. [memory, flagged unverified] The grid-of-blocks model with each block having HP and a "support" check is what the visible behaviour implies, but it is an inference.

## 6. Game feel

[read] sources are thin here. RPS: enemies "bounce, bleed and bellow as they perish in a fountain of red pixels"; explosions send enemies flailing and running around with arms waving; bad guys scream. The Steam changelog confirms: gore/gib effects per enemy type, "new and improved fireballs", controller rumble option, fire and napalm, a sound designer (Jason Sutherland) joined in 2016 and added "a LOT" of sounds, trailer music "Ballad of Rambro" by Deon van Heerden. Pausing the game when the menu opens is explicit so you cannot die in cutscenes. Hit-pause length, shake magnitudes: **not published**. [memory: strong screen shake and slow-mo on boss kills; unverified]

Death and respawn pacing: die with a prisoner life left and you respawn at the last checkpoint as a new random bro; with none left the level restarts. Levels can be as short as 20 seconds. [read: Waltorious, GamesBeat]

## 7. Level design, modes, progression, co-op

- Campaign is a helicopter world map of country-like islands; each level ends with flag + helicopter or lift. Covert Operations missions star specific bros and unlock specific unlocks. Muscle Temples (Forever) unlock "flexes". [read]
- Normal vs Hard (enemies fire faster), Ironbro (limited squad, permadeath-style), Arcade levels, Custom campaigns and a level editor with online sharing, Explosion Run time attack, Race, Deathmatch/Versus ("Brodowns"), co-op up to 4. [read]
- Unlock rule: cumulative prisoner rescues (even in failed attempts) unlock new bros, so failure also progresses. Waltorious notes this can unlock bros earlier for strugglers. [read]
- Difficulty curve: easy early levels teach blasting; later levels have foes that are hard to hit directly so the level steers you toward collapsing terrain around them. [read: Waltorious]
- Custom levels: users report that more "Mega Man"-style authored levels were wanted. [snippet: r/gamedev AMA]

## 8. Graphics and art direction

Pixel art, chunky readable tiles, heavy colour-grading per biome: saturated jungle blue-green, orange hell sky, olive/grey swamp, beige industrial dusk. Background parallax layers are desaturated so the foreground silhouette reads. Alert bubbles ("!", "?") above enemies and a "SAVE" bubble over cages; American flag speech bubbles over the player. Sprite size: characters look about 16 to 24 px tall against 8 px-ish tiles in the screenshots (my estimate from the images; unpublished). UI: tiny HUD in lower-left with portrait, grenade/special pips, "LIVES n".

Screenshots (Steam CDN, URLs below; I downloaded and viewed all 8):
1. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/274190/ss_b77d3d5ba767df4b2d58017804331e90a7ae4eaa.1920x1080.jpg - Jungle blue palette: grassy dirt blocks, wooden bridge burning mid-explosion, orange fireball with pixel debris, alert "!" over mooks, a propane tank bottom-left, a red barrel on the right, a ladder.
2. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/274190/ss_700cda119dab1d0333b8d91771cf216ac7f8cafa.1920x1080.jpg - Orange dusk temple level: caged prisoners hanging on chains, big blood splatter, hero mid-jump, tracer bullets, "LIVES 1" HUD with grenade pips.
3. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/274190/ss_bda2885ff80a5e383e287270680b0d9d420685ef.1920x1080.jpg - Teal pine-forest base: stone bunker with windows, three saw-blade traps, "SAVE" bubble on a cage, a heavy brute with "!" alert, flag bubble over the hero.
4. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/274190/ss_c1963fe76c883f40f8d0c53827dd0c194a9a4a6e.1920x1080.jpg - Grey-green misty valley: tower with ladders on the right, US flag on the left as checkpoint, red barrels, fire explosion chain on a grass block, a bro flying with rocket pack.
5. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/274190/ss_973dd48d209d4e457ff5845c8067e675f554edd5.1920x1080.jpg - Daytime pine forest: a flaming missile falling diagonally, a truck, a watchtower with enemies on a flat roof, bridge truss, ladders.
6. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/274190/ss_d11ef17ce48cea603c0305029e7c4b5c4be70a27.1920x1080.jpg - Hellish orange sky: burning palms, big red-barrelled artillery/turret boss firing black bombs, two "SAVE" cages in an underground chamber, ladder shaft.
7. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/274190/ss_85875cdc49ba2afdc817ee9e4c49adacd292f027.1920x1080.jpg - Olive-green ruined gothic fortress: black smoke column, grating windows, flame, a hanging cage, a silhouette boss on top, ammo crate on floor.
8. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/274190/ss_15ff1ae65eed272efe2a0435690457e5f93aaced.1920x1080.jpg - Beige-brown industrial three-storey building: cross-section showing rooms, ladders, crates and cages inside; red and black barrels on rooftop; desaturated refinery tower in the background.

## 9. Reception

Praise: IGN "a brilliant ode to action cinema and retro gaming"; The Escapist 4.5/5 "silly, but sincere love letter"; RPS "Broforce is excellent"; roster-as-1-up system, chain reactions, readability of character kits via film knowledge. Criticism: repetitive biome and enemy reuse, co-op chaos and griefing, solo bosses with bad bro draws, unclear mechanics (double-tap dash, hidden melee specials, covert-op gating), jingoism satire "without much bite" (Waltorious), early bros like the whip hero unpopular and reworked. [read]

## 10. What our game should take from it (adapted, original)

1. **Block-grid destruction with HP tiers.** Orcfall uses small cubes/blocks with 3-4 material tiers (plaster, brick, concrete, reinforced) with distinct HP and debris colours; explosives do area damage per tile.
2. **Level pieces "poised to self-destruct".** Place fuel drums, gas lines, ceiling-mounted tanks above guard posts; make a single shot trigger a visible cascade, as Free Lives does.
3. **Never destroy the traversal skeleton.** Keep service ladders, vent shafts and structural cores indestructible (or very high HP) and let the operative climb any vertical surface so the infiltration can always continue; adapt to a "load-bearing core" rule.
4. **Passive-until-provoked guards as the difficulty dial.** Guards ignore you until noise, line-of-sight or an explosion; Hard mode shortens reaction time. This unifies stealth and loud play.
5. **One-hit lethality with forgiving lives/checkpoints.** Low HP for the player, many checkpoints (pylon-style relay beacons) so lethality is fun, not punishing.
6. **Chain-reaction scoring and readability.** Show brief icon pop-ups ("!" / "?") over guards for alert state, and a kill-chain counter.
7. **Loadout variety via limited specials.** Keep primary weapon unlimited-ish, specials (C4, rocket, drone, flare) limited and refilled from crates; ammo-icon shape tells behaviour (rows of bullets = precise).
8. **Random "lucky packet" gear drops for replay.** Optional "chaos mode" where the operative's loadout is rolled each checkpoint, which minimises balance work, per Greenwood.
9. **Dead-simple indestructible-exit check.** Run a flood-fill from the extraction zone on level load to ensure at least one non-destroyable route exists; show a "route integrity" debug overlay in the editor.
10. **Enemy-vs-enemy and enemy-as-projectile physics.** Let explosions throw guards and let a thrown explosive guard detonate near others; unstable carriers (barrel carriers) behave as projectiles.
11. **Camera pulls back for chaos and focuses on the player.** Zoom to fit co-op or explosion bursts, maintain player visibility with silhouette outline through debris.
12. **Cheap gore and debris pooling.** Particle pools with a hard cap, dim older debris; Free Lives spent updates on performance and install size, so budget early.
13. **Time-attack "Explosion Run" mode.** A timed extraction under collapsing terrain with a rising danger, a natural fit for loud extraction.
14. **Level editor and share codes.** Ship the same grid editor used in-house as a player tool; it also gives a content pipeline.
15. **Boss kits that demand terrain play.** Large armoured targets resistant to direct fire but weak to collapsing a floor or detonating tanks, steering players toward destruction (Waltorious).
16. **Tools hidden in secondary buttons.** Give melee/utility a second function (breach, lockpick-kick), but surface it in tooltips to avoid Broforce's hidden-mechanic complaint.
17. **Fail-forward progression.** Count progress for attempts too: partial intel/credits earned even on failed missions.
18. **Short levels as palate cleansers.** Mix 20-second micro-infiltrations with long ones.
19. **Sound before spectacle.** Add layered explosion audio and distinct enemy alert barks early; a dedicated sound pass lifted Broforce markedly.
20. **Resist procedural-everything.** Free Lives abandoned procedural levels; hand-built set pieces with variable spawns are safer.

## 11. Could not verify

- Per-bro stat tables, fire rates, damage values, magazine sizes (wikis blocked).
- Terrain HP table beyond a snippet (dirt 5, rock 12); full tile list (steel, scaffolding 1-6, hay, wood, etc.); how falling blocks and support work; explosion radius; propane tank behaviour numbers.
- Movement numbers (speed, jump height, dash multiplier, climb speed).
- Any GDC/postmortem talk on the destruction tech (none found; searched Game Developer, GDC Vault).
- Screen shake, hit-pause timing.
- r/gamedev "Broforce developer AMA" (Oct 2015): only seen as snippets via search; Reddit mirrors were not used.
- Polygon 2013 interview (page 404 now); Eurogamer 2012 demo preview not re-read; PC Gamer early access review not read.
- Level editor guide (yekbot) 404.

## 12. Links

Read:
- https://store.steampowered.com/api/appdetails?appids=274190
- https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=274190&count=50&maxlength=0 (PC Gamer and RPS reviews, changelogs, Forever post)
- https://en.wikipedia.org/wiki/Broforce
- https://gamedeveloper.com/design/designer-ego-vs-player-agency-in-i-broforce-i-
- https://gamingbolt.com/broforce-interview-developing-a-badass-action-hero-style-video-game
- https://gamesbeat.com/broforce-interview/
- https://www.offerzen.com/blog/a-jury-of-peers-how-independent-game-developers-depend-on-feedback
- https://makegamessa.com/discussion/comment/49189/
- https://waltoriouswritesaboutgames.com/2018/07/29/the-joyous-destruction-of-broforce/
- https://www.rockpapershotgun.com/no-emotions-just-explosions-broforce
- https://8bithorse.blogspot.com/2014/05/broforce.html
- https://www.pcgamer.com/broforce-review/ (review text read via Steam news feed)

Snippet only:
- https://broforce.fandom.com/wiki/Broforce, https://broforce.fandom.com/wiki/Trap (blocked)
- https://www.233leyuan.com/post-detail/2022702436990496768 (HP numbers mirror)
- https://www.speedrun.com/broforce/guides/wndfj
- https://robotsoverdinosaurs.net/?p=889, https://www.gamingonlinux.com/2019/01/broforce-possibly-the-best-action-platformer-ever-is-still-being-updated
- https://igf.com/broforce
- https://www.theouterhaven.net/2014/04/catching-up-ruan-rothmann-from-the-team-behind-broforce-at-pax-east-2014 (404)
- Screenshots: the 8 URLs in section 8 (and Steam page https://store.steampowered.com/app/274190).
