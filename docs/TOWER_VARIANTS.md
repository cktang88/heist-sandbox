# Tower profile catalog

Every tower has one implicit **Standard** profile plus exactly two special profiles. Standard is always available. Research permanently makes special profiles available; it does not automatically equip them and selecting one costs no medals. A player chooses at most one special profile per tower family for each level, or keeps Standard. The map layout stores that choice and applies it to every placement of the family.

A placement stores the stable ID in `variantId`. Omitting it, using an unknown or locked ID, or using an ID from another tower safely selects Standard. Special profiles are sidegrades that preserve the original weapon family while changing its practical role.

| Tower | Special profile | Stable ID | Gameplay change | Research node |
|---|---|---|---|---|
| Rivet Gun | Armor Piercer | `gunner-armor-piercer` | Slower, harder, longer-range anti-armor rivets | `gunner-05` |
| Rivet Gun | Rapid Feed | `gunner-rapid-feed` | Very fast light rivets at shorter range | `gunner-03` |
| Heavy Gun | Anti-Armor | `heavy-anti-armor` | Slower, narrow sustained heavy fire | `gunner-05` |
| Heavy Gun | Siege Feed | `heavy-siege` | Faster sustained suppression at shorter range | `gunner-06` |
| Blast Cannon | Hypervelocity | `cannon-hypervelocity` | Fast dense shell with a tight blast | `explosives-04` |
| Blast Cannon | Cluster | `cannon-cluster` | Lower initial hit followed by secondary blasts | `explosives-05` |
| Rocket Battery | Guided | `rocket-guided` | Slow precise anti-heavy rockets with a tight blast | `explosives-04` |
| Rocket Battery | Salvo | `rocket-salvo` | Rapid smaller rockets for crowds | `explosives-05` |
| Flame Thrower | Napalm | `flame-napalm` | Lower direct damage and a longer, stronger burn | `fire-05` |
| Flame Thrower | Funeral Pyre | `flame-funeral-pyre` | Wider flame whose burning victims spread fire | `fire-06` |
| Cryo Projector | Brittle | `cryo-brittle` | Faster deep freeze that primes explosive damage | `cryo-05` |
| Cryo Projector | Chain Freeze | `cryo-chain-freeze` | Freeze jumps to another nearby target | `cryo-06` |
| Tesla Coil | Stun Coil | `tesla-stun` | Weaker arcs chain farther and briefly stop survivors | `energy-04` |
| Tesla Coil | Overcharge | `tesla-overcharge` | Slow, high-damage single-target electric bursts | `energy-03` |
| Laser Lance | Piercing | `laser-piercing` | A thinner beam damages aligned enemies behind its target | `energy-06` |
| Laser Lance | Prism | `laser-prism` | Rapid short beam for scattered targets | `energy-05` |
| Field Mortar | Concussion | `mortar-concussion` | Weaker, faster, wider blasts stun survivors | `artillery-05` |
| Field Mortar | Cluster | `mortar-cluster` | Slower long-range blast with secondary shells | `artillery-06` |
| Support Beacon | Overclock | `support-overclock` | Smaller aura favors a much stronger fire-rate boost | `command-05` |
| Support Beacon | Fortress | `support-fortress` | Wider, balanced damage and fire-rate network | `command-06` |

The catalog and stat transforms live in `src/game/towerVariants.ts`. The selection rules live in `src/game/variantSelection.ts`; the research badges use the same stable mapping in `src/game/upgrades.ts`; combat reads the stored profile from each placement. This keeps research availability, setup choice, saved layout, visuals, and combat behavior aligned without putting profile switches throughout the UI.
