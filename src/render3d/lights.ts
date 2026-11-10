import { AdditiveBlending, BufferGeometry, CanvasTexture, ConeGeometry, Float32BufferAttribute, DirectionalLight, DoubleSide, Group, HemisphereLight, Mesh, MeshBasicMaterial, Object3D, PointLight, SpotLight } from 'three'
import { lampIsLit } from '../game/light'
import { centerOf, type Vec } from '../game/types'
import { visionCone } from '../render/cone'
import type { World } from '../game/world'

/**
 * The number of lights is fixed, because adding or removing one forces every material to be rebuilt.
 * Each frame the nearest lamps, torches and flashes are handed a light from these pools.
 */
const LAMP_LIGHTS = 9
const SHADOWED_LAMPS = 3
const TORCH_LIGHTS = 3
const FLASH_LIGHTS = 4
/** Sight beams are cheap, so every guard near the view gets one even if it has no real torch light. */
const SIGHT_BEAMS = 10

/** Light output of a lamp with strength 1. */
const LAMP_INTENSITY = 9
const MOON_COLOR = 0x9fb8ff
const TORCH_COLOR = 0xfff1d6
const FLASH_COLOR = 0xffb060

export type LightRig = { group: Group; update(world: World, view: Vec): void }

export { lampIsLit } from '../game/light'

function spot(color: number, angle: number, distance: number, shadowSize: number): SpotLight {
  // A gentle falloff keeps a small room evenly lit instead of scorching whatever stands under the lamp.
  const light = new SpotLight(color, 0, distance, angle, 0.7, 1)
  if (shadowSize > 0) {
    light.castShadow = true
    light.shadow.mapSize.set(shadowSize, shadowSize)
    light.shadow.bias = -0.0015
    light.shadow.normalBias = 0.03
    light.shadow.camera.near = 0.3
    light.shadow.camera.far = distance
  }
  return light
}

/** A faint see-through cone that makes a light's beam visible, as if the air were a little dusty. */
function createBeam(color: number, length: number, spread: number, strength: number): Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 64
  const c = canvas.getContext('2d')!
  const fade = c.createLinearGradient(0, 0, 0, 64)
  fade.addColorStop(0, 'rgba(255,255,255,1)')
  fade.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = fade
  c.fillRect(0, 0, 4, 64)
  const cone = new ConeGeometry(Math.tan(spread) * length, length, 28, 1, true)
  // Move the tip to the origin, so the beam can simply be placed at the light.
  cone.translate(0, -length / 2, 0)
  const beam = new Mesh(cone, new MeshBasicMaterial({
    map: new CanvasTexture(canvas), color, transparent: true, opacity: strength, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false,
  }))
  beam.visible = false
  return beam
}

const CONE_POINTS = 14

/**
 * A guard's torch beam as a flat glowing fan. It uses the same wall-clipped outline as the guard's sight,
 * so what looks lit is exactly what the guard can see.
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

export function createLights(): LightRig {
  const group = new Group()

  // A whisper of sky fill so shadows are deep blue instead of pure black.
  group.add(new HemisphereLight(0x1c2740, 0x0b0907, 0.22))

  const moon = new DirectionalLight(MOON_COLOR, 0.55)
  moon.castShadow = true
  moon.shadow.mapSize.set(2048, 2048)
  moon.shadow.camera.left = -34
  moon.shadow.camera.right = 34
  moon.shadow.camera.top = 26
  moon.shadow.camera.bottom = -26
  moon.shadow.camera.near = 1
  moon.shadow.camera.far = 120
  moon.shadow.bias = -0.0008
  moon.shadow.normalBias = 0.05
  group.add(moon, moon.target)

  const lamps = Array.from({ length: LAMP_LIGHTS }, (_, index) => spot(0xffd9a8, 1.35, 15, index < SHADOWED_LAMPS ? 1024 : 0))
  const torches = Array.from({ length: TORCH_LIGHTS }, () => spot(TORCH_COLOR, 0.5, 16, 0))
  const flashes = Array.from({ length: FLASH_LIGHTS }, () => new PointLight(FLASH_COLOR, 0, 16, 1.6))
  const playerFill = new PointLight(0xa8c4ff, 2.2, 6, 1.8)
  const lampBeams = lamps.map(() => createBeam(0xffe2b8, 5.2, 0.62, 0.05))
  const torchBeams = Array.from({ length: SIGHT_BEAMS }, () => createSightBeam())
  for (const light of [...lamps, ...torches]) group.add(light, light.target)
  group.add(...lampBeams, ...torchBeams)
  group.add(...flashes, playerFill)

  const aim = (light: SpotLight, target: Object3D, x: number, y: number, z: number) => {
    target.position.set(x, y, z)
    target.updateMatrixWorld()
    void light
  }

  return {
    group,
    update(world, view) {
      // Moonlight comes from over the camera's shoulder, so building fronts catch it.
      moon.position.set(view.x - 22, -view.y + 38, 34)
      moon.target.position.set(view.x, -view.y, 0)
      moon.target.updateMatrixWorld()

      const near = (point: Vec) => Math.hypot(point.x - view.x, (point.y - view.y) * 1.4)
      const lit = world.lamps.filter((lamp) => lampIsLit(world, lamp)).sort((a, b) => near(a) - near(b))
      lamps.forEach((light, index) => {
        const lamp = lit[index]
        lampBeams[index].visible = Boolean(lamp) && near(lamp) <= 40
        if (!lamp || near(lamp) > 40) return void (light.intensity = 0)
        lampBeams[index].position.set(lamp.x, -lamp.y - 0.2, -0.6)
        ;(lampBeams[index].material as MeshBasicMaterial).color.setHex(lamp.color)
        light.color.setHex(lamp.color)
        light.intensity = LAMP_INTENSITY * lamp.strength
        light.position.set(lamp.x, -lamp.y - 0.25, -0.5)
        aim(light, light.target, lamp.x, -lamp.y - 6, -0.9)
      })

      const awake = world.guards.filter((guard) => guard.state !== 'dead').sort((a, b) => near(a) - near(b))
      torches.forEach((light, index) => {
        const guard = awake[index]
        if (!guard || near(guard) > 34) return void (light.intensity = 0)
        // The torch sits a little ahead of the guard, so it lights the room and not the guard's own face.
        const eye = { x: guard.x + guard.w / 2 + guard.facing * 1.1, y: guard.y + 0.55 }
        light.intensity = 14
        light.color.setHex(guard.state === 'alert' ? 0xffd0b0 : TORCH_COLOR)
        light.position.set(eye.x, -eye.y, 0.5)
        aim(light, light.target, eye.x + guard.facing * 8, -eye.y - 1.2, -0.3)
      })

      torchBeams.forEach((beam, index) => {
        const guard = awake[index]
        beam.visible = Boolean(guard) && near(guard) <= 40
        if (!beam.visible) return
        const outline = beam.geometry.getAttribute('position')
        visionCone(world, guard).forEach((corner, at) => outline.setXYZ(at, corner.x, -corner.y, 0.12))
        outline.needsUpdate = true
        ;(beam.material as MeshBasicMaterial).color.setHex(guard.state === 'alert' ? 0xff6a50 : guard.state === 'suspicious' ? 0xffd23f : TORCH_COLOR)
      })

      const bursts = world.effects.flashes.filter((flash) => flash.kind !== 'noise').sort((a, b) => b.radius - a.radius)
      flashes.forEach((light, index) => {
        const flash = bursts[index]
        if (!flash) return void (light.intensity = 0)
        const strength = flash.life / flash.duration
        light.intensity = (flash.kind === 'explosion' ? 500 : 60) * strength
        light.position.set(flash.x, -flash.y, 0.4)
      })

      const player = centerOf(world.player)
      playerFill.position.set(player.x, -player.y, 1.6)
    },
  }
}
