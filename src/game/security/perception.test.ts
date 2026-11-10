import { describe, expect, it } from 'vitest'
import { emitNoise } from '../noise'
import { addGuard, addLamp, addWall, arena, putPlayer, run } from './testArena'
import { AWARENESS } from './tuning'

function crouchedPlayerAt(x: number, lit: boolean) {
  const world = arena()
  putPlayer(world, x)
  if (lit) addLamp(world, x)
  const guard = addGuard(world, x + 6, -1)
  return { world, guard }
}

describe('guard perception', () => {
  it('a guard in the dark misses a crouched player that a guard in the light notices', () => {
    for (const lit of [false, true]) {
      const { world, guard } = crouchedPlayerAt(20, lit)
      run(world, 3, { crouch: true }, () => {
        world.player.crouching = true
      })
      if (lit) expect(guard.awareness).toBeGreaterThanOrEqual(AWARENESS.noticeAt)
      else expect(guard.awareness).toBe(0)
    }
  })

  it('does not see through walls', () => {
    const world = arena()
    putPlayer(world, 20)
    addLamp(world, 20)
    addWall(world, 23)
    const guard = addGuard(world, 26, -1)
    run(world, 3)
    expect(guard.awareness).toBe(0)
    expect(guard.mode).toBe('calm')
  })

  it('only catches movement out of the corner of his eye, and never goes straight to combat from it', () => {
    const world = arena()
    putPlayer(world, 20)
    addLamp(world, 20)
    const guard = addGuard(world, 17, -1)
    run(world, 2)
    expect(guard.awareness).toBe(0)
    run(world, 0.6, { right: true })
    expect(guard.mode).not.toBe('combat')
    expect(guard.awareness).toBeLessThanOrEqual(AWARENESS.peripheralCap)
  })

  it('hears a noise in the open but not the same noise through two walls', () => {
    for (const walled of [false, true]) {
      const world = arena()
      putPlayer(world, 5)
      const guard = addGuard(world, 40, -1)
      if (walled) {
        addWall(world, 36)
        addWall(world, 38)
      }
      emitNoise(world, { x: 31, y: 29 }, 12)
      expect(guard.mode).toBe(walled ? 'calm' : 'noticed')
    }
  })
})
