import { describe, expect, it } from 'vitest'
import { duePowerImpacts, powerDamageAt, powerKnockback } from './powerEffects'

describe('power effects', () => {
  it('falls nuke damage from full strength at the center to a quarter at the edge', () => {
    expect(powerDamageAt('nuke', 500, { x: 0, z: 0 }, { x: 0, z: 0 }, 4)).toBe(500)
    expect(powerDamageAt('nuke', 500, { x: 4, z: 0 }, { x: 0, z: 0 }, 4)).toBe(125)
    expect(powerDamageAt('strafe', 50, { x: 4, z: 0 }, { x: 0, z: 0 }, 4)).toBe(50)
  })

  it('gives Ogres strong knockback resistance', () => {
    const grunt = powerKnockback('nuke', { id: 1, kind: 'grunt', x: 1, z: 0 }, { x: 0, z: 0 }, 4)
    const ogre = powerKnockback('nuke', { id: 1, kind: 'ogre', x: 1, z: 0 }, { x: 0, z: 0 }, 4)
    expect(ogre.x).toBeCloseTo(grunt.x * 0.25)
  })

  it('schedules every impact even when a simulation step crosses several pulses', () => {
    expect(duePowerImpacts(0.21, 1, 5)).toBe(2)
    expect(duePowerImpacts(1, 1, 5)).toBe(5)
  })
})
