import { describe, expect, it } from 'vitest'
import { createFrameGuard } from './frameGuard'

function quietLog(): { lines: string[]; log: (...parts: unknown[]) => void } {
  const lines: string[] = []
  return { lines, log: (...parts) => lines.push(parts.map(String).join(' ')) }
}

describe('frame guard', () => {
  it('a throwing part is caught, logged with what was running, and the frame goes on', () => {
    const { lines, log } = quietLog()
    const guard = createFrameGuard(log)
    let drew = false
    expect(guard.attempt('simulation', () => { throw new Error('boom') })).toBe(false)
    guard.attempt('drawing', () => { drew = true })
    expect(drew).toBe(true)
    expect(guard.endFrame(0)).toBe('running')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('simulation')
    expect(lines[0]).toContain('boom')
  })

  it('the same error is logged once, not every frame', () => {
    const { lines, log } = quietLog()
    const guard = createFrameGuard(log)
    for (let frame = 0; frame < 30; frame++) {
      guard.attempt('simulation', () => { throw new Error('boom') })
      guard.endFrame(frame / 60)
    }
    expect(lines).toHaveLength(1)
  })

  it('errors every frame for a couple of seconds stop the game', () => {
    const guard = createFrameGuard(quietLog().log)
    let state = 'running'
    for (let frame = 0; frame <= 150; frame++) {
      guard.attempt('drawing', () => { throw new Error('bad mesh') })
      state = guard.endFrame(frame / 60)
    }
    expect(state).toBe('stopped')
    expect(guard.details()).toContain('drawing')
    expect(guard.details()).toContain('bad mesh')
  })

  it('a clean frame in between resets the count, and reset starts afresh', () => {
    const guard = createFrameGuard(quietLog().log)
    for (let frame = 0; frame <= 300; frame++) {
      if (frame % 50 !== 0) guard.attempt('simulation', () => { throw new Error('flaky') })
      expect(guard.endFrame(frame / 60)).toBe('running')
    }
    for (let frame = 0; frame <= 150; frame++) {
      guard.attempt('simulation', () => { throw new Error('flaky') })
      guard.endFrame(10 + frame / 60)
    }
    expect(guard.endFrame(13)).toBe('stopped')
    guard.reset()
    expect(guard.endFrame(14)).toBe('running')
  })
})
