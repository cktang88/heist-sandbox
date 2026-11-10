import { AdditiveBlending, BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Material } from 'three'
import type { DeviceKind } from '../../game/site'
import { glow } from '../props/kit'
import { COVER, disc, led, ledMaterial, METAL, part, rod, type LedColour } from './parts'
import { screenMaterial } from './screens'

/** What a device looks like right now. Models only redraw when this changes. */
export type DeviceState = { live: boolean; disabled: boolean; hacked: boolean; open: boolean }

/**
 * A built device. Wall devices are anchored on the back wall at the middle of their tile (+z points into the room);
 * floor devices stand on the floor at the middle of their tile. Cameras also expose the parts that sweep.
 */
export type DeviceModel = {
  root: Group
  anchor: 'wall' | 'floor'
  apply(state: DeviceState): void
  camera?: { pivot: Group; cone: Mesh; lensOffset: number }
}

const LENS_OFFSET = 0.46
const CONE_HALF_ANGLE = 0.38

function statusColour(state: DeviceState, armed: LedColour = 'red'): LedColour {
  if (state.disabled || !state.live) return 'off'
  return state.hacked ? 'green' : armed
}

/** A flat fan, apex at the origin, pointing along +x, one unit long. Brightest at the lens, fading out. */
function coneGeometry(): BufferGeometry {
  const steps = 10
  const positions: number[] = [0, 0, 0]
  const uvs: number[] = [0, 0.5]
  for (let step = 0; step <= steps; step += 1) {
    const angle = -CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * step) / steps
    positions.push(Math.cos(angle), Math.sin(angle), 0)
    uvs.push(1, step / steps)
  }
  const index: number[] = []
  for (let step = 0; step < steps; step += 1) index.push(0, step + 1, step + 2)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(index)
  return geometry
}

function fadeTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 4
  const c = canvas.getContext('2d')!
  const fade = c.createLinearGradient(0, 0, 64, 0)
  fade.addColorStop(0, 'rgba(255,255,255,1)')
  fade.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = fade
  c.fillRect(0, 0, 64, 4)
  return new CanvasTexture(canvas)
}

let coneParts: { geometry: BufferGeometry; red: Material; green: Material } | null = null
function cones(): { geometry: BufferGeometry; red: Material; green: Material } {
  if (coneParts) return coneParts
  const map = fadeTexture()
  const make = (color: number) => new MeshBasicMaterial({ map, color: new Color(color).multiplyScalar(0.16), blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide, fog: false })
  coneParts = { geometry: coneGeometry(), red: make(0xff3020), green: make(0x30ff70) }
  return coneParts
}

/** A security camera on a wall bracket. The pivot turns to sweep; the cone shows what it can see. */
function securityCamera(): DeviceModel {
  const root = new Group()
  part(root, METAL.grey, 0, 0, 0.02, 0.18, 0.26, 0.04)
  part(root, METAL.dark, 0, 0, 0.21, 0.06, 0.06, 0.36)
  const pivot = new Group()
  pivot.position.set(0, 0, 0.4)
  root.add(pivot)
  part(pivot, METAL.dark, 0, 0, 0, 0.1, 0.1, 0.1)
  part(pivot, METAL.plastic, 0.22, 0, 0, 0.46, 0.19, 0.2)
  part(pivot, METAL.plastic, 0.25, 0.12, 0, 0.56, 0.03, 0.25)
  const lens = disc(pivot, METAL.glass, LENS_OFFSET, 0, 0, 0.065, 0.06)
  lens.rotation.set(0, 0, Math.PI / 2)
  const light = led(pivot, 0.36, 0.05, 0.105, 0.026)
  const { geometry, red, green } = cones()
  const cone = new Mesh(geometry, red)
  cone.position.x = LENS_OFFSET
  cone.renderOrder = 1
  pivot.add(cone)
  return {
    root, anchor: 'wall', camera: { pivot, cone, lensOffset: LENS_OFFSET },
    apply(state) {
      const colour = statusColour(state)
      light.material = ledMaterial(colour)
      cone.visible = colour !== 'off'
      cone.material = colour === 'green' ? green : red
    },
  }
}

/** A workstation: a steel pedestal with a monitor, keyboard and tower. The screen changes when hacked or in use. */
function computer(): DeviceModel {
  const root = new Group()
  const z = -1.75
  part(root, METAL.dark, 0, 0.35, z, 0.55, 0.7, 0.5)
  part(root, METAL.grey, 0, 0.71, z + 0.02, 0.9, 0.04, 0.6)
  part(root, METAL.black, 0, 0.75, z + 0.18, 0.5, 0.025, 0.16)
  part(root, METAL.dark, 0.36, 0.92, z - 0.05, 0.16, 0.38, 0.38)
  part(root, METAL.black, 0, 0.8, z - 0.12, 0.08, 0.12, 0.06)
  part(root, METAL.black, 0, 1.08, z - 0.12, 0.66, 0.46, 0.06)
  const screen = new Mesh<PlaneGeometry, Material>(new PlaneGeometry(0.6, 0.4), screenMaterial('idle'))
  screen.position.set(0, 1.08, z - 0.085)
  root.add(screen)
  const dark = METAL.glass
  return {
    root, anchor: 'floor',
    apply(state) {
      screen.material = state.disabled || !state.live ? dark : screenMaterial(state.open ? 'open' : state.hacked ? 'hacked' : 'idle')
    },
  }
}

/** A grey breaker cabinet with a hinged door and a status light. Cut, it hangs open; with its circuit dead, the light is out. */
function fuseBox(): DeviceModel {
  const root = new Group()
  part(root, METAL.grey, 0, 0, 0.08, 0.56, 0.76, 0.16)
  rod(root, METAL.grey, -0.12, 0.38, 0.06, 0.035, 0.9)
  part(root, METAL.black, 0, 0, 0.155, 0.48, 0.66, 0.01)
  for (let row = 0; row < 3; row += 1) part(root, METAL.dark, 0, 0.2 - row * 0.2, 0.165, 0.4, 0.08, 0.02)
  const hinge = new Group()
  hinge.position.set(-0.28, 0, 0.17)
  root.add(hinge)
  part(hinge, METAL.steel, 0.28, 0, 0.01, 0.56, 0.76, 0.025)
  part(hinge, METAL.yellow, 0.28, 0.2, 0.026, 0.22, 0.12, 0.005)
  const light = led(hinge, 0.48, 0.3, 0.03)
  return {
    root, anchor: 'wall',
    apply(state) {
      hinge.rotation.y = state.disabled ? -1.9 : 0
      light.material = ledMaterial(state.live ? (state.hacked ? 'amber' : 'green') : 'off')
    },
  }
}

let keyMaterials: { lit: Material; dark: Material } | null = null
function keys(): { lit: Material; dark: Material } {
  if (keyMaterials) return keyMaterials
  const canvas = document.createElement('canvas')
  canvas.width = 48
  canvas.height = 64
  const c = canvas.getContext('2d')!
  c.fillStyle = '#05080a'
  c.fillRect(0, 0, 48, 64)
  c.fillStyle = '#ffffff'
  for (let row = 0; row < 4; row += 1) for (let column = 0; column < 3; column += 1) c.fillRect(4 + column * 15, 4 + row * 15, 11, 11)
  const map = new CanvasTexture(canvas)
  keyMaterials = { lit: new MeshBasicMaterial({ map, color: new Color(0.5, 1.6, 1.9) }), dark: new MeshBasicMaterial({ map, color: new Color(0.08, 0.1, 0.1) }) }
  return keyMaterials
}

/** A door keypad: a dark plate with glowing keys and a lock light. */
function keypad(): DeviceModel {
  const root = new Group()
  part(root, METAL.dark, 0, 0, 0.025, 0.26, 0.38, 0.05)
  const face = new Mesh<PlaneGeometry, Material>(new PlaneGeometry(0.18, 0.24), keys().lit)
  face.position.set(0, -0.04, 0.052)
  root.add(face)
  const light = led(root, 0, 0.14, 0.055, 0.022)
  return {
    root, anchor: 'wall',
    apply(state) {
      face.material = state.disabled || !state.live ? keys().dark : keys().lit
      light.material = ledMaterial(statusColour(state))
    },
  }
}

/** A red alarm button under a flip-up clear cover, on a yellow backplate. */
function alarmButton(): DeviceModel {
  const root = new Group()
  part(root, METAL.yellow, 0, 0, 0.03, 0.32, 0.32, 0.06)
  part(root, METAL.black, 0, -0.12, 0.062, 0.28, 0.04, 0.005)
  const button = disc(root, METAL.red, 0, 0.01, 0.09, 0.085, 0.06)
  part(root, COVER, 0, 0.01, 0.12, 0.26, 0.26, 0.11)
  const light = led(root, 0.12, 0.12, 0.065, 0.02)
  const pressed = glow(0xff2010, 4)
  return {
    root, anchor: 'wall',
    apply(state) {
      button.material = state.disabled ? METAL.dark : state.hacked ? METAL.red : pressed
      light.material = ledMaterial(state.disabled ? 'off' : state.hacked ? 'green' : 'amber')
    },
  }
}

/** A radio relay: a ruggedised box with two whip antennas and a link light. */
function radioRelay(): DeviceModel {
  const root = new Group()
  part(root, METAL.olive, 0, 0, 0.1, 0.48, 0.3, 0.2)
  part(root, METAL.black, -0.08, 0, 0.205, 0.22, 0.16, 0.01)
  rod(root, METAL.black, 0.16, 0.15, 0.1, 0.012, 0.6)
  rod(root, METAL.black, 0.2, 0.15, 0.08, 0.012, 0.42)
  const light = led(root, 0.15, -0.06, 0.21, 0.024)
  return { root, anchor: 'wall', apply: (state) => { light.material = ledMaterial(statusColour(state, 'amber')) } }
}

/** A light switch plate. The toggle drops when its circuit is dead. */
function lightSwitch(): DeviceModel {
  const root = new Group()
  part(root, METAL.plastic, 0, 0, 0.01, 0.15, 0.24, 0.02)
  const toggle = part(root, METAL.plastic, 0, 0.03, 0.035, 0.04, 0.07, 0.03)
  return { root, anchor: 'wall', apply: (state) => { toggle.position.y = state.live ? 0.03 : -0.03 } }
}

/** An elevator call panel: brushed steel with up and down buttons. */
function elevatorPanel(): DeviceModel {
  const root = new Group()
  part(root, METAL.steel, 0, 0, 0.012, 0.18, 0.4, 0.025)
  const up = disc(root, METAL.dark, 0, 0.06, 0.03, 0.04, 0.02)
  const down = disc(root, METAL.dark, 0, -0.06, 0.03, 0.04, 0.02)
  const lit = glow(0xffb040, 3)
  return {
    root, anchor: 'wall',
    apply(state) {
      up.material = down.material = state.disabled || !state.live ? METAL.dark : state.hacked ? ledMaterial('green') : lit
    },
  }
}

const BUILDERS: Record<DeviceKind, () => DeviceModel> = {
  camera: securityCamera, computer, fusebox: fuseBox, keypad, alarmButton, radioRelay, lightSwitch, elevatorPanel,
}

export function buildDevice(kind: DeviceKind): DeviceModel {
  return BUILDERS[kind]()
}
