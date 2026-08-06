# Command-board interface and battlefield game feel

## Player impact

Preparation now communicates the real economy: players see starting and remaining supply, every defense price, free movement, and full-price setup refunds. Tower placement is a deliberate two-click action—anchor, aim, then lock—and every placed tower displays its real combat sector during setup. Rocket and Mortar show their inner dead zones. Combat uses the same distance and angle shown in the preview.

The Armory is now an 83-node dependency graph. Stats, towers, variants, powers, walls, and doctrines have distinct card treatments. Every special weapon profile owns a separate card after its relevant fully ranked stat path; Standard weapons no longer inherit a profile's special behavior. Right-angle parent-to-child arrows replace ambiguous crossed lines, and redundant visible requirement text is gone.

The battlefield now responds at every important event without turning slapstick: towers recoil and flash, bright weapon-colored tracers begin at the measured barrel tip, heavy rounds arc, impacts emit bounded sparks and force, orcs march instead of gliding, dead orcs remain as corpses, the fortress accumulates visible damage, and Ogres carry a clear boss marker and health bar. Knockback strength follows weapon/upgrades/profile data and collision-tested substeps prevent it from crossing walls or terrain.

The camera fits each map and offers bounded wheel/button zoom without changing the simulation. The UI now uses an original forged field-command style—iron frames, parchment/brass type, red orders, stronger selections, and code-native ornament—instead of generic flat panels.

Command research now unlocks four exclusive doctrine choices with different run effects. Right- and middle-button dragging pans the battlefield, and FIT recenters it. A confirmed surrender produces an ordered retreat and preserves only progress genuinely earned before withdrawal. Campaign enemies arrive in road-width ranks instead of single file; Shattered Expanse spreads its front across nearly the full left entrance.

Corridor hordes remain on the painted road even when temporary walls are present. A wall forms a hard blockade: ordinary orcs queue and attack it instead of receiving an invisible grass detour. Campaign Command Medals are readable and predictable: the eliminated percentage is the base reward, the first clear adds 50, and completed-map replays pay half. A full first clear pays 150 base medals and a full replay pays 50, enough for at least two common research purchases.

The after-action report now leads with Command Medals instead of an undifferentiated number grid. Ranked losses visibly award elimination medals. Unranked reports name the exact progression lock—Sandbox, custom tuning, Unlock All, or a runtime diagnostic—and offer a one-click return to default ranked settings. Battle details sit below the reward, while damage by source is collapsed until requested.

Green March is now a short 107-enemy teaching battle instead of a 636-enemy endurance wall. It keeps three-wide horde fronts but reduces tutorial fortress damage; a deterministic four-Rivet deployment can clear it. Tower bodies and previews are half-size, and placement clearances now match their compact visible footprint with a little edge/overlap tolerance.

## Manual QA

- [ ] Complete and lose a campaign run; confirm medals save and only victories unlock the next map.
- [ ] Preview each campaign map; confirm Twin Fork has two lanes, Frozen/Ash have obstacles, and Broken Citadel has three approaches and limited build zones.
- [ ] Play Shattered Expanse; confirm all three spawn regions flow around polygon platforms toward the shared fortress.
- [ ] Start Green March and confirm three-orc ranks arrive rapidly instead of one orc per long interval. On Shattered Expanse, confirm the opening front spans nearly the full left edge.
- [ ] Block both Twin Fork lanes with baseline walls; confirm dense hordes stay on the painted roads, queue at each wall, attack, and advance only after it breaks.
- [ ] Eliminate 54 of Green March's 107 enemies and confirm the report shows 50% eliminated and 50 base Command Medals. Complete it once for the +50 first-clear bonus, then replay it and confirm the same elimination reward is halved.
- [ ] Deploy four well-aimed Rivet Guns on Green March and confirm the 107-enemy teaching operation is winnable without powers or research.
- [ ] Pack towers closely beside a road and near platform/map edges; confirm visibly separated half-size bases are accepted while true intersections remain rejected.
- [ ] Finish a new map and confirm the result can normally purchase at least two available early or mid-cost research upgrades.
- [ ] Lose a ranked campaign or challenge run after earning kills; confirm Command Medals Earned is the first result and the saved medal bank increases.
- [ ] Change a tuning value, lose a run, and confirm both deployment and results clearly state that custom tuning disables medals. Use Restore Ranked Settings and confirm the warning disappears.
- [ ] Start endless mode; confirm the HUD shows ∞ and waves continue beyond five.
- [ ] Open all six challenges and confirm their roster, power, speed, or fortress modifier.
- [ ] Buy research, reload, and confirm unlocked cards and stat changes persist.
- [ ] Inspect Gunner, Explosives, Energy, and Command research. Confirm arrows end at their actual child cards, no `REQUIRES X` labels appear, and stat/tower/variant/power/doctrine cards are distinguishable without reading their descriptions.
- [ ] Max Polished Action to 3/3, then unlock the separate Rapid Feed card. Confirm 1/3 or 2/3 cannot unlock it and Standard remains unchanged until Rapid Feed is equipped.
- [ ] Confirm Armory branches fan out from their tool root and tower, power, wall, and variant unlock badges are readable.
- [ ] Unlock both profiles for one tower, select each and Standard in turn, and confirm only one profile is active for that tower family.
- [ ] Inspect all ten tower families and both profiles for each; confirm the family silhouette and equipped-profile hardware remain recognizable at normal top-down zoom without relying on the accent color.
- [ ] Confirm a locked, unknown, or wrong-family saved profile safely loads as Standard.
- [ ] Enable Unlock All Content and confirm the run is marked unranked.
- [ ] Create two lanes and boulders in Map Forge, export/import JSON, save, refresh, and replay the map.
- [ ] Create an open-field map, draw/edit both polygon types, and confirm towers fit on platforms but not blockers.
- [ ] Pause/resume, switch speed, cast every power, and place/destroy temporary walls.
- [ ] Unlock each Command doctrine, confirm locked doctrines cannot be equipped, and verify selecting one clears the previous doctrine.
- [ ] Drag the battlefield with right and middle mouse buttons at several zoom levels; confirm stationary right-click still cancels and FIT recenters.
- [ ] Surrender, cancel once, then confirm; verify the ordered-retreat report appears and a zero-progress retreat earns no medals.
- [ ] Place two temporary walls and confirm the six-second recharge and remaining charges are visible.
- [ ] In setup, confirm starting/remaining supply and each price are visible. Buy, move, sell, undo, and clear; confirm movement is free and every refund is 100%.
- [ ] Place each weapon by clicking once to anchor and once to lock its aim. Confirm right-click/Escape cancels either step.
- [ ] Confirm all setup towers show a range sector, Rocket/Mortar mark their dead zones, and Support Beacon shows a full 360° aura.
- [ ] Put an enemy inside range but behind a tower, start combat, and confirm the tower waits for a target inside its shown angle.
- [ ] Tune one firing angle and buy a relevant arc upgrade; confirm both preview and combat behavior widen.
- [ ] Select a placed defense, change targeting, move and re-aim it, sell it, rotate a wall with `R`, and cancel a move with Escape/right-click.
- [ ] Build different layouts on two maps, switch between them, restart, and reload; confirm each map restores its own layout and profile choices.
- [ ] Build a challenge layout on a campaign map and confirm it does not replace that map's campaign/endless layout.
- [ ] Place a temporary wall during combat, restart, and confirm that combat-only wall was not added to the saved setup.
- [ ] Use a Strafe and Nuke; confirm repeated Strafe impacts, center-weighted Nuke damage, knockback, and Ogre resistance.
- [ ] Fire direct and heavy weapons; confirm each tracer begins at the visible barrel tip, Rivet/ballistic lines are yellow-orange rather than black, Cannon/Rocket/Mortar arcs remain distinct, and corpses remain visible.
- [ ] Knock enemies toward temporary walls, polygon terrain, and the map edge; confirm they stop or slide rather than crossing.
- [ ] Let fortress health cross 70% and 30%; confirm cracks, rubble, and smoke stage clearly without covering the route.
- [ ] Spawn an Ogre and confirm its marker and health bar remain readable in a dense horde.
- [ ] Spawn every enemy role and confirm shields, plate shells, spirit orbs, banners, bomb packs, rage horns, size classes, and the Ogre presentation identify them without reading UI text.
- [ ] Use wheel and `− / FIT / +` zoom while paused and under fortress shake; confirm world targeting remains aligned and off-screen enemies continue moving.
- [ ] Review briefing, deployment, battle controls, Armory, settings, and results at desktop and narrow widths for the forged command-board visual language.
- [ ] Drag Strafe/Cryo horizontally and diagonally, guide Orbital while active, and confirm spent Repair charges disable its control.
- [ ] Let enemies leak; confirm leak totals and visible fortress health/shield hit feedback.
- [ ] Confirm results attribute damage to towers, powers, and wall effects.
- [ ] On Twin Fork, defend/lose the supply cache and confirm its bonus appears correctly in results.
- [ ] Change settings, reload, and confirm UI scale, screen shake, reduced flashes, and focus-loss pause persist.
- [ ] Open devtools, tune a power, spawn one chosen orc, enable fortress invulnerability, and confirm the run becomes unranked.
- [ ] Use PREVIEW ALL STATUS FX and confirm burn, slow, freeze, stun, brittle, and armor break use distinct shapes; confirm simultaneous real combat statuses remain layered.
- [ ] Spawn 5,000 live orcs and run the 50,000-total stream preset; confirm the drawn/live count, stream remainder, and frame/simulation telemetry update.
- [ ] In Map Forge, change wave HP/speed/damage and reward multipliers, mark a boss wave, save/reload, and launch it.
- [ ] Resize to a narrow viewport and confirm setup, battle controls, editors, and overlays remain usable.
