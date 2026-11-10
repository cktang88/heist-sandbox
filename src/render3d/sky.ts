import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Texture } from 'three'
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

/** The world rectangle a plane at depth `z` must cover so it fills the view from every camera position. */
function sheetAt(z: number, levelWidth: number, ground: number, height: number): Sheet {
  const distance = CAMERA_DISTANCE - z
  const halfTall = (12 * distance) / CAMERA_DISTANCE
  const halfWide = halfTall * WIDEST
  return { left: EDGE - halfWide, right: levelWidth - EDGE + halfWide, bottom: ground - BELOW_GROUND, top: ground + height }
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
    mesh.renderOrder = -10 + index
    group.add(mesh)
  })
  addNeighbours(group, -60, levelWidth + 60, ground, time)
  return group
}
