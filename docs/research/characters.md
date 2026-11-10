# Character research: procedural animation, building believable humans, and tactical visual language

Scope: a three.js 2.5D side-view infiltration shooter. Characters are capsules and boxes driven by a code 2D skeleton (two-bone IK, run cycle from distance, aim at cursor, verlet ragdoll).

How this was gathered: pages were opened with curl and pandoc (WebFetch has its own allowlist and failed). Every item tagged **[READ]** was opened and read in this pass. Items tagged **[SEARCH ONLY]** appeared only as search-result summaries. Items tagged **[AUTHOR]** are my own engineering suggestions and are not from a source; treat them as tuning starting points. See section 6 for everything that could not be verified.

---

## 1. Procedural character animation

### 1.1 Source status

| Source | Status | URL |
|---|---|---|
| Ryan Juckett, Analytic Two-Bone IK in 2D | READ in full | https://www.ryanjuckett.com/analytic-two-bone-ik-in-2d/ |
| Ryan Juckett, Constraint Relaxation IK in 2D | fetched (26 KB), not studied in detail | https://www.ryanjuckett.com/constraint-relaxation-ik-in-2d/ |
| Thomas Jakobsen, Advanced Character Physics (GDC 2001 slides) | READ (text extracted from PDF) | https://www.cs.cmu.edu/afs/cs/academic/class/15462-s13/www/lec_slides/Jakobsen.pdf |
| Alan Zucconi, IK in 2D part 1 | READ (law-of-cosines derivation) | https://www.alanzucconi.com/2018/05/02/ik-2d-1/ |
| Rune Skovbo Johansen, Automated Semi-Procedural Animation for Character Locomotion (thesis) | READ selected chapters (7: hip height, foot trajectories; footprint timing) | https://runevision.com/thesis/rune_skovbo_johansen_thesis.pdf |
| David Rosen, GDC 2014 talk, GDC Vault page | page READ, but it is video-only and members-gated; **no transcript obtained** | https://www.gdcvault.com/play/1020583/Animation-Bootcamp-An-Indie-Approach |
| Rosen talk, Game Developer news post | READ (summary only, no technique detail) | https://gamedeveloper.com/design/video-an-indie-approach-to-procedural-animation |
| Rosen talk, Unity forum thread | READ (viewer comments) | https://discussions.unity.com/t/an-indie-approach-to-procedural-animation-gdc-video-talk/538228 |
| Gibbon: Beyond the Trees deep dive (describes Rosen's layered rig) | READ | https://www.gamedeveloper.com/programming/deep-dive-physics-based-animation-in-gibbon-beyond-the-trees |
| Rain World talk coverage (Game Developer) | READ (video link only, no content) | https://gamedeveloper.com/art/video-animating-i-rain-world-i-and-its-many-squishy-stretchy-creatures |
| Rain World / Unity interview | READ | https://unity.com/blog/exploring-procedural-design-rain-world |
| Wikipedia, Gait (human) | READ | https://en.wikipedia.org/wiki/Gait_(human) |
| Wikipedia, Walking | READ | https://en.wikipedia.org/wiki/Walking |

### 1.2 What the Rosen / Rain World sources actually tell us

Only secondary information was obtainable; the talk video itself could not be read (YouTube blocks the sandbox, GDC Vault is video-only).

- Rosen's talk is described as getting responsive, good-looking animation "using only 13 keyframes in total for everything". [READ] https://discussions.unity.com/t/an-indie-approach-to-procedural-animation-gdc-video-talk/538228
- A viewer in the same thread wished Rosen "had more time to go into technical details", so the talk itself is light on formulas. [READ] same URL.
- Rosen's quote: "We really need animation and code to work more closely together, so we can use the code to help offload repetitive tasks from the animators." [READ] https://gamedeveloper.com/design/video-an-indie-approach-to-procedural-animation
- **Layered rig ("LOD for animation").** The Gibbon developers describe Rosen's structure as: model the centre of mass (COM), map that to a 5-point rig, map that (with some IK) to a 14-point rig, then map that to the display skeleton's bones, including joint rotations. Each level lets the animator think about only one concern. [READ] https://www.gamedeveloper.com/programming/deep-dive-physics-based-animation-in-gibbon-beyond-the-trees
- Same article: a handhold-centred "two-point rig (hand + COM)" gave a good sense of contact and momentum transfer. The arm should reach roughly perpendicular to velocity to avoid collisional energy loss. [READ] same URL.
- Search-result summaries (not opened) say Overgrowth's crouch and landing squash-and-bounce was a spring-damper, and that much of Overgrowth is still keyed poses blended procedurally. [SEARCH ONLY] https://polycount.com/discussion/comment/2093086 (403 to bots, could not open).
- Rain World: the slugcat body is two spheres locked at a fixed distance; limbs and tail are cosmetic, drawn on top and animated procedurally. Jakobsson: "I never really set out to do procedural animation... code is how you make things move in a computer game". [READ] https://unity.com/blog/exploring-procedural-design-rain-world
- Rain World GDC 2016 talk exists (Jakobsson and Therrien) but only a link to the video was available. [READ] https://gamedeveloper.com/art/video-animating-i-rain-world-i-and-its-many-squishy-stretchy-creatures

Transferable idea for this game: add an intermediate layer between "physics body" and "bones". A single COM point plus feet/hands targets (5 points) is the thing gameplay code should drive; IK and bone angles are derived from it.

### 1.3 Two-bone analytic IK (Juckett), the exact maths [READ]

Source: https://www.ryanjuckett.com/analytic-two-bone-ik-in-2d/

Setup: bone 1 at the origin with length d1, bone 2 child of bone 1 with length d2, target (x, y) expressed relative to bone 1's base. Unknowns are the two joint angles θ1 and θ2 (θ2 is relative to bone 1).

- Reachable distance: |d1 - d2| <= h <= d1 + d2, where h = sqrt(x² + y²).
- Elbow/knee angle (law of cosines): `cosθ2 = (x² + y² - d1² - d2²) / (2·d1·d2)`, `θ2 = acos(cosθ2)`.
  - Note: the article's intermediate line prints the numerator as `x²+y²-d1²+d2²`, a typo; the next line, which I give here, is correct.
  - If cosθ2 is outside [-1, 1] the target is unreachable. Clamp to [-1, 1] to get the closest pose (fully extended or fully folded).
  - If d1 or d2 is zero, avoid the divide; set θ2 to 0 or last frame's value.
  - acos returns [0, π] so the result always bends one way. Negate θ2 to bend the other way (this is the knee-forward vs elbow-back switch).
- Shoulder/hip angle: `θ1 = atan2( y·(d1 + d2·cosθ2) − x·(d2·sinθ2),  x·(d1 + d2·cosθ2) + y·(d2·sinθ2) )`. Works for the negated θ2 too, and for every quadrant.
- Design requirements the article sets for a robust solver: caller chooses bend direction, solver reports "no valid solution", returns the closest alternative when unreachable, and behaves in every quadrant.

Zucconi arrives at the same triangle with the law of cosines (`cosα = (b² + c² − a²) / (2bc)`) and stresses that two-joint IK is cheap enough to run on "dozens (if not hundreds!) of characters". [READ] https://www.alanzucconi.com/2018/05/02/ik-2d-1/ He sells it against his earlier general CCD/Jacobian series, which is more expensive. I did not read parts 2 and 3 in this pass.

Practical add-ons for this game [AUTHOR, not from the article]: in a side view, keep the knee bending forward and the elbow bending down/back by fixing the sign; clamp target to 0.999·(d1+d2) to avoid a locked-straight knee (Johansen also warns that fully stretched legs look "stiff and unnatural", see 1.5).

### 1.4 Verlet ragdoll and constraints (Jakobsen) [READ]

Source: https://www.cs.cmu.edu/afs/cs/academic/class/15462-s13/www/lec_slides/Jakobsen.pdf

| Item | Value / formula |
|---|---|
| Verlet step | `x' = x + (x − x_old) + a·dt²`; then `x_old = x` (previous position). Velocity is implicit. |
| Drag | The "2" in `2x − x*` can be lowered to about 1.99 for a little drag. |
| Stick (distance) constraint, exact | `delta = x2 − x1; len = sqrt(delta·delta); diff = (len − rest)/len; x1 += delta·0.5·diff; x2 −= delta·0.5·diff` (the paper's listing has the signs arranged as `x1 -= delta*0.5*diff` with delta defined the other way; use whichever matches your delta). |
| Stick constraint, no sqrt | `delta = x2 − x1; delta *= rest²/(delta·delta + rest²) − 0.5; x1 −= delta; x2 += delta`. One division per constraint. |
| Relaxation iterations | Cloth: "only one iteration" is often enough (Hitman). Rigid-ish bodies: "3 to 4 relaxation iterations are enough". Stopping early gives slightly soft bodies, and Verlet converges over frames. |
| Collisions | Project penetrating particles back out, then run the stick constraints again. |
| Rigid bodies / ragdoll | Build from particles joined by stick constraints; pin joint = share one particle; hinge = share two. Extra "support sticks" stiffen shapes. |

Fit for this game: the existing verlet ragdoll should add a diagonal support stick across the torso and a minimum-angle stick at knees and elbows, and run 3 to 4 iterations; this is the paper's recipe for body stiffness.

### 1.5 Walk and run cycle numbers

Verified facts:

| Fact | Value | Source |
|---|---|---|
| Walking gait cycle split | about 60% stance, 40% swing; there is a double-support period | https://en.wikipedia.org/wiki/Gait_(human) [READ] |
| Walking vs running | walking always has a foot on the ground with double support; running has a flight phase | https://en.wikipedia.org/wiki/Walking [READ] |
| Average pedestrian speed | about 1.4 m/s (5.0 km/h) | https://en.wikipedia.org/wiki/Walking [READ] |
| Walking COM motion | body "vaults" over the stance leg: COM highest as leg passes vertical, lowest when legs are spread | https://en.wikipedia.org/wiki/Walking [READ] |
| Stance-phase knee flexion | knee full extended at heel strike, then flexes about 15° once the foot is flat | https://en.wikipedia.org/wiki/Gait_(human) [READ] |
| Determinants of gait | pelvic rotation, pelvic tilt, stance knee flexion, foot/ankle motion; all exist to cut vertical COM excursion | https://en.wikipedia.org/wiki/Gait_(human) [READ] |
| Arm swing | slows as walking speed increases (children's data) | https://en.wikipedia.org/wiki/Gait_(human) [READ] (weak evidence for adults) |
| Hip height choice (Johansen) | Use `h_desired_min` (lowest of each leg's "keep original bend" hip height) as the base. Never exceed `h_max_min` (lowest max-reach hip height) or a leg hyperextends. Blending min/avg with `min()` gives a second-order kink; the thesis smooths this. | https://runevision.com/thesis/rune_skovbo_johansen_thesis.pdf ch. 7 [READ] |
| Foot lift height | Each foot's lifted height interpolates toward the supporting-ground height at mid-flight using a flight-time arc | same, eq. 7.10 and following [READ] |
| Footprint reference time | Forsyth: for straight walking base the footprint on foot-strike time; for curved walking and strafing use mid-step so the foot sits under the centre of gravity mid-step | same, citing Forsyth 2004 [READ] |

Tuning defaults [AUTHOR; none of these numbers is from a read source; they are conventional starting points to verify by eye]:

| Parameter | Suggested start |
|---|---|
| Step length per metre/second | step ≈ 0.4 × body height at walk, 0.6 to 0.9 × at sprint |
| Pelvis vertical bob | period = one step (twice per stride), amplitude about 1.5% of height walking, about 3% running; lowest at double support |
| Pelvis lateral sway/rotation | about 4° to 6° yaw twist, opposite to shoulder yaw |
| Spine counter-rotation | shoulders rotate opposite to pelvis at about 1.5 to 2× pelvis amount |
| Foot clearance in swing | 4% to 8% of height walking, up to 15% sprinting |
| Arm swing | opposite to leg, amplitude about 20° to 30° walking, 40° to 60° running, elbow bent 20° walking, 80° to 100° running |
| Drive the cycle by | phase advanced by distance travelled / step length, never by time (already done in this game) |

Foot planting for this game: when a foot is in stance, pin its world x and drive the pelvis; when swing starts, interpolate to the next foothold predicted from velocity (Forsyth/Johansen footprint prediction above), and solve the legs with the two-bone IK in 1.3. This eliminates foot-slide at every speed and during turns.

### 1.6 Secondary motion and actions

None of the sources fetched in this pass gave authoritative formulas for these. The honest status:

| Topic | Status | Suggested approach [AUTHOR] |
|---|---|---|
| Weapon sway / breathing | no source read | Add 0.3 to 0.6 Hz sine on shoulders and gun (about 0.5° to 1°), larger when moving; damp when aiming/holding breath |
| Recoil and flinch | no source read | Critically damped spring on gun and torso: kick impulse on fire, `k` high, damping ratio 0.7 to 1. Flinch is the same spring on hit direction |
| Look-at / aim | no source read | Head tracks target at about 50% of spine angle limit, gun arm 100%; clamp neck ±40° and use a slerp/lerp with smoothing |
| Crouch / land squash | Rosen's talk reportedly uses spring-damper (SEARCH ONLY) | Spring on pelvis height; landing impulse proportional to fall speed |
| Cover lean, vault, mantle, ladder, stairs | no source read | Treat as short authored pose sets (few keys) blended in over IK hands/feet, which matches Rosen's "13 keyframes" philosophy |
| Fall / land | no source read | Arms up, legs extend, bend knees on touchdown by impact speed, root keeps momentum |

---

## 2. Making simple 3D humans look good

### 2.1 Proportions [READ]

Source: https://en.wikipedia.org/wiki/Body_proportions

- Average adult is about 7.5 heads tall; an "ideal" figure is 8; a "heroic" figure is 8.5, with extra height coming from a bigger chest and longer legs.
- Head height is used as the yardstick for other lengths.

Recommendation: build operatives at 7.5 to 8 heads (heroic 8 for the player so the silhouette reads), guards at 7 to 7.5 (shorter, bulkier), armoured responders at 7.5 heads but with 25% to 35% extra torso and shoulder width from armour.

Construction guidance below is general modelling practice [AUTHOR] and was not backed by a source in this pass:

| Part | Primitive | Notes |
|---|---|---|
| Torso | tapered box or lathe/capsule, wider at shoulders, narrower at waist; separate chest and abdomen so the spine can bend | chest depth about 60% of width |
| Limbs | tapered cylinders (thicker at upper arm and thigh), sphere joints at elbow/knee | lets IK bend show without gaps |
| Shoulders | sphere or capsule that rotates with the arm | breaks the box look |
| Hands | simple 3-piece: palm box plus finger wedge plus thumb; rotate to grip | readable at 60 px |
| Feet | wedge with heel and toe, rotates with ground | boots add 10% to leg length visually |
| Neck | short cylinder, narrow | head sits forward of the neck in side view |
| Head | slightly squashed sphere with jaw/chin; helmet and goggles do most of the identity | |

### 2.2 Materials in three.js

Verified: three.js MeshPhysicalMaterial exposes `clearcoat`, `sheen` and `sheenRoughness` (https://threejs.org/docs/#api/en/materials/MeshPhysicalMaterial [READ, grep of property list]). Values below are starting points [AUTHOR].

| Material | roughness | metalness | extras |
|---|---|---|---|
| Matte nylon / cordura | 0.85 to 0.95 | 0 | normal map weave, slight sheen |
| Fabric uniform | 0.8 | 0 | `sheen` 0.4 to 0.8, sheen colour lighter than base |
| Kevlar plate carrier | 0.9 | 0 | webbing grid normal map (see 3.2) |
| Hard armour plate / helmet shell | 0.5 to 0.6 | 0 | `clearcoat` 0.2 to 0.4 |
| Metal (rails, buckles) | 0.35 to 0.5 | 1 | dark base colour, needs an environment map |
| Skin | 0.55 to 0.7 | 0 | do not use `sheen`; keep saturation modest |
| Goggle lens | 0.05 to 0.15 | 0 | emissive tint for NVG, `clearcoat` 1 |

### 2.3 What successful games do at small sizes

Only a small amount of verified evidence was found.

- **INSIDE (Playdead):** Fog was "very central to our artstyle". Many early scenes "were literally just fog + silhouettes"; "simple linear fog" with a max-clamp so bright things bleed through; fog and a tight glow pass are separate; lighting split into diffuse, specular and bounce parts. [READ] slides text, via https://github.com/playdeadgames/publications/blob/master/INSIDE/rendering_inside_gdc2016.pdf and https://blog.playdead.com/articles/inside_presentations/inside_publications.html. Take-away: layered depth fog plus strong silhouettes is the cheapest way to make small figures read.
- **Little Nightmares (Tarsier):** "When we design playable characters... we always think about silhouette and shape" and monsters are built by exaggerating a few features. [SEARCH ONLY] https://www.invenglobal.com/articles/19667/little-nightmares-iii-interview-co-op-low-alone-and-the-terrifying-spiral-ahead-of-october-10-release (not opened).
- **Ready or Not (Void):** art director says they "take realism, and we add about another 20 or 30 percent extra on top of it... to make it spicy". [READ] https://www.creativebloq.com/3d/video-game-design/why-ready-or-not-feels-so-real-how-unreal-engine-5-is-delivering-next-level-immersion
- **Door Kickers: Action Squad:** reviews describe detailed, colourful pixel art with cutaway interiors; no artist breakdown found. [SEARCH ONLY]
- **Deadbolt, My Friend Pedro, Shadow Complex, Trine, Splinter Cell:** no usable art breakdown located. See section 6.

Generic techniques [AUTHOR], all standard three.js options: strong key light from above-front plus a coloured back/rim light (a DirectionalLight behind the character, or a Fresnel term in `onBeforeCompile`); a thin inverted-hull outline (back-face mesh scaled along normals) in a dark value; bake a cheap contact shadow under each character; keep character value contrast higher than the background; and use one accent colour per faction.

### 2.4 Free rigged and animated human models

| Source | Licence (as read) | Suitability | URL |
|---|---|---|---|
| Quaternius, Universal Base Characters (26 models, FBX/OBJ/Blend/glTF, tags include "gun", "combat", "locomotion") | CC0 | Low-poly stylised bodies; compatible with their Universal Animation Library | https://quaternius.com/packs/universalbasecharacters.html [READ] |
| Quaternius, Universal Animation Library (locomotion, combat, idle, crawling, death; FBX/GLB/Blend) | CC0 | Humanoid rig animations; page shows "Free to use in personal, educational and commercial projects" | https://quaternius.com/packs/universalanimationlibrary.html [READ] |
| Quaternius, Ultimate Modular Women (10 characters, 24 animations, swappable parts) | CC0 | Stylised | https://quaternius.com/packs/ultimatemodularwomen.html [READ] |
| Quaternius FAQ | "All models are under the CC0 License", no attribution, commercial use allowed, may modify | | https://quaternius.com/faq.html [READ] |
| Quaternius, Zombie Apocalypse Kit (characters, guns, vehicles, animated) | CC0 per site | Stylised survivors | https://quaternius.com/ [READ] |
| Kenney, Animated Characters Protagonists (tags: skater, cyborg, criminal) | CC0 | Very stylised low-poly | https://kenney.nl/assets/animated-characters-1 [READ] |
| Kenney licence statement | "all game assets on the asset pages are public domain licensed (CC0)... even in commercial projects" | | https://kenney.nl/support [READ] |
| Poly Haven | All assets CC0; any purpose incl. commercial | Hosts HDRIs, textures, props. I did not confirm a rigged human-character category exists (the /models/people URL returned 404) | https://polyhaven.com/license [READ] |
| Mixamo | Free "limited duration technology preview" (Adobe community FAQ): no licensing or royalty fees, commercial use allowed, video games explicitly allowed. NOT allowed: redistributing raw character/animation files, selling them in asset packs, any free distribution of raw files | Realistic rigged humans plus large animation library; fine inside a shipped game as long as raw FBXs are not redistributed | https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/td-p/13234775 [READ]. The official Adobe help page returned 403 so it could not be read directly. |
| MakeHuman / MPFB2 | "All core assets are shared under Creative Commons, CC0"; no attribution; MPFB source is GPL and MakeHuman source is AGPL | Realistic, customisable humans, exported with CC0 assets. Third-party assets in packs can carry other licences (CC-BY seen in search summaries, not opened). Site says community services shut down and moved to Discord | https://static.makehumancommunity.org/about/license.html [READ] |
| Ready Player Me | Service shut down 31 January 2026 after the Netflix acquisition (stated by competitors; Netflix announcement dated 19 Dec 2025 in search summaries) | Not usable going forward; previously exported GLBs reportedly still work. Earlier licence was non-commercial CC for unregistered use | https://avatarsdk.com/ready-player-me-alternative/ [READ, a competitor's page so treat with caution]; https://www.pocketgamer.biz/netflix-acquires-avatar-creation-platform-ready-player-me [SEARCH ONLY] |
| Sketchfab CC0 | The help URL tried returned 404; not verified | Quality varies; check each model's licence | not verified |

Is anything realistic enough? Quaternius and Kenney are stylised low-poly, not realistic. Mixamo and MakeHuman are the realistic options. Neither was inspected as a model in this pass, so I cannot say how they look at 60 px. For a side-view game at 50 to 80 px tall, a stylised-realistic Quaternius body re-skinned with real-looking kit textures is likely good enough and avoids Mixamo's redistribution rules. [AUTHOR judgement]

One engineering consequence: a skinned glTF model would replace the code-driven skeleton's capsule meshes but could still be posed by the same procedural system if the rig is retargeted bone-by-bone. That is a larger change than re-modelling the primitives.

---

## 3. Special-forces and security visual language

### 3.1 Verified real-kit facts

| Fact | Source |
|---|---|
| MOLLE uses PALS webbing: rows of heavy-duty nylon; grid is 1-inch (25 mm) tall webbing and gaps with 1.5-inch (38 mm) insert loops. "MOLLE" is now used for any PALS-type gear | https://en.wikipedia.org/wiki/MOLLE [READ] |
| High-cut combat helmets (e.g. FAST) are an established design | https://en.wikipedia.org/wiki/Combat_helmet [READ] |
| Kevlar (aramid) is central to PASGT helmets and vests; boron-carbide ceramic hard plates defeat rifle rounds, faced with Kevlar and a nylon spall layer | https://en.wikipedia.org/wiki/Body_armor [READ] |
| NIJ standard is the widely-used model; ballistic face masks only go up to Level IIIA because of weight | https://en.wikipedia.org/wiki/Body_armor [READ] |
| Ghillie suit: net or cloth covered in loose strips of burlap, cloth, twine or jute to look like foliage | https://en.wikipedia.org/wiki/Ghillie_suit [READ] |
| Coyote brown hex triplet #81613C | https://en.wikipedia.org/wiki/Coyote_brown [READ] |
| SWAT units are equipped with specialised weapons and equipment not normally issued to regular police, for high-risk situations (raids, hostage-taking, standoffs); SWAT element of five: leader, two assaulters, scout, rear guard | https://en.wikipedia.org/wiki/SWAT [READ] |
| Splinter Cell goggles: green three-lens set is Fisher's best-known; Third Echelon's version is described as blue with three lenses | https://splintercell.fandom.com/wiki/File:Motion.jpg [SEARCH ONLY] |

### 3.2 Role silhouette guide at about 50 to 80 px tall

The role definitions and colours below are my design recommendations [AUTHOR]; the only verified inputs are the kit facts in 3.1 and the Ready or Not "realism plus 20 to 30%" principle. No Rainbow Six Siege, SWAT 4 or Modern Warfare art breakdown could be read in this pass (search results were low quality), so none of these are claimed to match those games.

| Role | Silhouette cues (reads at 50 to 80 px) | Palette | Single accent |
|---|---|---|---|
| Operative (player) | Slim-heroic 8 heads; NVG/goggle bar on helmet; low-profile helmet; compact plate carrier; suppressed carbine held at the shoulder; knee pads, gloves | Charcoal #2B2F33 base, coyote #81613C pouches (verified hex), black webbing | Cold cyan or green goggle glow |
| Security guard | Soft cap or bare head, no armour bulk; short-sleeve or shirt; belt with radio; pistol or baton; slightly stooped, relaxed stance | Navy #1F2E4A shirt, light blue or white sleeves, black trousers | Yellow badge/high-vis hint, radio |
| Armoured responder | Widest figure; full-face helmet with visor, shield shape or heavy chest plate, shoulder and groin pads; shotgun or SMG held low | Matte black #16181A with dark grey plates, thin grey MOLLE grid | Red or orange stripe on shoulders and helmet |
| Sniper | Long thin rifle, bipod; ghillie/leaf strips make the outline ragged; crouched or prone; boonie or hood | Olive #4F5B3A and brown with burlap tan | Scope lens glint |
| Officer | Peaked cap; clean jacket, sash/epaulettes; sidearm; stands upright; no pouches | Dark green or grey #3A4A44 jacket, gold trim | Gold braid, white cap band |

Silhouette rules [AUTHOR]: each role needs one unique shape in the head/shoulder region (goggle bar, peaked cap, full visor, ragged ghillie, soft cap); one weapon class per role; one accent colour per faction so friend vs foe is clear under dim lighting.

---

## 4. Concrete upgrades, in priority order

1. **Proper foot planting with analytic IK.** Implement Juckett's two-bone solver (1.3) with a fixed bend sign, clamp reach, pin stance feet in world space, predict footholds from velocity. Biggest visible gain for the least work.
2. **Body hierarchy: COM, then 5-point rig, then bones** (Rosen as described by the Gibbon article). Gameplay moves one COM point; pelvis, feet and hands derive from it.
3. **Pelvis and spine motion.** Pelvis hip-height logic from Johansen (min desired height, capped by max reach), twice-per-stride bob, pelvis yaw and opposite shoulder yaw. Use the 60/40 stance/swing split and about 15° stance knee flex.
4. **Replace boxes and capsules with tapered limbs, sphere joints, a distinct hand and a wedge boot** (2.1), at 7.5 to 8 head proportions.
5. **Role-specific silhouette kit** (3.2): goggle bar, peaked cap, visor, ghillie strips, belt gear. Accent colour per faction.
6. **Materials and lighting:** MeshPhysicalMaterial with sheen on cloth, clearcoat on helmets, a coloured rim light behind the figure, inverted-hull outline, depth fog with a clamp so bright things bleed through (INSIDE).
7. **Secondary motion:** critically damped springs for gun recoil, flinch, landing squash, plus breathing sway.
8. **Ragdoll stiffness:** support sticks and angle limits, 3 to 4 relaxation iterations (Jakobsen).
9. **Optional:** Quaternius CC0 base characters retargeted to the procedural rig, or MakeHuman CC0 export, if a real mesh is preferred over primitives. Avoid depending on Mixamo files in a repo that gets redistributed.

---

## 5. Source index

READ in this pass: Juckett IK, Zucconi IK part 1, Jakobsen slides, Johansen thesis, GDC Vault Rosen page, Game Developer (Rosen post, Rain World post, Gibbon deep dive), Unity forum thread, Unity Rain World article, Playdead INSIDE slides and publications page, Creative Bloq Ready or Not, Quaternius (home, FAQ, three packs), Kenney (asset page, support), Poly Haven licence, MakeHuman licence, Adobe community Mixamo FAQ, Avatar SDK RPM page, three.js MeshPhysicalMaterial docs, Wikipedia (Gait, Walking, Body proportions, Body armor, MOLLE, Combat helmet, Ghillie suit, Coyote brown, SWAT).

## 6. Could not verify

- **Rosen's GDC 2014 talk content** beyond "13 keyframes", the layered-rig description via the Gibbon article and the spring-damper claim (search only). The video is not readable from this sandbox (YouTube returned a bot check; GDC Vault is members-gated video). No transcript or slides found. Wolfire's blog post URL returned 404.
- **Rain World animation talk** (GDC 2016): only a link, no content. Specific solver details (e.g. its limb IK) not verified.
- **Zucconi parts 2 and 3** and the **Juckett constraint-relaxation and CCD articles** were not read in detail.
- **All tuning numbers in 1.5 and 1.6** marked AUTHOR (pelvis bob %, step length ratio, arm swing angles, spring constants, sway frequencies). No read source gave them.
- **Recoil, flinch, look-at, cover lean, vault, mantle, ladder, stairs, landing**: no authoritative write-up was read.
- **Art breakdowns** for Rainbow Six Siege operators, SWAT 4, Modern Warfare 2019 operators, Door Kickers (including Action Squad), Deadbolt, My Friend Pedro, Shadow Complex and Trine: not found or only low-quality search snippets. Little Nightmares quotes are from search summaries only.
- **Splinter Cell goggle design rationale**: nothing authoritative found.
- **Ready Player Me**: shutdown date and cause come from a competitor's page plus search summaries, not a primary Netflix or RPM statement. Its licence terms were not read.
- **Mixamo**: the official Adobe help page was 403. The Adobe community FAQ is a 2022 post that calls the service a "limited duration technology preview", so current terms should be checked at download time.
- **MakeHuman**: the full licence section on exported-model conditions ("output exception") was not read. Third-party asset licences in packs were not read.
- **Sketchfab CC0** licence page: URL tried 404.
- **Realism of free models at game size:** no model was loaded or rendered; realism claims are judgement only.
- **Role colour palettes in 3.2** are design suggestions, not matched to any game.
