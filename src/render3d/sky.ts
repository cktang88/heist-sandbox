import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Texture } from 'three'
import type { TimeOfDay } from '../game/site'
import { addNeighbours } from './rooms/neighbours'
import { DAY_BANDS, NIGHT_BANDS, paintCity, paintSky, type Sheet } from './rooms/skyline'

/** Must match the camera in `renderer3d.ts`: 30 degree view, 24 tiles tall at the walking lane. */
const CAMERA_DISTANCE = 12 / Math.tan((30 * Math.PI) / 360)
/** Widest screen shape the backdrop is sized for (21:9 is 2.33). */
const WIDEST = 2.4
/** The camera keeps at least this far inside the level's edges and top (half the view). */
const EDGE = 21
const TOP = 12
/** The camera draws nothing beyond 400 units, so the sky stays inside that. */
const SKY_Z = -330
const BANDS_Z = [-260, -170, -95] as const
/** How far each band of city rises above the street, in tiles. The furthest holds the megastructures. */
const BANDS_HEIGHT = [360, 180, 120] as const
const BELOW_GROUND = 110
/** Sheets of mist between the layers: depth, how high above the street they reach, and how thick they are at street level. */
const HAZE = [[-215, 110, 0.4], [-130, 70, 0.4], [-75, 40, 0.35], [-46, 22, 0.3]] as const
const HAZE_COLOUR: Record<TimeOfDay, string> = { night: '#261e38', day: '#9aa4ae' }

/** The world rectangle a plane at depth `z` must cover so it fills the view from every camera position. */
function sheetAt(z: number, levelWidth: number, ground: number, height: number): Sheet {
  const distance = CAMERA_DISTANCE - z
  const halfTall = (12 * distance) / CAMERA_DISTANCE
  const halfWide = halfTall * WIDEST
  return { left: EDGE - halfWide, right: levelWidth - EDGE + halfWide, bottom: ground - BELOW_GROUND, top: ground + height }
}

/** A veil that is thickest at street level and thins out upward, so each layer sinks into the air in front of it. */
function hazeTexture(height: number, strength: number, colour: string): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const c = canvas.getContext('2d')!
  const street = height / (height + BELOW_GROUND)
  const fade = c.createLinearGradient(0, 0, 0, 256)
  fade.addColorStop(0, 'rgba(255,255,255,0)')
  fade.addColorStop(street * 0.6, `rgba(255,255,255,${strength * 0.35})`)
  fade.addColorStop(street, `rgba(255,255,255,${strength})`)
  fade.addColorStop(1, `rgba(255,255,255,${Math.min(1, strength * 2)})`)
  c.fillStyle = colour
  c.fillRect(0, 0, 4, 256)
  c.globalCompositeOperation = 'destination-in'
  c.fillStyle = fade
  c.fillRect(0, 0, 4, 256)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function plane(sheet: Sheet, z: number, map: Texture, transparent: boolean): Mesh {
  const width = sheet.right - sheet.left
  const height = sheet.top - sheet.bottom
  const mesh = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map, fog: false, transparent, depthWrite: !transparent }))
  mesh.position.set((sheet.left + sheet.right) / 2, (sheet.top + sheet.bottom) / 2, z)
  mesh.matrixAutoUpdate = false
  mesh.updateMatrix()
  return mesh
}

/**
 * Everything seen beyond the level, built once: a sky (moon and night cloud, or a veiled sun through overcast),
 * three bands of distant city fading into mist, and the real blocks across the back street. Each sits at its
 * own depth, so the perspective camera moves them at different speeds. Sized so the view is always filled,
 * from the parachute drop above the tower to either end of the level.
 */
export function createSky(levelWidth: number, groundY: number, time: TimeOfDay = 'night'): Group {
  const group = new Group()
  const ground = -groundY
  // The highest the camera goes is TOP rows below the top of the level (y = -TOP); add the view's half height there.
  const skyTop = -TOP + (12 * (CAMERA_DISTANCE - SKY_Z)) / CAMERA_DISTANCE + 10
  const skySheet = sheetAt(SKY_Z, levelWidth, ground, skyTop - ground)
  group.add(plane(skySheet, SKY_Z, paintSky(skySheet, ground, time), false))
  const bands = time === 'night' ? NIGHT_BANDS : DAY_BANDS
  BANDS_Z.forEach((z, index) => {
    const sheet = sheetAt(z, levelWidth, ground, BANDS_HEIGHT[index])
    const mesh = plane(sheet, z, paintCity(sheet, ground, bands[index], time), true)
    // See-through layers must be drawn far to near.
    mesh.renderOrder = z
    group.add(mesh)
  })
  for (const [z, height, strength] of HAZE) {
    const mesh = plane(sheetAt(z, levelWidth, ground, height), z, hazeTexture(height, strength, HAZE_COLOUR[time]), true)
    mesh.renderOrder = z
    group.add(mesh)
  }
  addNeighbours(group, -60, levelWidth + 60, ground, time)
  return group
}
