import { CanvasTexture, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, type BufferGeometry, type Material } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Stairwell } from '../../../game/site'
import { landingX } from '../../../game/stairs'
import { BACK } from '../../levelMesh'
import { matte } from '../../props/kit'
import { bar, slab, storeyLabel } from './build'

/** People on stairs are drawn at z = -1.5, so the flights are centred there. */
const LANE = -1.5
const HALF_WIDTH = 0.48
const STEPS_PER_FLIGHT = 16
const RAIL_HEIGHT = 0.95
const STEEL = matte(0x3a3f45, 0.45, 0.8)
const RAIL = matte(0x8a6a2a, 0.5, 0.6)

/** Signs for every storey from B5 to 40, painted once into one texture and shared by all stairwells. */
const SIGN_MIN = -5
const SIGN_COLUMNS = 8
const SIGN_ROWS = 6
let signMaterial: MeshStandardMaterial | null = null
function signs(): MeshStandardMaterial {
  if (signMaterial) return signMaterial
  const cell = 128
  const canvas = document.createElement('canvas')
  canvas.width = SIGN_COLUMNS * cell
  canvas.height = SIGN_ROWS * (cell * 0.66)
  const c = canvas.getContext('2d')!
  const tall = cell * 0.66
  for (let index = 0; index < SIGN_COLUMNS * SIGN_ROWS; index += 1) {
    const x = (index % SIGN_COLUMNS) * cell
    const y = Math.floor(index / SIGN_COLUMNS) * tall
    c.fillStyle = '#d8cfa8'
    c.fillRect(x + 2, y + 2, cell - 4, tall - 4)
    c.fillStyle = '#1b1c1e'
    c.fillRect(x + 7, y + 7, cell - 14, tall - 14)
    c.fillStyle = '#e8dfb8'
    c.textAlign = 'center'
    c.font = 'bold 13px monospace'
    c.fillText('FLOOR', x + cell / 2, y + 24)
    c.font = 'bold 40px monospace'
    c.fillText(storeyLabel(index + SIGN_MIN), x + cell / 2, y + tall - 14)
  }
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  signMaterial = new MeshStandardMaterial({ map, roughness: 0.7, metalness: 0.1 })
  return signMaterial
}

function signQuad(storey: number, x: number, y: number): BufferGeometry {
  const plane = new PlaneGeometry(0.95, 0.62)
  const index = Math.max(0, Math.min(SIGN_COLUMNS * SIGN_ROWS - 1, storey - SIGN_MIN))
  const u0 = (index % SIGN_COLUMNS) / SIGN_COLUMNS
  const v1 = 1 - Math.floor(index / SIGN_COLUMNS) / SIGN_ROWS
  const uv = plane.getAttribute('uv')
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, u0 + uv.getX(i) / SIGN_COLUMNS, v1 - (1 - uv.getY(i)) / SIGN_ROWS)
  plane.translate(x, y, BACK + 0.03)
  return plane
}

/** One flight: the steps, a steel stringer on each side, and a handrail on the open (front) side. */
function addFlight(treads: BufferGeometry[], steel: BufferGeometry[], rails: BufferGeometry[], fromX: number, fromY: number, toX: number, toY: number): void {
  const run = (toX - fromX) / STEPS_PER_FLIGHT
  const rise = (toY - fromY) / STEPS_PER_FLIGHT
  for (let step = 0; step < STEPS_PER_FLIGHT; step += 1) {
    const x = fromX + run * step
    const top = fromY + rise * (step + 1)
    // A tread with a short nosing, sitting on the riser below it.
    slab(treads, x - Math.sign(run) * 0.03, top - rise - 0.06, x + run, top, LANE - HALF_WIDTH + 0.04, LANE + HALF_WIDTH - 0.04)
  }
  for (const side of [-1, 1]) bar(steel, fromX, fromY - 0.22, toX, toY - 0.22, LANE + side * HALF_WIDTH, 0.42, 0.06)
  const front = LANE + HALF_WIDTH + 0.02
  bar(rails, fromX, fromY + RAIL_HEIGHT, toX, toY + RAIL_HEIGHT, front, 0.06, 0.06)
  for (let post = 0; post <= STEPS_PER_FLIGHT; post += 4) {
    const x = fromX + run * post
    const y = fromY + rise * post
    slab(steel, x - 0.02, y, x + 0.02, y + RAIL_HEIGHT, front - 0.02, front + 0.02)
  }
}

/**
 * A whole staircase as three merged meshes (steps, steel, rails) plus floor signs: cheap even for the tower's 27 stops.
 * Flights zigzag between the left and right landings, exactly where `stairPoint` puts people's feet.
 */
export function buildStairwell(well: Stairwell, groundY: number, concrete: Material): Group {
  const treads: BufferGeometry[] = []
  const steel: BufferGeometry[] = []
  const rails: BufferGeometry[] = []
  const plates: BufferGeometry[] = []
  for (let stop = 0; stop < well.stops.length; stop += 1) {
    const x = landingX(well, stop)
    const y = -well.stops[stop]
    if (stop + 1 < well.stops.length) addFlight(treads, steel, rails, x, y, landingX(well, stop + 1), -well.stops[stop + 1])
    // A short guard rail at the landing's open edge, and the floor number on the wall above it.
    const inward = stop % 2 === 0 ? -1 : 1
    slab(rails, x + inward * 1.1 - 0.03, y, x + inward * 1.1 + 0.03, y + RAIL_HEIGHT, LANE - HALF_WIDTH, LANE + HALF_WIDTH)
    const sign = signQuad(Math.round((groundY - well.stops[stop]) / 6), x + inward * 0.4, y + 3.3)
    sign.setAttribute('color', new Float32BufferAttribute(new Float32Array(sign.attributes.position.count * 3).fill(1), 3))
    plates.push(sign)
  }
  const group = new Group()
  const add = (parts: BufferGeometry[], material: Material, shadows: boolean) => {
    if (parts.length === 0) return
    const mesh = new Mesh(mergeGeometries(parts), material)
    for (const part of parts) part.dispose()
    mesh.castShadow = shadows
    mesh.receiveShadow = true
    group.add(mesh)
  }
  add(treads, concrete, true)
  add(steel, STEEL, true)
  add(rails, RAIL, false)
  add(plates, signs(), false)
  return group
}
