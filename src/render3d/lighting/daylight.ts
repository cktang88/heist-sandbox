import { Color, DirectionalLight, HemisphereLight, type FogExp2, type Group, type Scene, type WebGLRenderer } from 'three'
import type { TimeOfDay } from '../../game/site'
import type { Vec } from '../../game/types'

/**
 * The light that does not come from lamps: the sun or moon, the sky's fill, and the camera settings that go with
 * them. Interiors are kept out of the sun and moon by the shadow sheets in front of the building, so these mostly
 * light the outside; the sky fill reaches everywhere, so it is kept low enough that rooms still depend on lamps.
 */
export type Sky = {
  sunColor: number
  sunIntensity: number
  /** Where the sun or moon sits relative to the view centre, in tiles: over the camera's shoulder and above. */
  sunOffset: readonly [number, number, number]
  skyColor: number
  groundColor: number
  skyIntensity: number
  /** How strongly outdoor lamps' halos show: a street light's haze is lost in daylight. */
  outdoorGlow: number
  exposure: number
  /** How much the photographed sky lights everything through reflections. It reaches into rooms evenly, so it is
   * kept low: a strong one flattens the pools of lamp light into an even grey. */
  environment: number
  fogColor: number
  fogDensity: number
}

export const NIGHT: Sky = {
  sunColor: 0x9fb8ff, sunIntensity: 0.5, sunOffset: [-22, 38, 34],
  skyColor: 0x1c2740, groundColor: 0x0b0907, skyIntensity: 0.16,
  outdoorGlow: 1, exposure: 1.15, environment: 0.35, fogColor: 0x0b1018, fogDensity: 0.0028,
}

/** A soft overcast day: a bright, slightly warm sun high up, and a pale sky fill. */
export const DAY: Sky = {
  sunColor: 0xfff0dc, sunIntensity: 2.6, sunOffset: [-16, 64, 40],
  skyColor: 0x9db4cc, groundColor: 0x3a342b, skyIntensity: 0.2,
  outdoorGlow: 0.25, exposure: 1.0, environment: 0.45, fogColor: 0x9aa7b4, fogDensity: 0.0032,
}

export function skyFor(timeOfDay: TimeOfDay): Sky {
  return timeOfDay === 'day' ? DAY : NIGHT
}

/** Sets the camera exposure, sky reflections and haze for the time of day. Cheap enough to call every frame. */
export function applyAtmosphere(timeOfDay: TimeOfDay, scene: Scene, renderer: WebGLRenderer): void {
  const sky = skyFor(timeOfDay)
  renderer.toneMappingExposure = sky.exposure
  scene.environmentIntensity = sky.environment
  const fog = scene.fog as FogExp2 | null
  if (!fog) return
  fog.color.setHex(sky.fogColor)
  fog.density = sky.fogDensity
}

/** In alarm the whole place takes on a faint red cast, as if from the beacons. */
const ALARM_RED = new Color(0x6a0c0c)

export type SkyLights = { update(timeOfDay: TimeOfDay, view: Vec, alarm: boolean, gridVersion: number): Sky }

/**
 * The sun's shadow map is not redrawn every frame. Its camera moves in steps of this many tiles (the map covers well
 * beyond the screen, so a step never uncovers the view), and the map is redrawn when it steps, when the level
 * changes shape, or every few frames for people moving outdoors.
 */
const SUN_STEP = 6
const SUN_REDRAW_FRAMES = 4

/** The sun or moon (one shadowed light fitted to the view) and the sky fill. */
export function createSkyLights(group: Group): SkyLights {
  const fill = new HemisphereLight(NIGHT.skyColor, NIGHT.groundColor, NIGHT.skyIntensity)
  const sun = new DirectionalLight(NIGHT.sunColor, NIGHT.sunIntensity)
  sun.castShadow = true
  // The map covers about one screen; 1024 texels is still finer than a pixel per texel at this zoom, at a quarter of the cost.
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -34
  sun.shadow.camera.right = 34
  sun.shadow.camera.top = 26
  sun.shadow.camera.bottom = -26
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 140
  sun.shadow.bias = -0.0008
  sun.shadow.normalBias = 0.05
  sun.shadow.autoUpdate = false
  sun.shadow.needsUpdate = true
  group.add(fill, sun, sun.target)
  let anchor = { x: NaN, y: NaN }
  let version = -1
  let frames = 0
  return {
    update(timeOfDay, view, alarm, gridVersion) {
      const x = Math.round(view.x / SUN_STEP) * SUN_STEP
      const y = Math.round(view.y / SUN_STEP) * SUN_STEP
      frames += 1
      if (x !== anchor.x || y !== anchor.y || gridVersion !== version || frames >= SUN_REDRAW_FRAMES) {
        sun.shadow.needsUpdate = true
        anchor = { x, y }
        version = gridVersion
        frames = 0
      }
      const sky = skyFor(timeOfDay)
      sun.color.setHex(sky.sunColor)
      sun.intensity = sky.sunIntensity
      sun.position.set(anchor.x + sky.sunOffset[0], -anchor.y + sky.sunOffset[1], sky.sunOffset[2])
      sun.target.position.set(anchor.x, -anchor.y, 0)
      sun.target.updateMatrixWorld()
      fill.color.setHex(sky.skyColor)
      fill.groundColor.setHex(sky.groundColor)
      fill.intensity = sky.skyIntensity
      if (alarm) {
        fill.color.lerp(ALARM_RED, 0.5)
        fill.groundColor.lerp(ALARM_RED, 0.5)
        fill.intensity = sky.skyIntensity * 1.5
      }
      return sky
    },
  }
}
