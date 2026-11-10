# Gunplay and gun feel: research reference

Status of this pass: the network was partly open. Pages that could be opened and read are cited with URLs. The Fandom wikis (raze, razetwo, flashgaming), TV Tropes, Medium, YouTube (rate-limited) and archive.org could not be read in this session (403, DNS failure, or refused by the sandbox policy), so **no published Raze weapon stats were obtained**. Every claim below is tagged:

- **[read]** I opened the page and read the text cited.
- **[snippet]** seen only as a search-result summary, page not opened.
- **[memory]** my recollection of a well-known talk or book, **not verified this session**. Treat numbers marked this way as starting values to tune, not facts.

The earlier snippet-only pass is not in the repo (`docs/research/` held only `hazards.md`), so I could not diff against it; this file stands alone.

---

## Part 1. Raze and relatives

### 1.1 What is confirmed about the Raze series

| Topic | Finding | Tag | Source |
|---|---|---|---|
| Raze 2 controls | WASD or arrows to move, mouse to aim and shoot, Q/E cycle weapons, number keys select directly, F uses a special ability | [read] | https://www.jayisgames.com/review/raze-2.php |
| Raze 2 economy | Each round grants credits spent on upgrades, new abilities and items | [read] | same |
| Raze 2 modes | Kill-count or objective rounds, solo or with a partner; CTF-style levels exist; no online multiplayer; teammates hard to tell from enemies (reviewer complaint) | [read] | same |
| Raze 2 pace | "Fast, frenetic", "streamlined gameplay", heavy CPU load, many weapons and maps | [read] | same |
| Raze 2 kill feedback | Humorous kill messages (a shot to the butt is called out). A kill counter and killstreaks are central: players report streaks of 30+ and a "list" of streak awards to complete | [read] | same (review text and comments) |
| Raze 2 final-boss tuning | Last alien level: a Raze soldier must be killed six times in four minutes; roughly 3x the life of normal enemies; carries a rocket launcher that kills the player in two hits | [read] (player comment, not developer data) | same |
| Raze 2 perks mentioned | Ammo-regeneration perk; ability-recharge perk (70%); damage and rapid-fire powerups; a very high-DPS sniper rifle ("Holy Grail") that one-shots ordinary enemies | [read] (player comment) | same |
| Raze 2 weapon count | 35 weapons in seven categories (starter, sidearm, close range, automatic, long range, heavy) | [snippet] | razetwo.fandom.com file page, via search result |
| Raze 3 controls | Arrows or WASD, mouse to aim and shoot, F or Enter for a "rocket-repelling laser sword" | [read] | https://www.jayisgames.com/review/raze-3.php |
| Raze 3 structure | 15 campaign levels plus quick match; pistols, rocket launchers, laser swords; physics tag; thin story | [read] | same |
| Raze 3 upgrades | Per-weapon part customisation "to the minutest detail" (e.g. ergonomic grip on the pistol); reviewer says much of it is cosmetic-feeling | [read] | same |
| Raze 3 engine | A commenter says the first release was very glitchy and later patched | [read] | same |
| Authors | Raze 2 by AddisonR and Juice-Tin; Raze 3 by Sky9 Games | [read] | JiG pages above |

### 1.2 Strike Force Heroes (same team, "Raze not in space")

JiG calls it "Raze... NOT IN SPACE" and notes Juice-Tin co-created Raze. https://www.jayisgames.com/review/strike-force-heroes.php [read]

| Topic | Finding |
|---|---|
| Controls | WASD or arrows, mouse aim and shoot, two weapons chosen before each level and swapped with Shift |
| Classes | Medic, Commando, Assassin, Tank; each with strengths, weaknesses and special weapons. XP and cash from kills unlock weapons and abilities. Reviewer: classes not quite balanced |
| Kill-streak abilities | Activated with Ctrl or E after a sequence of kills without dying |
| Pickups | Ammo packs and health packs scattered through levels |
| Content | 65+ weapons; win conditions: team or individual kills, hold points for a time, capture flag, or beat a single juggernaut enemy |
| AI | Teammates "smart enough" not to fire into walls |
| Pacing note | Campaign difficulty takes a "leap" near the end |

### 1.3 Soldat (weapon mod docs)

The community wiki confirms **21 weapons** in three groups and that "weapons settings are modifiable by editing the file weapons.ini". The per-weapon wiki pages only carry flavour text, not numbers. https://wiki.soldat.pl/index.php/Weapons and per-weapon pages such as https://wiki.soldat.pl/index.php/Spas-12 [read]

Useful facts: two weapons carried (primary and secondary, or primary and primary); weapons can be thrown away and swapped; sniper rifle has an extended scoping view when crouched or prone and an optional "sniper line" aid; Desert Eagles fire two shots at a time (akimbo); MP5 is "fast and furious" at short range. The actual `weapons.ini` values (damage, timings, recoil, bullet speed) were **not** retrieved.

### 1.4 Not obtained

Plazma Burst 2 and Unreal Flash were not read (no accessible, relevant page found). See section "Could not verify".

### 1.5 Raze question checklist

| Question asked | Answer |
|---|---|
| Movement speeds, jump height, double jump, air control, wall interaction | **Not found.** Nothing in JiG says whether Raze has a double jump or wall interaction |
| Aiming (arm rotation, lasers, crosshair) | Mouse aim confirmed; arm rotation, laser sights and crosshair behaviour not documented in anything read |
| Weapon stats (damage, rate, mag, reload, accuracy, range) | **Not found.** Only "35 weapons" [snippet] and qualitative notes |
| Shields vs health, regeneration | **Not found** for Raze. SFH has health packs [read] |
| Abilities and equipment | Raze 2: F-key abilities with recharge, perks that speed recharge; Raze 3: laser sword that repels rockets; SFH: kill-streak abilities |
| Pickups and powerups | Raze 2 comments mention double damage and rapid fire powerups; SFH ammo and health packs |
| Kill feedback | Kill counter, streaks (30+ seen), humorous messages. An "announcer" is not confirmed |
| Bot behaviour | Not documented beyond SFH teammate note and complaint that Raze 2 teammates look like enemies |

---

## Part 2. Gun feel

### 2.1 The Art of Screenshake (Jan Willem Nijman, Control Conference, Nov 2013)

What was read: Game Developer's news item describes it as a ~45 minute talk in which Nijman "shows off a fairly dull side-scrolling shooter, then demonstrates 30 minor tweaks that each make the game a bit better", including shaking the screen slightly opposite to the player's fire direction and a 33% chance of enemies exploding harmlessly on death. https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games [read]. Kenney lists it as a 40-minute must-see. https://kenney.nl/knowledge-base/learning/must-see-videos-for-indie-developers [read]

A search result quoting a blog post says a single Nuclear Throne pistol shot kicks the camera 6 pixels from the aim point and adds 4 to the screenshake. [snippet] (original post not opened).

**No transcript or per-tweak write-up with numbers could be fetched.** The ordered list below is from memory of the talk and must be checked against the video before being treated as fact. [memory]

| Order (approx.) | Tweak | Notes recalled |
|---|---|---|
| 1 | Baseline: basic shooting, fixed fire rate | |
| 2 | Bullet size up, bullet speed up | big visible bullets read better |
| 3 | Fire-rate and accuracy variation | random spread so shots are not identical |
| 4 | Muzzle flash | one-frame sprite |
| 5 | Bullets have a hit effect, enemies flash white and are knocked back | |
| 6 | Enemy hit pause (a few frames of freeze) | |
| 7 | Permanence: casings and corpses stay on screen | |
| 8 | Camera kick opposite fire direction; then screenshake | |
| 9 | Player recoil and weapon sound variants | |
| 10 | Camera lerps ahead / toward the aim point | |
| 11 | Make enemies explode, add gibs and particles | |
| 12 | Screen shake and slow motion on kills; sleep frames | |
| 13 | Enemy and player acceleration/easing, more "impact" on hits | |

Takeaway that is **[memory]** but widely repeated: layered feedback, each tweak small, stacked; permanence (casings, blood, debris) matters; the biggest wins were camera kick plus hit pause plus sound.

### 2.2 Camera shake and the trauma model (Squirrel Eiserloh, GDC 2016 "Math for Game Programmers: Juicing Your Cameras With Maths")

The GDC Vault page could not be located (a guessed URL returned an unrelated talk) and searches returned nothing relevant. Details below are **[memory]**:

- Keep a single `trauma` value in 0..1. Events add to it (clamped); it decays linearly with time.
- Shake amount = `trauma^2` (or `^3`), so small hits give subtle shake and big ones are violent, and decay feels smooth.
- Offsets come from smooth noise (Perlin) rather than random per frame, for translation (x, y) and rotation (roll). Random per-frame values look jittery.
- Starting scales often quoted: max rotation about 10 to 15 degrees, max translation tens of pixels (about 100 in a 1080p example). These need tuning for this game.
- Prefer rotation plus translation together; for 2D side view keep roll small.

### 2.3 Juice it or Lose it (Martin Jonasson and Petri Purho, GDC Europe 2012)

Described by Kenney as "a juicy game feels alive and responds to everything the player does, tons of cascading actions and response for minimal user input" (15 minutes). https://kenney.nl/knowledge-base/learning/must-see-videos-for-indie-developers [read]. The specific steps (squash and stretch, tweened bat, particles on hit, shake, sounds, trailing) are **[memory]**; no numbers were verified.

### 2.4 Steve Swink, Game Feel

Wikipedia summary [read] https://en.wikipedia.org/wiki/Game_feel:

- Definition: "real-time control of virtual objects in a simulated space, with interactions emphasized by polish."
- Six areas: input, response, context, polish, metaphor, rules.
- Response is described with an ADSR envelope (attack, decay, sustain, release): a character that takes long to reach full speed feels loose or floaty; one that reaches it instantly feels tight.
- Seven principles (compared to animation principles): predictable results, instantaneous response, easy but deep, novelty, appealing response, organic motion, harmony.
- Polish has five types for portraying physical properties of an object, including tactile effects.

Swink's "100 ms" input-to-response guidance and the numbers in the book were not verified.

### 2.5 Screen-shake design guidance

A DEV Community post (opinion, not a numbers source) says: reserve strong shake for critical damage dealt or received, explosions, boss entrances; lighter shake for ordinary hits and pickups; **give players a shake slider and on/off toggle**. https://dev.to/dat_one_dev/the-art-of-screen-shake-33bi [read]

### 2.6 Game-specific feedback write-ups

Wikipedia's Nuclear Throne article [read] says critics praised its "tight gunplay" and "game feel", the game began as a jam prototype (Feb 2013), and was developed in public by Vlambeer. https://en.wikipedia.org/wiki/Nuclear_Throne. **No feedback-technique write-ups with numbers were retrieved** for Nuclear Throne, Enter the Gungeon, Hotline Miami, Dead Cells, My Friend Pedro or Superhot. Anything said about them in the recommendations below is my general knowledge, flagged as such.

---

## Could not verify

1. Any published Raze, Raze 2 or Raze 3 weapon stats (damage, rate, magazine, reload, accuracy, range). Fandom hosts were unreadable.
2. Raze movement numbers, double jump, air control, wall interaction, shield/health model, regeneration, announcer, bot AI.
3. Soldat `weapons.ini` values.
4. Plazma Burst 2 and Unreal Flash details.
5. The per-tweak order and numbers of The Art of Screenshake (video not transcribed), the exact Nuclear Throne pistol numbers (snippet only).
6. Eiserloh's exact exponents and scales, Jonasson and Purho's exact steps, Swink's exact timing thresholds.
7. Feedback write-ups for Gungeon, Hotline Miami, Dead Cells, My Friend Pedro, Superhot.

To close these: allow raze.fandom.com, razetwo.fandom.com, flashgaming.fandom.com and web.archive.org in the session network settings, and provide a transcript of the Screenshake talk (or its YouTube captions).

---

## Recommendations for this game

The game already has magazines, bloom on the crosshair, recoil kick, muzzle flash, tracers, casings, hit pause, trauma-style shake, look-ahead camera, slow motion and double jump (`src/game/guns.ts` has per-gun `kick`, `shake`, `bloomPerShot`, `magSize`, `reloadSeconds`; `hitPause(time, 0.06)` is used in `projectiles.ts` when a guard is hurt). Priorities below rest on the sourced points above plus general practice; none depends on unverified Raze numbers.

1. **Add a shake intensity slider and on/off toggle** in settings. Sourced guidance (DEV post), cheap, and protects players sensitive to motion. Also reduce-motion for the hit pause and slow motion.
2. **Verify shake is trauma-squared (or cubed) with smooth noise and a small roll**, not per-frame random. Tune per-gun `shake` so the pistol is nearly imperceptible and the sniper and shotgun clearly strong. This is the Eiserloh model [memory]; check the existing implementation against it.
3. **Kick the camera opposite the fire direction** on each shot (Nijman's confirmed tweak) in addition to random shake, scaled by the existing `kick`.
4. **Scale hit pause by outcome**: a few frames on a hit, a longer one on a kill or on a heavy weapon, none on every pistol tick, so the effect stays meaningful. Currently one fixed 0.06 s for guard hits.
5. **Kill feedback layer**: kill counter, streak counter with escalating audio and text, and a short slow-motion or shake spike on multi-kills. Raze 2 and Strike Force Heroes both centre on kill counts and streaks [read]; players report streaks of 30+.
6. **Permanence**: keep casings, blood, gibs and debris on screen for a long time (Nijman's permanence point [memory]), with a cap for performance.
7. **Hit confirmation on the target**: white flash and small knockback on enemies, plus a distinct hit sound and a crosshair tick, so every hit reads even when the target is off-centre. Add a short death burst on kills.
8. **Weapon swap and loadout like SFH**: two carried weapons with a quick swap key, and perks that affect reload or ability recharge (Raze 2 perks mentioned [read]) for progression without new weapons.
9. **Make weapon numbers data-driven in one table** (as Soldat does with `weapons.ini` [read]) so they can be tuned live, and add the missing per-weapon fields: fire rate, damage, range, recoil recovery, camera kick.
10. **Add a deflect or defensive ability** as Raze 3's laser sword does against rockets [read], if rockets are a threat; it gives skill expression beyond aiming.
11. **Collect real Raze data later**: once the Fandom wikis are reachable, fill the weapon stats, movement and shield/health sections and revisit these priorities.
