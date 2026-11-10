import { describe, expect, it } from 'vitest'
import { addProp } from '../hazards/testWorld'
import { addGuard, addLamp, arena, GROUND, putPlayer, run } from './testArena'

describe('small oddities', () => {
  it('a veteran notices a desk dragged far from where it stood; a regular does not', () => {
    for (const tier of ['veteran', 'regular'] as const) {
      const world = arena()
      addLamp(world, 26)
      const desk = addProp(world, 'desk', 20, GROUND)
      putPlayer(world, 18.6)
      run(world, 0.1)
      // Hold grab beside the desk and walk it four tiles along.
      run(world, 2, { grab: true, right: true }, () => desk.x >= 24)
      run(world, 0.1)
      expect(desk.x).toBeGreaterThanOrEqual(23)
      putPlayer(world, 80)
      const guard = addGuard(world, 34, -1, 'post', GROUND, tier)
      run(world, 1.5)
      if (tier === 'veteran') expect(guard.interest?.tamper).toBe('moved')
      else expect(guard.interest).toBeNull()
    }
  })
})
