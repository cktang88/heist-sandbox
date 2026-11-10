import { DirectionalLight, Group, HemisphereLight, Object3D, PointLight, SpotLight } from 'three'
import type { Lamp } from '../game/level'
import { isSolidAt } from '../game/tiles'
import { centerOf, type Vec } from '../game/types'
import type { World } from '../game/world'

/**
 * The number of lights is fixed, because adding or removing one forces every material to be rebuilt.
 * Each frame the nearest lamps, torches and flashes are handed a light from these pools.
 */
const LAMP_LIGHTS = 9
const SHADOWED_LAMPS = 3
const TORCH_LIGHTS = 3
const FLASH_LIGHTS = 4

const LAMP_COLORS = { warm: 0xffd9a8, cold: 0xcfe0ff, green: 0x9fe6ad } as const
const MOON_COLOR = 0x9fb8ff
const TORCH_COLOR = 0xfff1d6
const FLASH_COLOR = 0xffb060

export type LightRig = { group: Group; update(world: World, view: Vec): void }

export function lampIsLit(world: World, lamp: Lamp): boolean {
  return !lamp.hung || isSolidAt(world.grid, lamp.x, lamp.y - 0.7)
}

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

  const lamps = Array.from({ length: LAMP_LIGHTS }, (_, index) => spot(LAMP_COLORS.warm, 1.35, 15, index < SHADOWED_LAMPS ? 1024 : 0))
  const torches = Array.from({ length: TORCH_LIGHTS }, () => spot(TORCH_COLOR, 0.5, 16, 0))
  const flashes = Array.from({ length: FLASH_LIGHTS }, () => new PointLight(FLASH_COLOR, 0, 16, 1.6))
  const playerFill = new PointLight(0xa8c4ff, 2.2, 6, 1.8)
  for (const light of [...lamps, ...torches]) group.add(light, light.target)
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
        if (!lamp || near(lamp) > 40) return void (light.intensity = 0)
        light.color.setHex(LAMP_COLORS[lamp.color])
        light.intensity = lamp.hung ? 9 : 22
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
