# Directional defenses, tower profiles, and saved layouts

## Player impact

Preparation now communicates the real economy: players see starting and remaining supply, every defense price, free movement, and full-price setup refunds. Tower placement is a deliberate two-click action—anchor, aim, then lock—and every placed tower displays its real combat sector during setup. Rocket and Mortar show their inner dead zones. Combat uses the same distance and angle shown in the preview.

The Armory is now a branching 60-node graph instead of a forced six-step line. Cards clearly label permanent tower, power, wall, and variant unlocks. Stat and profile choices fan out from their relevant tool, so a player can pursue the behavior they want without first buying unrelated stats.

All ten towers now have Standard plus two special profiles that change their role while preserving the weapon family's identity. Standard is always available. Research permanently makes special profiles available, and the player chooses at most one per equipped tower family for each level. Each map remembers its own tower/power loadout, positions, facing, targeting, starting walls, and profile choices across restart, map switching, and reload; challenge layouts remain separate from the normal map layout. If later tuning lowers the supply budget, the saved defense remains visible and editable while Start stays blocked until enough towers are sold.

## Manual QA

- [ ] Complete and lose a campaign run; confirm medals save and only victories unlock the next map.
- [ ] Preview each campaign map; confirm Twin Fork has two lanes, Frozen/Ash have obstacles, and Broken Citadel has three approaches and limited build zones.
- [ ] Play Shattered Expanse; confirm all three spawn regions flow around polygon platforms toward the shared fortress.
- [ ] Start endless mode; confirm the HUD shows ∞ and waves continue beyond five.
- [ ] Open all six challenges and confirm their roster, power, speed, or fortress modifier.
- [ ] Buy research, reload, and confirm unlocked cards and stat changes persist.
- [ ] Confirm Armory branches fan out from their tool root and tower, power, wall, and variant unlock badges are readable.
- [ ] Unlock both profiles for one tower, select each and Standard in turn, and confirm only one profile is active for that tower family.
- [ ] Confirm a locked, unknown, or wrong-family saved profile safely loads as Standard.
- [ ] Enable Unlock All Content and confirm the run is marked unranked.
- [ ] Create two lanes and boulders in Map Forge, export/import JSON, save, refresh, and replay the map.
- [ ] Create an open-field map, draw/edit both polygon types, and confirm towers fit on platforms but not blockers.
- [ ] Pause/resume, switch speed, cast every power, and place/destroy temporary walls.
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
- [ ] Drag Strafe/Cryo horizontally and diagonally, guide Orbital while active, and confirm spent Repair charges disable its control.
- [ ] Let enemies leak; confirm leak totals and visible fortress health/shield hit feedback.
- [ ] Confirm results attribute damage to towers, powers, and wall effects.
- [ ] On Twin Fork, defend/lose the supply cache and confirm its bonus appears correctly in results.
- [ ] Change settings, reload, and confirm UI scale, screen shake, reduced flashes, and focus-loss pause persist.
- [ ] Open devtools, tune a power, spawn one chosen orc, enable fortress invulnerability, and confirm the run becomes unranked.
- [ ] Spawn 5,000 live orcs and run the 50,000-total stream preset; confirm the drawn/live count, stream remainder, and frame/simulation telemetry update.
- [ ] In Map Forge, change wave HP/speed/damage and reward multipliers, mark a boss wave, save/reload, and launch it.
- [ ] Resize to a narrow viewport and confirm setup, battle controls, editors, and overlays remain usable.
