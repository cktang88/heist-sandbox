import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, SpotLight, type Group } from 'three'
import type { Guard } from '../../game/guards'
import type { Vec } from '../../game/types'
import type { World } from '../../game/world'
import { visionCone } from '../../render/cone'

/** Real torch lights for the nearest guards. */
export const TORCH_LIGHTS = 3
/** Sight beams are cheap, so every guard near the view gets one even if it has no real torch light. */
const SIGHT_BEAMS = 10
/** Guards farther than this from the view centre get neither, in tiles. */
const RANGE = 40
const TORCH_COLOR = 0xfff1d6
const CONE_POINTS = 14

export type GuardLights = { update(world: World, view: Vec): void }

/**
 * A guard's torch beam as a flat glowing fan. It uses the same wall-clipped outline as the guard's sight,
 * so what looks lit is exactly what the guard can see: gameplay information, coloured by the guard's state.
 */
function createSightBeam(): Mesh {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(CONE_POINTS * 3), 3))
  const colors = new Float32Array(CONE_POINTS * 3)
  colors.fill(1, 0, 3)
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  const fan: number[] = []
  for (let index = 1; index < CONE_POINTS - 1; index += 1) fan.push(0, index, index + 1)
  geometry.setIndex(fan)
  const beam = new Mesh(geometry, new MeshBasicMaterial({
    color: TORCH_COLOR, vertexColors: true, transparent: true, opacity: 0.2, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false,
  }))
  beam.frustumCulled = false
  beam.visible = false
  return beam
}

function beamColor(guard: Guard): number {
  return guard.state === 'alert' ? 0xff6a50 : guard.state === 'suspicious' ? 0xffd23f : TORCH_COLOR
}

export function createGuardLights(group: Group): GuardLights {
  const torches = Array.from({ length: TORCH_LIGHTS }, () => new SpotLight(TORCH_COLOR, 0, 16, 0.5, 0.7, 1))
  const beams = Array.from({ length: SIGHT_BEAMS }, () => createSightBeam())
  for (const light of torches) group.add(light, light.target)
  group.add(...beams)
  const nearest: Guard[] = []
  const gap: number[] = []

  /** Keeps the nearest living guards, nearest first, in reused arrays. */
  function gather(world: World, view: Vec): void {
    nearest.length = 0
    gap.length = 0
    for (const guard of world.guards) {
      const distance = Math.hypot(guard.x - view.x, (guard.y - view.y) * 1.4)
      if (guard.state === 'dead' || distance > RANGE) continue
      if (nearest.length === SIGHT_BEAMS && distance >= gap[SIGHT_BEAMS - 1]) continue
      let at = Math.min(nearest.length, SIGHT_BEAMS - 1)
      if (nearest.length < SIGHT_BEAMS) {
        nearest.push(guard)
        gap.push(distance)
      }
      while (at > 0 && gap[at - 1] > distance) {
        nearest[at] = nearest[at - 1]
        gap[at] = gap[at - 1]
        at -= 1
      }
      nearest[at] = guard
      gap[at] = distance
    }
  }

  return {
    update(world, view) {
      gather(world, view)
      for (let index = 0; index < TORCH_LIGHTS; index += 1) {
        const light = torches[index]
        const guard = nearest[index]
        if (!guard) {
          light.intensity = 0
          continue
        }
        // The torch sits a little ahead of the guard, so it lights the room and not the guard's own face.
        const eyeX = guard.x + guard.w / 2 + guard.facing * 1.1
        const eyeY = guard.y + 0.55
        light.intensity = 14
        light.color.setHex(guard.state === 'alert' ? 0xffd0b0 : TORCH_COLOR)
        light.position.set(eyeX, -eyeY, 0.5)
        light.target.position.set(eyeX + guard.facing * 8, -eyeY - 1.2, -0.3)
        light.target.updateMatrixWorld()
      }
      for (let index = 0; index < SIGHT_BEAMS; index += 1) {
        const beam = beams[index]
        const guard = nearest[index]
        beam.visible = Boolean(guard)
        if (!guard) continue
        const outline = beam.geometry.getAttribute('position')
        visionCone(world, guard).forEach((corner, at) => outline.setXYZ(at, corner.x, -corner.y, 0.12))
        outline.needsUpdate = true
        ;(beam.material as MeshBasicMaterial).color.setHex(beamColor(guard))
      }
    },
  }
}
