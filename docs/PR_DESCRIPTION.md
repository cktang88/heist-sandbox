# Orcfall Command playable vertical slice

## Player impact

This turns the empty prototype workspace into a playable top-down horde defense game with a complete preparation/combat/progression loop. Players can research tools, fight six campaign missions with distinct maps and wave compositions, choose endless/challenge runs, place defenses before the horn, cast battlefield powers during combat, earn persistent medals, and create custom corridor or open-field polygon maps.

The game uses original low-poly visuals and a handwritten field-command interface. Developer-facing Map Forge and tuning tools make maps and balance values quick to change without editing simulation code. Map Forge keeps multiple custom battlefields, migrates older saves, authors dimensions, lanes, build zones, decorations, and wave groups, swaps terrain palettes, and launches any selected map directly in Sandbox. Live devtools also tune powers, inject chosen enemies, protect the fortress, and label cheat-assisted runs unranked.

Shattered Expanse replaces fixed corridors with a broad walkable field and raised polygon platforms. Orcs route around those solids while towers deploy on top. The renderer and simulation support a 5,000-live diagnostic crowd and a 50,000-total continuous stream held below that live cap, with live frame and simulation telemetry.

## Manual QA

- [ ] Complete and lose a campaign run; confirm medals save and only victories unlock the next map.
- [ ] Preview each campaign map; confirm Twin Fork has two lanes, Frozen/Ash have obstacles, and Broken Citadel has three approaches and limited build zones.
- [ ] Play Shattered Expanse; confirm all three spawn regions flow around polygon platforms toward the shared fortress.
- [ ] Start endless mode; confirm the HUD shows ∞ and waves continue beyond five.
- [ ] Open all six challenges and confirm their roster, power, speed, or fortress modifier.
- [ ] Buy research, reload, and confirm unlocked cards and stat changes persist.
- [ ] Enable Unlock All Content and confirm the run is marked unranked.
- [ ] Create two lanes and boulders in Map Forge, export/import JSON, save, refresh, and replay the map.
- [ ] Create an open-field map, draw/edit both polygon types, and confirm towers fit on platforms but not blockers.
- [ ] Pause/resume, switch speed, cast every power, and place/destroy temporary walls.
- [ ] Place two temporary walls and confirm the six-second recharge and remaining charges are visible.
- [ ] In setup, select a placed defense, change targeting, move/sell it, rotate a wall with `R`, and cancel a move with Escape/right-click.
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
