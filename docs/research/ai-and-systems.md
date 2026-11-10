# Guard AI, systemic design and long-term fun: research and recommended design

Scope: stealth AI (Part 1), systemic / immersive-sim design (Part 2), what keeps this kind of game fun (Part 3), then a concrete recommended design for this game (Part 4).

## 0. How well sourced this is (read first)

This pass **opened and read** the pages below (via `curl` plus `pdftotext`, because the WebFetch tool has its own host allowlist and failed with ENOTFOUND on every host; the shell reaches them through the proxy). Where a claim is marked **[Read]** I read the text of the page. **[Snippet]** means I only have a search-result summary, not the page. **[Suggested]** means our own starting value, not from any source.

Primary pages actually read in full or in the relevant part:

| Short name | What it is | URL |
|---|---|---|
| Ninja (Miles) | Game AI Pro ch.32, "How to Catch a Ninja: NPC Awareness in a 2D Stealth Platformer" (Mark of the Ninja) | https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter32_How_to_Catch_a_Ninja_NPC_Awareness_in_a_2D_Stealth_Platformer.pdf |
| SC Blacklist (Walsh) | Game AI Pro 2 ch.28, "Modeling Perception and Awareness in Tom Clancy's Splinter Cell Blacklist" | https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter28_Modeling_Perception_and_Awareness_in_Tom_Clancy's_Splinter_Cell_Blacklist.pdf |
| Days Gone (Karlsson) | Game AI Pro Online 2021 ch.12, "Squad Coordination in Days Gone" | https://www.gameaipro.com/GameAIProOnlineEdition2021/GameAIProOnlineEdition2021_Chapter12_Squad_Coordination_in_Days_Gone.pdf |
| Orkin | "Three States and a Plan: The A.I. of F.E.A.R." (GDC 2006) | https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf |
| Thief sensory (Leonard) | "Building an AI Sensory System: Examining the Design of Thief: The Dark Project" (Game Developer / Gamasutra) | https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i- |
| MotN five rules | "Mark of the Ninja's five stealth design rules" (Nels Anderson talk coverage, 2012) | https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules |
| MGSV failure spectrum | PC Gamer, "Metal Gear Solid 5's failure spectrum" | https://www.pcgamer.com/metal-gear-solids-failure-spectrum |
| MGSV alert states | gamepressure.com guide, "MGS 5 The Phantom Pain: Enemies' states of alert" | https://www.gamepressure.com/mgs5thephantompain/enemies-states-of-alert/z27b18 |
| Alien Isolation | Game Developer write-up of Andy Bray's nucl.ai 2016 talk (secondhand) | https://www.gamedeveloper.com/design/the-perfect-organism-the-ai-of-alien-isolation |
| Hitman hands-on | PC Gamer Hitman (2016) hands-on quoting IOI's Hannes Seifert | https://pcgamer.com/trying-to-break-the-largest-level-in-hitman-history |
| Harvey Smith OUD | Slides, "Orthogonal Unit Differentiation" (Harvey Smith, Ion Storm) | https://slidetodoc.com/orthogonal-unit-differentiation-harvey-smith-witchboyionstorm-com-intro/ |
| Systemic LD notes | A student's blog notes on Harvey Smith's GDC talk "Systemic level design for emergent play" (2008) | https://requiem-for-games.blogspot.com/2008/02/systemic-level-design-for-emergent-play.html |
| BotW chemistry | Thumbsticks write-up of Takuhiro Dohta's GDC 2017 talk | https://www.thumbsticks.com/gdc-17-breath-of-the-wild-science-lies |
| Noita | 80.lv write-up of Nolla Games' technical talk | https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/ |
| Immersive sim | Wikipedia, "Immersive sim" (quotes Spector, Harvey Smith) | https://en.wikipedia.org/wiki/Immersive_sim |
| Meier | Game Developer coverage of Sid Meier, "Interesting Decisions", GDC 2012 | https://gamedeveloper.com/design/gdc-2012-sid-meier-on-how-to-see-games-as-sets-of-interesting-decisions |
| SDT | Ryan, Rigby, Przybylski (2006), "The Motivational Pull of Video Games: A Self-Determination Theory Approach", *Motivation and Emotion* 30 | https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf |
| Invisible Inc (a) | Shacknews, James Lantz (Klei) interview | https://www.shacknews.com/article/89531/invisible-inc-programmer-discusses-design-stealth-and-procedurally-generated-stages |
| Invisible Inc (b) | Shacknews, Klei on difficulty and procedural generation | https://www.shacknews.com/article/82772/invisible-inc-adjusting-difficulty-for-procedural-generation |

Corrections to the earlier snippet-only pass:

- The Thief sensory article is Tom Leonard's, and it is now read. The earlier pass could not confirm what it said. Its key points are in 1.2.
- "Systemic level design" turned out to be **Harvey Smith's** GDC talk, not Randy Smith's (we have only a student's notes). Randy Smith's talk found by search is "Level Building for Stealth Gameplay" (GDC 2006), snippet only.
- Mark of the Ninja's "interest" system is far more detailed than the snippets suggested (about 60 interest source types, priorities, one-interest-at-a-time rule). See 1.2.
- The MGSV wiki (Fandom) returns 403 to bots; the alert-phase wording below comes from a guide and PC Gamer, not the wiki.

---

# Part 1. Stealth AI

## 1.1 What the primary sources agree on

1. **Awareness is a set of discrete states reached progressively over time, not a boolean.** Splinter Cell defines awareness as "a set of discreet mental states ... that represent an increasingly more detailed understanding of the thing being perceived and that can be reached progressively over time" ([SC Blacklist](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter28_Modeling_Perception_and_Awareness_in_Tom_Clancy's_Splinter_Cell_Blacklist.pdf)) **[Read]**. Thief frames AI senses as "awareness", a range of discrete states, correlated by higher-level AI to an alertness state ([Thief sensory](https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-)) **[Read]**.
2. **Broaden the grey zone between safe and caught.** Leonard: the goal is "broadening out the gray zone of safety and danger", holding the player "on the cusp of either state, then letting loose once the zone is crossed" ([Thief sensory](https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-)) **[Read]**. PC Gamer on MGSV: "a lot of the most emotional moments in a game happen on the cusp of failure" ([MGSV failure spectrum](https://www.pcgamer.com/metal-gear-solids-failure-spectrum)) **[Read]**.
3. **Fairness, consistency, feedback, plausibility.** Walsh's four requirements are fairness, consistency, good feedback and intelligence (where "not being dumb ... means always being plausible"). Predictable does not mean repetitive: similar distances and timing every time, varied barks and animations ([SC Blacklist](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter28_Modeling_Perception_and_Awareness_in_Tom_Clancy's_Splinter_Cell_Blacklist.pdf)) **[Read]**.
4. **Player perception beats simulation accuracy.** "It really doesn't matter what the NPC should see or hear; it's what the player thinks the NPC can see and hear" (same chapter) **[Read]**.
5. **Separate squad decisions from individual decisions.** F.E.A.R. plans per character with goals and actions, and runs squad behaviours as a separate ad-hoc layer; complex-looking flanks "emerge" from simple behaviours ([Orkin](https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf)) **[Read]**. Days Gone uses a squad entity that assigns roles; members may refuse a role if something higher priority applies ([Days Gone](https://www.gameaipro.com/GameAIProOnlineEdition2021/GameAIProOnlineEdition2021_Chapter12_Squad_Coordination_in_Days_Gone.pdf)) **[Read]**.

## 1.2 Perception model

### Vision

| Element | Source finding | Use here |
|---|---|---|
| Cone + max distance + eye position + LOS raycast | Klei's vision test: in a cone, lit (or guard has night vision flag), and no collision between eye and target ([Ninja](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter32_How_to_Catch_a_Ninja_NPC_Awareness_in_a_2D_Stealth_Platformer.pdf)) **[Read]** | Baseline 2D test |
| Other shapes allowed | Klei also used single ray, circle, square, trapezoid for special cases (same) **[Read]** | Dogs (short circle), cameras (narrow long cone), drones |
| Multiple ordered cones | Thief: ordered 3D cones with XY angle, Z angle, length, acuity, sensitivity by stimulus type (motion vs light). Only the first cone containing the target is used, each cone yields a constant output ([Thief sensory](https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-)) **[Read]** | Central cone (fast), peripheral cone (slow, motion-only) |
| Backward "false vision" cone | Thief used a rear cone sensitive only to motion to give a "spidey sense" of being followed too closely ([Thief sensory](https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-)) **[Read]** | Cheap anti-exploit against walking directly behind a guard |
| Cones fail at distance | A widening cone detects things far off to the side. Splinter Cell moved to boxes (Conviction), then "coffin-shaped" boxes that widen then narrow (Blacklist) ([SC Blacklist](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter28_Modeling_Perception_and_Awareness_in_Tom_Clancy's_Splinter_Cell_Blacklist.pdf)) **[Read]** | Not needed in a side view where depth is flat, but cap range |
| Body parts | Blacklist raycasts to 8 bones; a stance needs a number of visible bones before detection starts (same) **[Read]** | Raycast 3 points (head, torso, feet). Crouch in low cover needs more visible points |
| Detection timer scaled by distance | The detection shape defines the timer range, scaled linearly by distance; the visible HUD fill is the player's window to break LOS or kill (same) **[Read]** | Core mechanic: a fill meter per guard |
| Light | Klei: light/dark is binary and shown by the ninja's colour ([MotN five rules](https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules)) **[Read]**. Thief: visibility is lighting, movement and exposure as 0..1 values, lighting biased to the floor below the player so the player can predict their own safety ([Thief sensory](https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-)) **[Read]** | Three light bands (see below) so that smoke, flicker and shadows have value |
| Edge of vision | Klei: "If you are at the absolute edge of a guard's field of vision, they will catch a glimpse of you. They will start to move towards you quickly but not on full alert" ([MotN five rules](https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules)) **[Read]** | Peripheral zone produces "suspicious", never "hostile" directly |
| Hard threshold caveat | Walsh: 1 cm outside a shape the NPC never sees; 1 cm inside, detection within seconds. Accepted cost of keeping the HUD honest **[Read]** | Accept it; show the cone on screen |
| "Smell" via sight | Klei made dog "smell" by a sight interest attached to the player, gated by a "dog" tag ([Ninja](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter32_How_to_Catch_a_Ninja_NPC_Awareness_in_a_2D_Stealth_Platformer.pdf)) **[Read]** | Dogs: short-range always-on detection that ignores darkness |

**Suggested vision parameters [Suggested, all tunable]** (tile = 1 grid cell, about 1 m):

| Zone | Shape | Visible in | Fill time to Suspicious | Fill time to Hostile |
|---|---|---|---|---|
| Central | 50 degree cone, 10 tiles | Lit, dim | 0.4 s lit / 0.9 s dim, scaled by distance (x0.5 at 2 tiles, x1.5 at 10) | 1.2 s lit / 2.5 s dim |
| Peripheral | 120 degree cone, 5 tiles | Lit, moving only | 1.2 s | Never directly (becomes Suspicious, then guard turns and central cone decides) |
| Rear | 90 degree, 1.5 tiles | Moving only | 0.8 s | Never directly |
| Dark | any | Not visible unless within 1.5 tiles and moving | n/a | n/a |
| Vertical | Guards in side view see only their own floor, plus through open shafts, stair voids and glass | n/a | n/a | n/a |

Light bands [Suggested]: lit (fixture on, no smoke), dim (fixture off but ambient from windows or screens, or smoke density below 0.5), dark (all else). Crouching and standing still lower the effective band by one step when in a shadow tile. Muzzle flash, flashlights, screen glow and burning tiles create their own lit tiles; this is what makes fire and light-breaking interact (Part 2).

### Hearing and sound propagation

| Source finding | URL |
|---|---|
| Klei: sound detection is A* pathfinding from the source to the agent's head over a "sound mesh" of empty space, so a guard behind a wall inside the radius cannot hear; sound sources carry a max radius and are only tested inside it. The same path is used by audio for filtering **[Read]** | [Ninja](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter32_How_to_Catch_a_Ninja_NPC_Awareness_in_a_2D_Stealth_Platformer.pdf) |
| Splinter Cell: every audio event has a radius and priority. Euclidean distance is wrong (heard through walls). Solution: area-path over a room-and-choke-point graph (TEAS); distance = source to nearest choke + choke to choke ... + last choke to destination. "Rough approximation" but accurate enough **[Read]** | [SC Blacklist](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter28_Modeling_Perception_and_Awareness_in_Tom_Clancy's_Splinter_Cell_Blacklist.pdf) |
| Thief: sounds tagged with semantic data, propagated through 3D geometry, arrive from the real direction with attenuated awareness values; spoken concepts can carry information between AIs **[Read]** | [Thief sensory](https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-) |
| Splinter Cell fairness hack: off-screen NPCs far enough that it is plausible they didn't hear get hearing for some events halved; combined with tiered barks **[Read]** | [SC Blacklist](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter28_Modeling_Perception_and_Awareness_in_Tom_Clancy's_Splinter_Cell_Blacklist.pdf) |
| Klei shows the sound ring on screen (e.g. a smashing light) **[Read]** | [MotN five rules](https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules) |

**Recommended sound model for a tile grid [Suggested]:** treat the building as a room graph (rooms joined by doors, vents, stair voids, elevator shafts, holes made by C4 or the drill). Each sound has loudness L in "tiles". Propagation is a Dijkstra flood over the room graph from the source room: cost = in-room distance, plus a penalty per opening (open door +0, closed door +6, locked/steel door +10, glass window +2, vent +3, solid wall = blocked, destroyed wall = open). A guard hears if remaining loudness at their position is at least their hearing threshold. Floors above/below: add +4 per floor through stairwell and shaft openings, +8 through ordinary floor slabs only for explosions and gunfire. Sound results in an **interest point at the loudest-arrival location** (where the guard believes it came from, which may be the door the sound came through, not the true source). That gives the player the real trick: noise leaks through doors, so closing a door matters.

| Sound | Loudness (tiles) [Suggested] | Interest priority |
|---|---|---|
| Sneak walking / crouch | 0 to 1 | none (only inside 1 tile) |
| Walk | 4 | low |
| Run / land from a fall | 9 | medium |
| Suppressed shot | 6 | medium |
| Unsuppressed shot | 30, building-wide alarm on 2nd shot | high |
| Glass break | 10 | medium |
| Drill (running) | 8, continuous | medium |
| Lockpick | 2 | low |
| Door slam / kick | 12 | medium |
| C4 / grenade | 40, through slabs | very high |
| Body fall / struggle | 5 | medium |
| Flashbang | 25 | high |
| Alarm siren / sprinkler / fire alarm | masks other sounds in its zone by 50% | n/a |

Masking is a useful systemic hook: loud machinery, sirens and sprinklers should reduce the effective radius of other sounds in that room. This is not from a source; it follows from the shared "loud" property in Part 2.

### Evidence, bodies, and changed objects

| Source finding | URL |
|---|---|
| Splinter Cell: when an object changes from its known state it creates an event with a lifetime; the first NPC to witness it claims it and may do a minor investigation. "More bang for our buck than any other system"; reviews mentioned guards noticing open doors and switched-off lights. Must be sold with feedback ("Did I leave that door open?" and a look-around sweep) **[Read]** | [SC Blacklist](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter28_Modeling_Perception_and_Awareness_in_Tom_Clancy's_Splinter_Cell_Blacklist.pdf) |
| Klei: interest sources from sounds, dead bodies, broken lights; about 60 types in the final game; designer-defined data (sense, priority, radius, time to live) **[Read]** | [Ninja](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter32_How_to_Catch_a_Ninja_NPC_Awareness_in_a_2D_Stealth_Platformer.pdf) |
| Klei: a "missing partner" interest can be added if a partner goes to investigate and fails to return **[Read]** | same |
| Klei priorities near ship: broken 1, missing 2, suspect/smoke/corpse/noise 4, box/spike mine 5, distraction flare 10, terror 20 **[Read]** | same |
| Klei: once investigated, the interest source is removed so every passing guard doesn't re-notice a broken light; only "suspect" (attached to the player) is rediscoverable **[Read]** | same |
| Hitman (2016): "only people who see you commit a crime will know about it" (no hive mind); guards drag bodies away into body bags and stash them **[Read, hands-on journalism]** | [Hitman hands-on](https://pcgamer.com/trying-to-break-the-largest-level-in-hitman-history) |
| Splinter Cell: context changes meaning: a searching NPC finding a body gets agitated and calls for help; the same sighting in a war zone is ignored **[Read]** | [SC Blacklist](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter28_Modeling_Perception_and_Awareness_in_Tom_Clancy's_Splinter_Cell_Blacklist.pdf) |

**Evidence table for this game [Suggested priorities, on Klei's integer scale]:**

| Evidence | Detected by | Priority | Guard response | Cleared by |
|---|---|---|---|---|
| Broken light / fuse blown (area dark) | Sight on a lit-to-dark change or a guard entering | 1 | One guard checks, may call technician; reports to comms if fuse box is tampered | Repair (guard flips fuse, 20 s) |
| Door left open that is normally closed, or lock picked | Sight | 2 | Single guard checks, closes door | Guard closes it |
| Camera disabled / feed loop | Control room operator at feed timeout | 2 | Dispatch to camera | Replacement |
| Missing colleague (missed check-in) | Comms (see 1.4) | 2 raising to 4 | Buddy check, then squad search | Colleague found or returns |
| Noise (quiet/loud) | Hearing | 4 | Investigate source of loudest arrival | Visit and look-around |
| Smoke / fire | Sight | 4 | Fire response (extinguisher) or evacuate, alarm if big | Extinguished |
| Unconscious body | Sight | 4 | Check pulse, raise alarm, wake if flashbang/ammonia-style | Moved (guards also carry them) |
| Dead body or blood | Sight | 5 | Raise site alert (see 1.4) | Moved by cleanup crew after Alert ends |
| Weapon / tool left, planted device, C4 | Sight | 5 | EOD / evacuate area | Disarm |
| Player seen (Hostile) | Sight | 20 | Combat | n/a |

Rule, taken from Klei: **every guard notices each source once**, then it is marked investigated. Newest of equal priority wins ("the last thing you notice is probably the most important thing"). Keep only one active interest per guard, plus the squad objective. Do not build an interest stack ([Ninja](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter32_How_to_Catch_a_Ninja_NPC_Awareness_in_a_2D_Stealth_Platformer.pdf)) **[Read]**.

### Memory and "free knowledge"

Thief: awareness rises through a time filter (delay by current state, then it jumps to the goal state), and falls through a capacitor that passes through each intermediate state; when the target leaves view, a "degree of free knowledge" scaled to AI state gives the appearance of deduction without overt cheating ([Thief sensory](https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-)) **[Read]**. Alien: Isolation, as reported (secondhand), says the alien has a director that always knows where the player is but the alien itself is driven by sensors, and it teleported only twice in a 12-18 hour campaign ([Alien Isolation](https://www.gamedeveloper.com/design/the-perfect-organism-the-ai-of-alien-isolation)) **[Read, secondhand]**.

## 1.3 Guard state machine

Sources for the shape: Mark of the Ninja has three clear awareness levels with cues for why they changed ([MotN five rules](https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules)) **[Read]**. MGSV has four main behaviours (calm, curiosity, increased vigilance, full alarm) plus Reflex Mode ([MGSV alert states](https://www.gamepressure.com/mgs5thephantompain/enemies-states-of-alert/z27b18)) **[Read]**. Splinter Cell adds a third state between "see nothing" and "see enemy": "I saw something and will investigate" **[Read]**. Orkin shows that an FSM can be tiny if actions are planned, but for a stealth game readable states are an explicit requirement, so we keep a named alertness layer on top of a behaviour planner.

All timers below are **[Suggested]**; only the structure is sourced.

| State | Entry condition | Behaviour | Exit condition | Timing [Suggested] |
|---|---|---|---|---|
| **Idle / Patrol** (Unaware) | Default; spawn; returned from Alerted | Follow route and stations, chat, use doors, check own room | Any interest or fill above 0 | n/a |
| **Curious** | Interest priority 1-2 (broken light, door open, faint noise), or peripheral fill above 50% | Stop, face source, 1-2 s look, then walk to it, sweep animation on arrival | Interest resolved -> Patrol. New higher interest -> reassess. Sees player -> Suspicious | Look 1.5 s; walk at normal speed; give up after 20 s of no progress |
| **Suspicious** | Central fill reaches Suspicious threshold, or noise priority 4, or sees unconscious body | Walk (not run) to last-seen point or source, weapon drawn, flashlight on, flags buddy to follow; shouts "Who's there?" | Fill drops to 0 for 6 s -> Searching. Fill reaches Hostile -> Hostile. Body found -> Alarmed | Fill decay: 1 s per 3 s out of sight |
| **Searching** | Lost Suspicious or Hostile target; or squad search order | Follow search pattern (1.6). Check lockers, vents (via squad roles), dark rooms with flashlight. Checks in on radio | Timer expires -> Return (Alerted-lite) -> Patrol. Evidence of player -> Suspicious | 25-40 s per sub-area, total 60-90 s [Suggested] |
| **Alarmed** (calling it in) | Finds dead/unconscious body, sees player in a restricted way, or tripwire/alarm | Must reach radio, panel, or use shoulder mic; 1.5 s radio animation; raises site alert level by a step (1.4) | Call completes -> Hostile or Searching. Killed/stunned/mic jammed before completion -> alert contained | Call time 1.5-3 s (MGSV: kill them before they radio, or destroy the comms, and nothing happens) |
| **Hostile** (Combat) | Central fill reaches Hostile; shot at; sees player after Alarmed | Shoot, take cover, take a squad role (1.5). Shouts position | No LOS for 8 s -> Searching at last known position. Squad confidence collapse -> Retreat | Reaction delay to first shot 0.4-0.6 s so a drawn weapon is readable |
| **Retreat / Regroup** | Squad confidence panicked (Days Gone concept), out of ammo, outnumbered by stealth takedowns | Fall back to the next station, call reinforcements, protect the objective | Confidence recovers -> Hostile; contact lost -> Searching | Waves of half the squad |
| **Incapacitated** | Takedown, flashbang, gas, shot | Cannot act. Can be woken by a colleague or recover | Recovery timers: stunned 8 s, flashbang 5 s blind + 8 s dazed (see hazards.md), knocked out until woken | Wake by colleague 15 s [Suggested] |

Transitions that matter most for readability (all sourced in spirit):

- Every state shows an over-head icon and a distinct bark (Klei: "if a guard's behavior ever changes, the player will immediately understand what set it off" **[Read]**).
- Hostile never comes from the peripheral cone alone (Klei edge-of-vision rule **[Read]**).
- No hive mind: only witnesses know (Hitman 2016 **[Read]**), and information moves by radio, shouting, or discovery (1.4).
- A reflex window on first detection is optional. MGSV's Reflex Mode slows time so the player can kill the spotter before the alert; it halves the score bonus ([MGSV alert states](https://www.gamepressure.com/mgs5thephantompain/enemies-states-of-alert/z27b18)). This game's equivalent is the **fill meter itself**: the visible Hostile fill is the window.

## 1.4 Comms and site-alert escalation

What sources show:

| Source finding | URL |
|---|---|
| MGSV: alarm by default alerts only the immediate vicinity of the spotter; outdoors maybe a few respond; inside the base likely everyone nearby. Reinforcements replace eliminated guards, so fighting long lowers the rank **[Read]** | [MGSV alert states](https://www.gamepressure.com/mgs5thephantompain/enemies-states-of-alert/z27b18) |
| MGSV: if the spotter yells and you kill everyone who heard before they radio, the alert is contained; destroying comms equipment makes a radio call do nothing; reinforcements called but if you run away they don't give chase **[Read]** | [MGSV failure spectrum](https://www.pcgamer.com/metal-gear-solids-failure-spectrum) |
| MGSV demo, forum claim: killing a guard while he is on the radio makes CP suspicious and goes to Caution **[Snippet, forum comment, unverified]** | https://neogaf.com/threads/metal-gear-solid-v-gamescom-gameplay-demo.1090863/post-176273508 |
| Metal Gear wiki (snippet): MGS2 introduced Caution after Evasion, and the player could prevent Alert by stopping the guard's radio call to HQ; MGS3 removed that **[Snippet]** | https://metalgear.fandom.com/wiki/Enemy_status |
| Klei: when several guards detect the same interest, assign roles: a "sentry/group leader" barks orders and hangs back, one or more "investigate", the rest "bystander"; roles exist only inside that interest and vanish when it ends **[Read]** | [Ninja](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter32_How_to_Catch_a_Ninja_NPC_Awareness_in_a_2D_Stealth_Platformer.pdf) |
| Thief: sense links propagate between AIs by verbalisation and observation, with controls to constrain cascades across a level **[Read]** | [Thief sensory](https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-) |
| Splinter Cell: a group-behaviour system takes over a conversing pair; if one dies silently, the survivor is later sent to check and calls "Hey, are you ok over there?" **[Read]** | [SC Blacklist](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter28_Modeling_Perception_and_Awareness_in_Tom_Clancy's_Splinter_Cell_Blacklist.pdf) |

**Recommended comms model [Suggested; structure follows the findings]:**

Information moves only by four channels, each of which is a system the player can attack:

1. **Line of sight and shouting.** A guard in Alarmed shouts; guards within shout radius (6 tiles, through open doors) receive it.
2. **Radio / shoulder mic.** Each guard has a radio, 1.5-3 s to transmit. A radio call goes to the **security desk** (control room). Jammable (flashbang does not; a jammer device or destroying the comms rack does), interruptible (kill or stun before the call completes).
3. **Hard-wired alarm panels and pull-stations.** Press button: instant site alert for that zone. Power-dependent (fuse boxes). Can be disabled by hacking or cutting power, but a dead panel triggers a "fault" check in the control room.
4. **Check-in schedule.** Every guard checks in on a radio roughly every 90 s [Suggested] (phrases vary). A missed check-in raises a "missing" interest (priority 2) for the nearest buddy; a second missed check-in (another 45 s) raises squad search at the last known post. This makes silent takedowns have a clock, which is the "interlock" the owner asked for: takedown makes a body (visible) and a missing check-in (comms).

Site alert levels (global, per building zone):

| Level | Name | Trigger | Effects | Decay |
|---|---|---|---|---|
| 0 | **Normal** | Default | Normal patrols, stations manned | n/a |
| 1 | **Notice** | Any radioed "something's odd" (broken light, missed check-in, door open) | One extra guard roams the zone; camera operator checks feeds; guards leave station for 30 s checks | 120 s since last event |
| 2 | **Caution** | Body found and reported, a guard was disarmed or attacked and escaped, alarm panel pressed once, sound of a suppressed gun | Patrols double up. Stairwells and elevators get a stationed guard. Locked doors are re-locked and checked. Cameras swivel faster. Lights are turned on in dark rooms where possible | 180 s with no new evidence, then step down one level |
| 3 | **Alert** | Player seen and reported, unsuppressed gunshot, explosion, repeated alarms | Squads form, roles assigned (1.5). Elevators shut or recalled to the lobby, stair doors lock below/above the player's last floor, vents sealed, cameras focus. Reinforcements spawn at entry after 45 s [Suggested] then every 60 s (MGSV: new ones replace the dead) **[Read]** | Does not decay; drops to Search after losing the player for 60 s |
| 4 | **Lockdown** (or Search) | Alert not resolved in 120 s or objective stolen and detected | Floor shutters, all exits locked, EOD teams, SWAT roles, fire doors. Extraction becomes the whole game | Only ends if player escapes the building; otherwise stays |

The levels step up on events and step down on timers, never by a single hidden counter: show the current level on the HUD (Klei's transparency rule), and give barks and radio chatter for each change. MGSV's insight that alerts are *local first, global after radio* is the heart of it ([MGSV alert states](https://www.gamepressure.com/mgs5thephantompain/enemies-states-of-alert/z27b18)).

Containment is the player's skill expression: you are not "seen or not seen", you are racing to kill or silence a witness before his radio call lands (1.5-3 s), or destroying the comms rack so the call goes nowhere.

## 1.5 Squad roles and combat tactics

Sources:

- **F.E.A.R.:** a global coordinator re-clusters AI into squads by proximity; each squad runs zero or one squad behaviours; four simple behaviours (Get-to-Cover, Advance-Cover, Orderly-Advance, Search); behaviours find AI to fill slots, send orders, monitor progress, and fail if an AI decides a higher-priority goal (e.g. flee a grenade). Flanks and pincers "emerge" from going to the nearest valid cover; there were no complex squad behaviours ([Orkin](https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf)) **[Read]**.
- **Days Gone:** dynamic squads by distance (two units within range merge; split if disconnected); five confidence levels (panicked, worried, neutral, confident, heroic); squad confidence = average of members' confidence; confidence from the ratio of perceived friend strength to enemy strength including kills and casualties which decay over time; panic is contagious; the AI gives the player room (leaves a rear opening for flankers; lets a flank succeed to give a "small win"; builds confidence against passive players and loses it against charging ones); the "Frontline" divides the field into lanes; retreat in waves with half moving while half cover; snipers and rushers are kept out of squads ([Days Gone](https://www.gameaipro.com/GameAIProOnlineEdition2021/GameAIProOnlineEdition2021_Chapter12_Squad_Coordination_in_Days_Gone.pdf)) **[Read]**.
- **Splinter Cell Blacklist:** connectivity graph of areas and choke points (TEAS) so guards who lack LOS cover the doors and windows into the player's area rather than staring at walls; area metadata includes how many NPCs should enter for search or combat and whether it is a closed room. An unreachable player (rooftop) triggers "unreachable above": grenade throw under cover fire, then fall back if it fails, so the player cannot camp ([SC Blacklist](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter28_Modeling_Perception_and_Awareness_in_Tom_Clancy's_Splinter_Cell_Blacklist.pdf)) **[Read]**.
- **Attack tokens, Killzone and Halo squad AI:** not read in this pass. See section 5.

**Role set for this game [Suggested, combining the above]:**

| Role | Job | Takes the role when | Weakness the player can exploit (orthogonal, per Harvey Smith) |
|---|---|---|---|
| Patrol | Walk a route | Default | Predictable route and gap |
| Station | Hold a post (door, stair, elevator, vault, control room) | Assigned | Cannot leave without a replacement; must radio before leaving |
| Camera operator | Watch feeds; dispatch | Control room | Power, hacking, feed loop, flashbang the room |
| Investigator | Walk to an interest | Klei-style role assignment | Alone, can be ambushed |
| Sentry/leader | Stay back, give orders, radio | Highest rank in group | Kill/jam first to stop escalation |
| Suppressor | Pins the player from cover | Hostile | Smoke, flash, flank |
| Flanker | Takes an alternate route (stairs, vents, elevator) | Squad has 3+ and player is static | Needs a route; block it with a door lock or C4 |
| Breacher | Throws grenade or flashbang into a room | Player in a closed room / unreachable (SC "unreachable above") | Smoke / door block |
| Heavy | Armoured, shotgun; moves in | Alert 3+ | Slow; fire, EMP, gas |
| Technician / Cleaner | Fixes fuses and doors, moves bodies | Alert dropping | Fuse boxes; seen alone |
| Dog handler / dog | Smell, tracking | Alert 2+ | Gas, noise, vents |
| Drone operator | Flying scout | Alert 3 | Shoot; EMP |
| SWAT / EOD | Late-game | Lockdown | Pre-planned traps |

Squad rules:

1. **Dynamic squads by proximity** (Days Gone, F.E.A.R.). Reform when guards die so the player's takedowns visibly rebalance the squad.
2. **Confidence** (Days Gone): bar from panicked to heroic. Fewer guards, killed squadmates, a flashbang or gas on a colleague, and darkness lower it; armour, numbers, and an ammo advantage raise it. Panicked guards break and run, taking others with them unless a heavy holds them.
3. **Orders can fail.** A guard may drop an order because of a grenade (F.E.A.R.). Emergent flanking beats scripted flanking.
4. **Leave the player an exit.** Flankers leave a rear opening (Days Gone). In a vertical tower this is a stairwell or vent kept unguarded for the first minute of Alert.
5. **Never camp-proof by cheating.** Use SC's "unreachable above" response: grenade, then withdraw, then search, not a magic aimbot.
6. **Attack tokens [Suggested; not read]:** only 2 guards may fire at the player in the same moment; the rest suppress or take cover, to keep fights readable.

## 1.6 Search patterns

None of the primary sources give a full search algorithm. Klei: after reaching an interest, the guard "will perform his normal search pattern" and gives up if lights are turned off before he reaches the spot ([Ninja](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter32_How_to_Catch_a_Ninja_NPC_Awareness_in_a_2D_Stealth_Platformer.pdf)) **[Read]**. F.E.A.R. Search splits the squad into pairs who cover each other ([Orkin](https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf)) **[Read]**. Alien: Isolation uses areas of interest, hand-tuned or generated, rather than moving optimally; it "paces" and sweeps rather than beelining ([Alien Isolation](https://www.gamedeveloper.com/design/the-perfect-organism-the-ai-of-alien-isolation)) **[Read, secondhand]**. Splinter Cell's area metadata includes how many NPCs search an area **[Read]**.

**Recommended pattern [Suggested]:**

1. **Last-known point first.** Walk to last-seen position and look both ways (3 s).
2. **Expanding rings over the room graph.** Score each adjacent room by (probability the player could have reached it in elapsed time) divided by (number of times it has been checked). Guards visit the best-scoring rooms, with at most N guards per area from the area's metadata.
3. **Hiding spots** (lockers, vents, shadows, crates, ceilings): each has a "search cost" and a "checked" flag. Guards check hiding spots only on Alert 3+ or after the player was seen entering one. Checking is visible and slow (2 s) so the player can prepare an ambush.
4. **Light everything.** Searching guards flip light switches on and use flashlights. This is an interaction (guards undoing your sabotage).
5. **Close the exits.** Squads send one guard to the stair or elevator and one to the vent ("cover the choke", as SC's TEAS does) before sweeping rooms.
6. **Decay of the search area.** The candidate area grows by walking speed times time, capped by walls, locked doors and closed shutters, which gives the player a reason to lock doors behind them.
7. **Stand down in stages.** Search ends after 60-90 s without evidence [Suggested]; guards return to Station, Alert drops to Caution, and cleanup begins.

## 1.7 How the AI stays fair and readable

| Rule | Source |
|---|---|
| Show cone, sound ring, and awareness state on screen. Binary light with visible character shading. Three awareness levels with cues and a visible ghost marker for the last-seen position | [MotN five rules](https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules) **[Read]** |
| Fill bar gives a window to break LOS or kill | [SC Blacklist](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter28_Modeling_Perception_and_Awareness_in_Tom_Clancy's_Splinter_Cell_Blacklist.pdf) **[Read]** |
| Three-tier barks: specific the first few times ("I think I heard footsteps"), then generic, then vague, so players learn then are not annoyed | same **[Read]** |
| Halve hearing for off-screen guards when it is plausible, since "detected by something you can't see" feels unfair | same **[Read]** |
| One interest at a time; never re-notice the same source; merge repeated footsteps into one interest | [Ninja](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter32_How_to_Catch_a_Ninja_NPC_Awareness_in_a_2D_Stealth_Platformer.pdf) **[Read]** |
| Checkpoints between each meaningful encounter so failure is cheap and experimentation encouraged (Heresy Four) | [MotN five rules](https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules) **[Read]** |
| A broad failure spectrum (hide, kill the spotter, contain the radio, run) so "caught" is not game over | [MGSV failure spectrum](https://www.pcgamer.com/metal-gear-solids-failure-spectrum) **[Read]** |
| Let a player win small: allow flanks, don't punish passive and aggressive players the same way | [Days Gone](https://www.gameaipro.com/GameAIProOnlineEdition2021/GameAIProOnlineEdition2021_Chapter12_Squad_Coordination_in_Days_Gone.pdf) **[Read]** |
| Only witnesses know; no omniscient guards | [Hitman hands-on](https://pcgamer.com/trying-to-break-the-largest-level-in-hitman-history) **[Read]** |
| Director pacing: tension must vary or players give up. Alien Isolation's director tracks a "menace gauge" and sends the alien away when it peaks | [Alien Isolation](https://www.gamedeveloper.com/design/the-perfect-organism-the-ai-of-alien-isolation) **[Read, secondhand]** |
| A guard that appears to cheat should do so *before* the player can see it. Thief's "free knowledge" only when the target has left view | [Thief sensory](https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-) **[Read]** |

An important design tension: Klei found the 2D "encounter space" sweet spot is about one screen plus 0.5 to 0.75 screens in any direction; more and players feel lost ([MotN five rules](https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules)) **[Read]**. A 20+ storey side-view tower should be authored as a stack of encounter spaces of this size, with the player's camera showing the neighbouring floors only when through shafts or glass.

---

# Part 2. Systemic / immersive-sim design

## 2.1 What makes systems "interlock"

| Principle | Evidence |
|---|---|
| **Simple universal rules, applied to everything with the property.** Dohta's chemistry engine: "elements" (fire, water, ice, wind, electricity) change the state of "materials" (wood, rock, the player); elements change each other (fire plus water gives no fire); materials never affect each other. "An extremely simple model but allows for the expression of all sorts of events." | [BotW chemistry](https://www.thumbsticks.com/gdc-17-breath-of-the-wild-science-lies) **[Read]** |
| **Consistency invites experimentation.** "If you unify your game world with a set of consistent physics rules, the player will come up with ideas all sorts of things they want to try." | same **[Read]** |
| **Things that are the same behave the same by default, then take modifiers.** Harvey Smith's systemic talk as summarised by a student. Ratio of accessible to conceivable states should approach 1 (Crawford) | [Systemic LD notes](https://requiem-for-games.blogspot.com/2008/02/systemic-level-design-for-emergent-play.html) **[Read, secondhand student notes]** |
| **Orthogonal differentiation.** Units or tools should have different primary roles whose deficiencies cannot be covered by more copies of the same, so that combinations matter. Litmus test: X's tactical deficiency is covered by Y but not by more X. Also: "Almost no one does purely OUD"; and "OUD is not a formula for fun: you must differentiate meaningfully" | [Harvey Smith OUD](https://slidetodoc.com/orthogonal-unit-differentiation-harvey-smith-witchboyionstorm-com-intro/) **[Read]** |
| **Emergence is second-order consequences of rules.** Smith's slides define "Emergent gameplay (2nd order consequences)" as behaviours arising from rule interactions, and tie it to intentionality, feedback and agency | same **[Read]** |
| **Rules at pixel level.** Noita: every pixel follows simple rules and combining them gives surprises. Fire looks in a random direction to ignite; oil is flammable and spreads fire, water is not and fire turns it to steam; gases rise ("inverted water"); wood burns for a duration then is destroyed; big explosions turn "good candidates" of static material into falling material; rigid bodies recompute shape when pixels are destroyed | [Noita](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/) **[Read]** |
| **Immersive sims**: "simulated systems that respond to a variety of player actions, which combined with a comparatively broad array of player abilities allow varied and creative solutions ... and emergent gameplay beyond what has been explicitly designed"; they avoid easy escape from consequences. Spector's Ultima VI playtest anecdote: a player lacking the spell used a pet mouse to slip through a gate | [Immersive sim](https://en.wikipedia.org/wiki/Immersive_sim) **[Read]** |
| **Hitman**: tampering (screwdriver on stove, oil canisters, taps, electrified spotlights), crime witnessed only by who sees it; body bags | [Hitman hands-on](https://pcgamer.com/trying-to-break-the-largest-level-in-hitman-history) **[Read]** |
| **Guards are part of the system.** Klei's interests: designers can attach an interest to an agent and the guard will pathfind there with no special-case script, so if the player turns off the lights he gives up, "no special cases need to be scripted" | [Ninja](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter32_How_to_Catch_a_Ninja_NPC_Awareness_in_a_2D_Stealth_Platformer.pdf) **[Read]** |

The takeaway for this game: define a **property vocabulary** on tiles, props and agents; write each interaction once against the property; let every gadget, hazard and guard behaviour act through properties rather than special cases.

### Property vocabulary [Suggested]

| Property | Meaning | Examples |
|---|---|---|
| `flammable` (0-3) | burns, spreads fire, produces smoke | paper, wood, carpet, oil, gas, server cables, guards in fuel |
| `conductive` | carries electricity | water puddles, metal grating, wet floor, cables, sprinkled floors |
| `electric` | powered, shock source | fuse box, camera, lights, cables, door locks |
| `loud` (radius) | emits sound | alarms, drill, gunshot, glass, machines |
| `light_emitting` | creates lit tiles | lamps, screens, fire, muzzle flash, flares |
| `opaque` / `blocks_light` | blocks sight / light | smoke, steel, curtains |
| `breakable` | shatters on hit or blast | glass, lights, cameras, vents |
| `structural` | holds up tiles above | pillars, slabs, supports |
| `pressurised` | explodes or vents | gas pipes, tanks, extinguishers |
| `wet` | has water, extinguishes fire, conducts | sprinkler zones, puddles |
| `locked` / `powered_door` | blocks passage | doors, shutters, elevators |
| `watched` | seen by a camera / guard | any tile in a cone |
| `hackable` | can be taken over | computers, cameras, locks, turrets, drones |
| `flesh` | agent properties | hp, wet, burning, gassed, blind, deaf, stunned |

Hazard mechanics (fire spread, smoke, flashbangs, sprinklers) are covered in [hazards.md](./hazards.md); this document ties them to the guards.

## 2.2 Interaction matrix for this game [Suggested design, using properties above]

Read row as the **cause**, column as the **effect on the other**. Cells say what happens. "Guards" means any agent. Each interaction should be a rule on properties, not a special case.

| Cause \ Affects | Fire | Water / sprinklers | Electricity | Smoke | Gas | Glass | Noise | Light / dark | Explosion / collapse | Alarm | Doors / locks | Cameras | Elevators | Vents |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Fire** | Spreads to `flammable` neighbours | Burns off water to steam; sprinklers trigger from heat | Burns cables, shorts circuits, trips fuses | Produces smoke; wood and plastic give more | Ignites gas (flash fire or explosion by density) | Heat cracks glass after N s | Crackling radius 3; flames mask | Lights tiles (flicker); reveals player in dark | Ignites pressurised tanks and C4 chain | Heat/smoke detectors raise a zone alarm | Burns wooden doors; steel fire doors auto-close | Melts/blinds cameras in smoke | Lift refuses stops on a burning floor | Vent carries smoke and fire up |
| **Water / sprinklers** | Extinguishes | Spreads and pools downhill | Makes floor `conductive`; shorts fuses; electrocutes standing agents | Condenses smoke (reduces density) | Dilutes gas slightly | n/a | Splash and rain mask footsteps | Wet floor reflects light (more visible) | Washes away fire; blasts do not worsen | Sprinkler fire-alarm bell | Shorts electronic locks (fail-open or fail-locked per door) | Shorts cameras (feed dies) | Floods shaft, stops lift | Drains through vents |
| **Electricity** | Sparks ignite `flammable` and gas | Spreads through wet tiles | Chains through conductors; fuse trips | Arc makes light, little smoke | Spark ignites gas | Shocks break lights | Buzz, crack radius 4 | Flash then blackout; fuse off kills all `electric` lights in zone | Overloaded generator can explode | Cutting power may arm backup alarm | Powered doors lock or open (design per door) | Cameras go dark; backup battery 20 s | Elevator stalls between floors | Fans stop, no airflow |
| **Smoke** | Starves fire (low), no effect (high) | Reduced by sprinklers | n/a | Merges and rises | Mixes | n/a | Muffles by 30% | Blocks sight and cones; dims lit tiles | n/a | Triggers smoke detector | n/a | Blocks camera LOS | n/a | Spreads through vents |
| **Gas** (knockout, toxic, flammable) | Flammable gas fuels explosions | Dissolves or dilutes | Spark ignites if flammable | Mixes | Stacks | n/a | Hiss radius 3 | n/a | Spreads on blasts | Detector triggers | Seeps under doors if open gap | n/a | Fills shaft | Primary delivery route |
| **Glass** | n/a | n/a | n/a | n/a | n/a | n/a | Break noise 10 tiles | Windows let daylight (lit) and let sight through | Blast shatters, flying shards hurt | Alarmed glass triggers on break | Sealed glass doors | Cameras hidden behind glass | Elevator glass shows occupant | n/a |
| **Noise** | n/a | n/a | n/a | n/a | n/a | Sustained loud shatters glass (optional) | Masked by louder noise | n/a | n/a | Alarm sound masks other noise | Doors muffle (closed +6) | Microphone cameras (optional) | Elevator bell reveals position | Vents carry noise up shafts |
| **Light / dark** | Light of fire reveals | Wet reflects | Sparks light | Smoke lowers light | n/a | n/a | n/a | Dark tiles hide the player | n/a | n/a | n/a | Cameras need light (or have IR) | n/a | Vents are dark |
| **Explosion / collapse** | Starts fires | Bursts pipes and sprinkler mains | Cuts cables | Raises dust/smoke | Ignites or disperses | Shatters | 40 tiles through slabs | Kills lights | Removes `breakable` and unsupported `structural` above | Triggers building alarm | Blows doors; destroys locks | Destroys cameras | Drops or jams elevator | Opens new routes |
| **Alarm** | n/a | n/a | n/a | n/a | n/a | n/a | Siren masks other noise | Red strobe lights | n/a | Raises site level | Locks doors, shutters | Cameras retarget | Elevators recall | Vent grilles lock |
| **Doors / locks** | Fire doors cut off fire | Seals water | Locks open or shut when power changes | Closed door blocks smoke | Blocks gas | n/a | Closed door +6 sound cost | Closed door blocks light | Reinforced doors resist | Open door = evidence | n/a | n/a | Lift doors | n/a |
| **Cameras / computers** | n/a | n/a | Hack from a console | n/a | n/a | n/a | n/a | n/a | n/a | Camera sees player: operator alerts | Hacked camera opens or locks doors | Loop feed | Computer controls lift | n/a |
| **Elevators** | n/a | n/a | Needs power | n/a | n/a | n/a | Bell, motor hum | Interior light | Counterweight and shaft as drop route | Locked down on Alert | Key-card or hack | Camera inside | n/a | Shaft as route and sound path |
| **Vents** | Carries fire | n/a | n/a | Carries smoke | Carries gas | n/a | Echo | Dark | Blast pressurises vent | n/a | Locked grille | Camera in main shaft | n/a | n/a |

### Guard response to each element [Suggested]

| Stimulus | Guard response | Counter the player can build |
|---|---|---|
| Fire in room | Run for an extinguisher (technician role); evacuate if large; raise Notice then Caution | Fire as a distraction, or to burn evidence; guards trapped by locked fire doors |
| Sprinklers on | Guards slip/slow? (optional); electronics fail; fire alarm raises Caution | Use water plus electricity to shock a patrol |
| Power cut | Technician sent to fuse box (known weak point); dark rooms get flashlight patrols; cameras switch to battery | Trap the technician; swap fuse boxes; time the takedown |
| Smoke | Guards cough and go to search state, cannot see in it; thermal drones see through | Smoke lane to cross a camera or a patrol |
| Gas | Guard collapses (knockout) and becomes evidence | Sealed room plus vent delivery |
| Flashbang | Blind 5 s, then dazed; yells; Hostile bark carries | Throw into a room, then close the door to contain the noise |
| Glass break | Noise 10; one guard investigates | Break a light far away to pull a guard off post |
| Explosion | Alert 3 | Last resort, or planned for the escape |
| Hacked camera | Operator thinks "fault", sends a guard | Hack to loop; hack to point at a guard and trigger a false alarm |
| Elevator sabotage | Guards use stairs (time cost) | Lock the lift to shape their route |
| Locked door | Guards use a keycard or a technician; or detour | Lock them out of a zone |

## 2.3 Level-design patterns for multiple routes and solutions

Sources are thin here: Harvey Smith's systemic level design talk is only available as student notes and Randy Smith's talk only as a snippet, so the items below are derived from the read sources plus design judgement.

What was read and supports them:

- Thief's gradient of light and dark and the ability to avoid, hide, and knock out make a room a toolbox ([Thief sensory](https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-)) **[Read]**.
- Klei: encounter space about one screen plus 0.5 to 0.75 in any direction ([MotN five rules](https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules)) **[Read]**.
- Splinter Cell: connectivity graph of areas and chokes, guards cover chokes ([SC Blacklist](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter28_Modeling_Perception_and_Awareness_in_Tom_Clancy's_Splinter_Cell_Blacklist.pdf)) **[Read]**.
- Immersive sim definition: varied and creative solutions, not scripted ones ([Immersive sim](https://en.wikipedia.org/wiki/Immersive_sim)) **[Read]**.
- Spector's anecdote shows the value of "small unusual routes" (the mouse) **[Read]**.

Patterns [Suggested]:

| Pattern | What it is | Why |
|---|---|---|
| Loop | Two routes between the same rooms, one safe and slow, one fast and watched | Allows retreat and flanking; used by guards too |
| Vertical shortcut | Vent, shaft, elevator top, window ledge, rappel, drill through the slab | Side view makes vertical movement the main "route" axis |
| Locked shortcut | Door needing a keycard, hack, lockpick or C4, which opens a loop | A reward for exploration; makes the building learnable |
| Vantage point | Place the player can see a patrol before entering | Information is the stealth resource |
| Choke with alternatives | Every guarded choke has at least two ways past (distract, disable, avoid, kill) | Prevents a single "key" |
| Power node | Fuse box covers a zone's lights, cameras, locks | Interlocks systems: one action, many effects |
| Hiding spot | Locker, vent, shadow, crate with a cost | Safe zones with a risk |
| Risk/reward optional | Vault, intel, safe, VIP room off the critical path, guarded | Choice and replay value |
| Escape route design | Rooftop, parachute window, service shaft, garage | Extraction should be as designed as infiltration |
| Landmark per floor | Distinct tint and layout per floor so players know where they are | Stack of 20 floors must be readable |

---

# Part 3. What keeps this kind of game fun long term

Only the sources below were read. Most of the named games (Hitman, Dishonored, Heat Signature, Monaco, The Swindle, Payday 2, Door Kickers) were **not** read for replayability beyond snippets; see the could-not-verify list.

## 3.1 Interesting decisions

Sid Meier: "Games are a series of interesting decisions". Easier to define by what isn't one: always picking the first of three options, or a random choice. He warns that stitching together pieces of other games doesn't ensure fun; look at what the decisions are ([Meier](https://gamedeveloper.com/design/gdc-2012-sid-meier-on-how-to-see-games-as-sets-of-interesting-decisions)) **[Read]**. Further summary (tradeoffs, situational, personal, persistent) is from search snippets only **[Snippet]** at https://gamedeveloper.com/design/designing-interesting-decisions-in-games-and-when-not-to-. For this game: a loadout slot or a gadget should be a trade-off, situational, and have consequences that persist through the run (a body you left, an alarm you tripped, a fuse you blew).

## 3.2 Depth versus complexity

Harvey Smith's OUD: "Fewer units equate to interesting gameplay ... Functionally different units provide combinatorial range ... Cosmetically different units get old fast" ([Harvey Smith OUD](https://slidetodoc.com/orthogonal-unit-differentiation-harvey-smith-witchboyionstorm-com-intro/)) **[Read]**. Depth comes from few distinct, orthogonal tools interacting, not from many similar ones. This game's guard types and tools should follow the litmus test: a drone, a drill, C4, smoke and a lockpick each solve a different problem and none is "a bigger version" of another.

Klei's principle: levels are hard "so that players learn the underlying systems rather than the specific levels", and a single successful run is short but mastery takes many ([Invisible Inc (b)](https://www.shacknews.com/article/82772/invisible-inc-adjusting-difficulty-for-procedural-generation)) **[Read]**; and they kept adding "more and more ways to manipulate guards" (new interest points, distractions, turning them around) as the stealth lever ([same]) **[Read]**.

## 3.3 Self-determination theory

Ryan, Rigby and Przybylski: autonomy, competence and relatedness "independently predict enjoyment and future game play"; perceived in-game autonomy and competence relate to enjoyment, preference and well-being change ([SDT](https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf)) **[Read, abstract and theory sections]**. Design reading:

| Need | In this game |
|---|---|
| Autonomy | Multiple solutions for each problem; free loadout; optional objectives; player chooses quiet or loud |
| Competence | Clear feedback on systems and guard state; a skill ceiling in mastering hazards; ranks and scoring that reward tactics, not grind |
| Relatedness | Mostly absent in single-player. Options: handler voice on comms, leaderboards, shared daily seeds, replays (Part 3.5) |

Klei adds that "limited consequences for failure" (checkpoints between encounters) keeps experimentation alive and prevents "degenerative strategies" where players do the one safe thing ([MotN five rules](https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules)) **[Read]**; PC Gamer's MGSV piece argues a wide failure spectrum keeps immersion ([MGSV failure spectrum](https://www.pcgamer.com/metal-gear-solids-failure-spectrum)) **[Read]**.

## 3.4 Procedural generation pitfalls

Direct sources: Klei's Invisible Inc interviews. "The thing we get the most noise on is frustration with the procedural level generation and an uneven difficulty curve" ([Invisible Inc (b)](https://www.shacknews.com/article/82772/invisible-inc-adjusting-difficulty-for-procedural-generation)) **[Read]**; Lantz: it took "an incredible amount of effort to design both the procedural generation and the stealth system in a way that kept it fun and interesting without being too predictable" ([Invisible Inc (a)](https://www.shacknews.com/article/89531/invisible-inc-programmer-discusses-design-stealth-and-procedurally-generated-stages)) **[Read]**. A forum comment complains of confusing levels and "the doom clock" (user comment, weak evidence).

For this game's 20+ storey building: do **not** fully generate rooms. Hand-author **room templates** (tagged by purpose, exits, systems available) and generate which are on which floor, how floors connect, the guard roster and the objective placement; run a validator that guarantees at least two routes from entry to objective and from objective to extraction, at least one non-lethal and one loud option, and every floor having a power node. Heat Signature's blog posts on ship generation are snippet-only **[Snippet]**.

## 3.5 Replayability levers

| Lever | Evidence | Use |
|---|---|---|
| Mission modifiers | Klei: "customizable campaign options" came from community feedback; Endless and difficulty modes ([Invisible Inc (a)](https://www.shacknews.com/article/89531/invisible-inc-programmer-discusses-design-stealth-and-procedurally-generated-stages)) **[Read]** | Pre-mission toggles: reduced power, extra patrols, heavy rain, blackout, double-lock |
| Scoring and ratings that trade off | MGSV: long fights and Reflex Mode lower rank ([MGSV alert states](https://www.gamepressure.com/mgs5thephantompain/enemies-states-of-alert/z27b18)) **[Read]** | Rank on stealth, speed, bodies, alarms, collateral; separate "Ghost" and "Demolition" ratings so both styles have a perfect score |
| Loadout choice | Orthogonal tools (above); Hitman 2016 tools like screwdriver and coin from the hands-on **[Read]** | Limited weight/slots; unlock by performance |
| Escalating AI over time | Alien Isolation unlocks behaviour-tree branches gradually so the alien appears to learn ([Alien Isolation](https://www.gamedeveloper.com/design/the-perfect-organism-the-ai-of-alien-isolation)) **[Read, secondhand]** | Guards adapt to repeated tactics within a run (they seal the vent you used) |
| Many manipulations of the same guard | Invisible Inc (b) **[Read]** | New gadgets that interact with interest and alert |
| Hitman "opportunities", Dishonored multiple outcomes, Monaco, The Swindle, Payday 2, Door Kickers | Not read | see section 5 |

---

# Part 4. Recommended design for this game

All numbers are **[Suggested]** starting values; the structure follows the sources above.

## 4.1 Guard state machine

```
                   +----------------------------------------------+
                   |                    Patrol                    |
                   +--+----------------+-----------------------+--+
          interest p1-2|      peripheral fill >50%   |   body/unconscious/alarm
                       v                v            v
                    Curious -------> Suspicious ---> Alarmed (radio / panel)
                       |  resolved       |  fill full     | call lands
                       v                 v                v
                    Patrol            Hostile <------- Hostile
                                         |  no LOS 8 s       ^
                                         v                   | confidence recovers
                                     Searching  ---> Patrol  |
                                         ^                   |
                      confidence panic -> Retreat -----------+
```

Layered as: **alertness state** (above, visible to the player) on top of a **planner** (goals: Patrol, Investigate, Search, Station, Fight, Flee, Fix; actions: move, open door, flip fuse, extinguish, drag body, radio), per F.E.A.R. Squad layer above that: roles and confidence (Days Gone). Per-guard rules: one interest at a time; each source noticed once; newest of equal priority wins.

Perception defaults: central cone 50 degrees by 10 tiles, peripheral 120 by 5 (motion only), rear 90 by 1.5 (motion only); three light bands; fill time 0.4 to 2.5 s by distance and light; Hostile never from the peripheral alone.

## 4.2 Comms and alert model

- Information moves by four channels: sight/shout, radio (1.5-3 s, interruptible, jammable), alarm panels (power-dependent), check-ins (every 90 s, second miss at +45 s).
- Control room aggregates feeds and radio. Destroying it or its power blinds the zone but raises a "fault" Notice.
- Site alert 0 Normal, 1 Notice, 2 Caution, 3 Alert, 4 Lockdown; steps up on events, down on timers (120, 180 s; Alert to Search after 60 s no contact); shown on HUD.
- Containment: kill, stun or gag the witness before the call; destroy the rack; or leave the area before a squad forms. Local first, global after radio (MGSV).
- Reinforcements: 45 s after Alert, then 60 s cadence from the entry, replacing losses; capped.

## 4.3 Interaction matrix

Use the property vocabulary in 2.1 and the matrix in 2.2. Implementation order: (1) fire, smoke, light, sound (they already interlock through `light_emitting`, `opaque`, `loud`); (2) electricity and water through `conductive` and `wet`; (3) explosions and structural collapse through `structural`; (4) comms and alarms as consumers of all other events. Every event emits a typed signal (sound, light change, state change, evidence) and the guard layer, not the hazard, decides what it means.

## 4.4 Twelve level-design rules

1. **Stack encounter spaces of about one screen plus half a screen** (Klei's sweet spot), each readable on its own, with one landmark per floor.
2. **Two ways in, two ways out for every objective and every floor**, one quiet and one loud, with no single required tool.
3. **Every guarded choke has at least three answers**: sneak, distract, disable, force, or reroute through another floor.
4. **Every floor has one power node** that controls its lights, cameras and some locks, and is guarded or trapped; each floor's node has a different weakness.
5. **Give the player information before commitment**: a vantage point, a camera feed or a map before each patrolled space.
6. **Put hazards where interactions exist**: sprinkler over a server rack, a gas pipe along a guard break room, a glass wall above a lobby, so any hazard is usable by the player and by a guard's mistake.
7. **Vertical routes are first class**: vents, shafts, elevator roofs, window ledges, drillable slabs, and a parachute window for escape. At least one is unguarded at Alert 3 for the first minute (Days Gone's open rear).
8. **Locked shortcuts reward the explorer**: keycard, hack, lockpick or C4 opens a loop that makes the building learnable.
9. **Hiding spots cost something**: each has a search cost, noise, or time limit; guards check them only at higher alert.
10. **Optional risk/reward rooms off the critical path**: vault, intel room, VIP suite; guarded by a system (laser grid, pressure plates, sealed gas room).
11. **Guards must be able to be exploited, and to react**: a patrol with a gap, a station with a replacement delay, and an alarm that can be silenced. Every exploit has a counter that a later floor introduces (drones, dogs, technicians who fix your sabotage).
12. **Design extraction as a level**: the way out differs from the way in, is revealed by the Alert escalation (lockdown shutters, stair locks), and offers a loud and a quiet option.

---

# 5. Could not verify

- **Hitman (2016) AI internals**: no GDC or Game Developer primary page located. Only the PC Gamer hands-on (Seifert quotes) was read. Suspicion meters, disguise rules and timings are **not sourced**.
- **Game AI Pro chapters not opened:** The Last of Us AI, Killzone, Halo squad AI, "attack tokens", Crytek target tracks perception (listed on gameaipro.com but not read), "What You See Is Not What You Get: Player Perception of AI Opponents".
- **Metal Gear Solid V**: exact phase names (Evasion, Caution, Alert) and timers could not be read (Fandom wiki returned 403). Alert behaviours were taken from a guide and a PC Gamer piece. The "kill a guard on the radio" detail is a forum comment.
- **Thief**: the article is read, but there are no numeric thresholds in it; all numbers in this document are suggested.
- **Alien: Isolation**: read only a secondhand article; Andy Bray's talk itself was not watched.
- **Mark of the Ninja**: read the five rules coverage and the Game AI Pro chapter; Nels Anderson's own GDC talk "Of Choice and Breaking New Ground" slides not read.
- **Harvey Smith "Systemic level design"** and **Randy Smith "Level Building for Stealth Gameplay" / "Systemic level design"**: only a student's notes and a search snippet. "Randy Smith and Harvey Smith" co-attribution in the brief could not be confirmed.
- **Warren Spector** on immersive sims: only through Wikipedia, not his own essays.
- **Arkane and IOI level-design talks**, **Mark Brown's GMTK** videos (transcript fetch was 403), **Dwarf Fortress**, **Teardown**, **Dishonored / Deus Ex AI write-ups**, **Intravenous developer posts** (no developer posts found), **Door Kickers**, **Monaco**, **The Swindle**, **Payday 2**, **Heat Signature** design posts, **Invisible Inc GDC talk** (Lantz, "Designing Procedural Stealth for Invisible Inc.", https://gdcvault.com/play/1021919): none were read in full.
- **Breath of the Wild** chemistry: read the Thumbsticks recap. One summary says five elements (fire, water, ice, wind, electricity) from a secondary site; the recap confirms fire, water, ice, wind and electricity as elements by example, but the talk was not watched.
- **Sid Meier "four qualities"** (tradeoffs, situational, personal, persistent): from a snippet, not the page read.
- **Noita**: the talk itself was not watched; the 80.lv article was read.
- All suggested timings, loudness values, cone sizes and alert thresholds are our own and untested.

# 6. Sources by URL

- https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter32_How_to_Catch_a_Ninja_NPC_Awareness_in_a_2D_Stealth_Platformer.pdf
- https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter28_Modeling_Perception_and_Awareness_in_Tom_Clancy's_Splinter_Cell_Blacklist.pdf
- https://www.gameaipro.com/GameAIProOnlineEdition2021/GameAIProOnlineEdition2021_Chapter12_Squad_Coordination_in_Days_Gone.pdf
- https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf
- https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-
- https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules
- https://www.pcgamer.com/metal-gear-solids-failure-spectrum
- https://www.gamepressure.com/mgs5thephantompain/enemies-states-of-alert/z27b18
- https://www.gamedeveloper.com/design/the-perfect-organism-the-ai-of-alien-isolation
- https://pcgamer.com/trying-to-break-the-largest-level-in-hitman-history
- https://slidetodoc.com/orthogonal-unit-differentiation-harvey-smith-witchboyionstorm-com-intro/
- https://requiem-for-games.blogspot.com/2008/02/systemic-level-design-for-emergent-play.html
- https://www.thumbsticks.com/gdc-17-breath-of-the-wild-science-lies
- https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/
- https://en.wikipedia.org/wiki/Immersive_sim
- https://gamedeveloper.com/design/gdc-2012-sid-meier-on-how-to-see-games-as-sets-of-interesting-decisions
- https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf
- https://www.shacknews.com/article/89531/invisible-inc-programmer-discusses-design-stealth-and-procedurally-generated-stages
- https://www.shacknews.com/article/82772/invisible-inc-adjusting-difficulty-for-procedural-generation
- Snippet-only leads: https://neogaf.com/threads/metal-gear-solid-v-gamescom-gameplay-demo.1090863/post-176273508 , https://metalgear.fandom.com/wiki/Enemy_status , https://gamedeveloper.com/design/designing-interesting-decisions-in-games-and-when-not-to- , https://gdcvault.com/play/1021919/contactUs
