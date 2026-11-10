import { CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type BufferGeometry, type Material } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ElevatorCar } from '../../../game/elevators'
import type { ElevatorShaft } from '../../../game/site'
import { BACK } from '../../levelMesh'
import { BOX, glow, matte } from '../../props/kit'
import { slab, storeyLabel } from './build'

const CAR_HEIGHT = 3.6
const DOOR_HEIGHT = 3
/** Door panels sit just in front of the doorway, facing the viewer, like the doors of a real lift seen from the lobby. */
const DOOR_Z = 0.28
const SHAFT_HEADROOM = 5
const DOOR_SPEED = 2.2
const BRUSHED = matte(0x9aa1a8, 0.32, 0.9)
const DARK = matte(0x2a2d31, 0.5, 0.7)
const CABLE = matte(0x15161a, 0.6, 0.6)
const CEILING_LIGHT = glow(0xfff1d8, 2.5)
const BUTTON_IDLE = glow(0x6a4a10, 0.6)
const BUTTON_CALLED = glow(0xffb030, 5)

type Stop = { y: number; left: Mesh; right: Mesh; display: Mesh; button: Mesh; open: number }

export type ElevatorRig = { group: Group; update(car: ElevatorCar | undefined, groundY: number, near: (y: number) => boolean, dt: number): void }

function box(group: Group, material: Material, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number): Mesh {
  const mesh = new Mesh(BOX, material)
  mesh.scale.set(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  group.add(mesh)
  return mesh
}

/** The car: floor, roof, back and far walls, a handrail, a ceiling light and the crosshead the cables hang from. Origin at the middle of its floor. */
function buildCar(shaft: ElevatorShaft): Group {
  const car = new Group()
  const half = shaft.w / 2 - 0.06
  box(car, DARK, -half, -0.25, half, 0, BACK + 0.15, 0.35)
  box(car, DARK, -half, CAR_HEIGHT, half, CAR_HEIGHT + 0.2, BACK + 0.15, 0.35)
  box(car, BRUSHED, -half, 0, half, CAR_HEIGHT, BACK + 0.15, BACK + 0.22)
  const far = shaft.doorSide === 1 ? -half : half
  box(car, BRUSHED, far - 0.04, 0, far + 0.04, CAR_HEIGHT, BACK + 0.15, 0.35)
  box(car, matte(0x6b5a3a, 0.5, 0.6), -half + 0.2, 1.0, half - 0.2, 1.06, BACK + 0.24, BACK + 0.32)
  box(car, CEILING_LIGHT, -half + 0.4, CAR_HEIGHT - 0.04, half - 0.4, CAR_HEIGHT, BACK + 0.6, -0.2)
  box(car, DARK, -half, CAR_HEIGHT + 0.2, half, CAR_HEIGHT + 0.42, -1.2, -0.8)
  return car
}

/** The floor indicator: one small texture per shaft, redrawn only when the car reaches a new floor. */
function createIndicator(): { material: MeshBasicMaterial; show(label: string, arrow: number): void } {
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 40
  const c = canvas.getContext('2d')!
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  const material = new MeshBasicMaterial({ map, color: new Color(2, 2, 2) })
  let shown = ''
  return {
    material,
    show(label, arrow) {
      const key = `${label}:${arrow}`
      if (key === shown) return
      shown = key
      c.fillStyle = '#050505'
      c.fillRect(0, 0, 96, 40)
      c.fillStyle = '#ff8a1e'
      c.font = 'bold 28px monospace'
      c.textAlign = 'center'
      c.fillText(label, 56, 31)
      if (arrow !== 0) c.fillText(arrow > 0 ? '▲' : '▼', 18, 31)
      map.needsUpdate = true
    },
  }
}

/**
 * One elevator shaft: guide rails, the moving car with its cables and counterweight, and at every stop
 * a pair of sliding doors, a floor indicator and a call button. Static parts are merged; stops far from the view are hidden.
 */
export function buildElevator(shaft: ElevatorShaft): ElevatorRig {
  const group = new Group()
  const topY = -(shaft.stops[shaft.stops.length - 1] - SHAFT_HEADROOM)
  const pitY = -shaft.stops[0]
  const wallX = shaft.doorSide === 1 ? shaft.x + shaft.w : shaft.x - 1
  const lobbyX = wallX + 0.5 + shaft.doorSide * 1.25

  const fixed: BufferGeometry[] = []
  for (const x of [shaft.x + 0.3, shaft.x + shaft.w - 0.3]) slab(fixed, x - 0.05, pitY, x + 0.05, topY, BACK + 0.05, BACK + 0.15)
  for (const stopY of shaft.stops) {
    const floor = -stopY
    slab(fixed, wallX - 0.1, floor, wallX + 0.02, floor + DOOR_HEIGHT + 0.15, DOOR_Z - 0.04, DOOR_Z + 0.06)
    slab(fixed, wallX + 0.98, floor, wallX + 1.1, floor + DOOR_HEIGHT + 0.15, DOOR_Z - 0.04, DOOR_Z + 0.06)
    slab(fixed, wallX - 0.1, floor + DOOR_HEIGHT, wallX + 1.1, floor + DOOR_HEIGHT + 0.15, DOOR_Z - 0.04, DOOR_Z + 0.06)
    slab(fixed, wallX + 0.15, floor + DOOR_HEIGHT + 0.25, wallX + 0.85, floor + DOOR_HEIGHT + 0.62, DOOR_Z - 0.04, DOOR_Z + 0.04)
    slab(fixed, lobbyX - 0.1, floor + 1.2, lobbyX + 0.1, floor + 1.6, BACK, BACK + 0.03)
  }
  const frames = new Mesh(mergeGeometries(fixed), BRUSHED)
  for (const part of fixed) part.dispose()
  group.add(frames)

  const car = buildCar(shaft)
  const counterweight = new Group()
  box(counterweight, DARK, -0.3, -1, 0.3, 1, BACK + 0.2, BACK + 0.55)
  const cables = box(group, CABLE, -0.03, 0, 0.03, 1, -1.05, -0.95)
  const weightCable = box(group, CABLE, -0.02, 0, 0.02, 1, BACK + 0.36, BACK + 0.4)
  group.add(car, counterweight)
  const weightX = shaft.doorSide === 1 ? shaft.x + shaft.w - 0.75 : shaft.x + 0.75

  const indicator = createIndicator()
  const display = new PlaneGeometry(0.6, 0.27)
  const stops: Stop[] = shaft.stops.map((stopY) => {
    const floor = -stopY
    const left = box(group, BRUSHED, 0, floor, 1, floor + DOOR_HEIGHT, DOOR_Z, DOOR_Z + 0.04)
    const right = box(group, BRUSHED, 0, floor, 1, floor + DOOR_HEIGHT, DOOR_Z + 0.005, DOOR_Z + 0.045)
    const screen = new Mesh(display, indicator.material)
    screen.position.set(wallX + 0.5, floor + DOOR_HEIGHT + 0.435, DOOR_Z + 0.045)
    const button = box(group, BUTTON_IDLE, lobbyX - 0.05, floor + 1.35, lobbyX + 0.05, floor + 1.45, BACK + 0.03, BACK + 0.06)
    group.add(screen)
    return { y: stopY, left, right, display: screen, button, open: 0 }
  })
  let lastCarY = shaft.stops[0]

  return {
    group,
    update(state, groundY, near, dt) {
      const carY = state?.y ?? shaft.stops[0]
      const floor = -carY
      car.position.set(shaft.x + shaft.w / 2, floor, 0)
      const roof = floor + CAR_HEIGHT + 0.42
      cables.position.set(shaft.x + shaft.w / 2, (roof + topY) / 2, -1)
      cables.scale.y = Math.max(0.01, topY - roof)
      // The counterweight runs the opposite way to the car.
      const weightY = Math.max(pitY + 1.2, Math.min(topY - 1.2, topY + pitY - floor - CAR_HEIGHT / 2))
      counterweight.position.set(weightX, weightY, 0)
      weightCable.position.set(weightX, (weightY + 1 + topY) / 2, BACK + 0.38)
      weightCable.scale.y = Math.max(0.01, topY - weightY - 1)

      const moving = Math.abs(carY - lastCarY) > 0.001 ? Math.sign(lastCarY - carY) : 0
      lastCarY = carY
      indicator.show(storeyLabel(Math.round((groundY - carY) / 6)), moving)
      for (let index = 0; index < stops.length; index += 1) {
        const stop = stops[index]
        const visible = near(stop.y)
        stop.left.visible = stop.right.visible = stop.display.visible = stop.button.visible = visible
        const parked = state !== undefined && Math.abs(state.y - stop.y) < 0.05
        const target = parked && state.doorsOpen ? 1 : 0
        stop.open += Math.max(-DOOR_SPEED * dt, Math.min(DOOR_SPEED * dt, target - stop.open))
        if (!visible) continue
        // Each panel slides toward its jamb, narrowing as it tucks behind the frame.
        const width = 0.5 * (1 - stop.open) + 0.03
        stop.left.scale.x = stop.right.scale.x = width
        stop.left.position.x = wallX + width / 2
        stop.right.position.x = wallX + 1 - width / 2
        // `targetStop` may be an index into the stops or a floor row; either way, light the button it names.
        const called = state?.targetStop === index || state?.targetStop === stop.y
        stop.button.material = called ? BUTTON_CALLED : BUTTON_IDLE
      }
    },
  }
}
