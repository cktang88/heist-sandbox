import { describe, expect, it } from 'vitest'
import { addProp } from '../hazards/testWorld'
import { addLamp, arena, GROUND, putPlayer, run } from '../security/testArena'
import { stealthCues } from './cues'
import { stealthRating } from './rating'

const texts = (world: Parameters<typeof stealthCues>[0]) => stealthCues(world).map((cue) => cue.text)

describe('stealth cues on the HUD', () => {
  it('says when the player is in darkness, in cover, making noise, or hidden', () => {
    const world = arena()
    addProp(world, 'desk', 21, GROUND)
    putPlayer(world, 20)
    run(world, 0.3, { crouch: true })
    expect(texts(world)).toEqual(['IN DARKNESS', 'IN COVER'])
    addLamp(world, 30)
    putPlayer(world, 30)
    run(world, 0.3, { right: true })
    expect(texts(world)).toContain('NOISY: FOOTSTEPS')
    expect(texts(world)).not.toContain('IN DARKNESS')
    addProp(world, 'wallLocker', 40, GROUND)
    putPlayer(world, 40)
    run(world, 1 / 60)
    run(world, 1 / 60, { interact: true, interactPressed: true })
    expect(texts(world)).toEqual(['HIDDEN IN LOCKER'])
  })

  it('says why a disguise is not working', () => {
    const world = arena()
    world.stealth.disguise = { officer: false }
    putPlayer(world, 20)
    run(world, 0.1)
    expect(texts(world)).toContain('DISGUISED')
    world.player.tool = 1
    expect(texts(world)).toContain('DISGUISE BLOWN: BIG GUN OUT')
  })
})

describe('the end-of-heist rating', () => {
  it('is Ghost for a clean run, Silent if someone was seen or found without an alarm, Loud after an alarm', () => {
    const world = arena()
    expect(stealthRating(world).name).toBe('GHOST')
    world.stats.knockouts = 3
    expect(stealthRating(world).name).toBe('GHOST')
    world.stats.bodiesFound = 1
    expect(stealthRating(world).name).toBe('SILENT')
    world.stats.alarms = 1
    expect(stealthRating(world).name).toBe('LOUD')
  })
})
