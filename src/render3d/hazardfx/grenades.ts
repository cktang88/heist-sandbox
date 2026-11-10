import { AdditiveBlending, CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Material } from 'three'
import type { FlashView, GrenadeView } from '../../game/hazards/hazards'
import { BALL, CYLINDER, glow, matte } from '../props/kit'

const MAX_GRENADES = 12
const MAX_FLASHES = 6
const LAMP_OFF = matte(0x2a0606, 0.4)
const LAMP_ON = glow(0xff2a1a, 9)

/** A smoke canister: olive drab tin with a lighter band and a dark cap. */
function smokeCanister(): Group {
  const can = new Group()
  addPart(can, matte(0x4c5232, 0.65, 0.2), 0.085, 0.3, 0)
  addPart(can, matte(0xb9b49a, 0.7), 0.087, 0.07, 0.02)
  addPart(can, matte(0x1d1f17, 0.5, 0.5), 0.06, 0.05, 0.17)
  return can
}

/** A flashbang: a perforated dark steel body with a fuse head on top. */
function flashbang(): Group {
  const can = new Group()
  addPart(can, matte(0x2c2f33, 0.45, 0.8), 0.07, 0.28, 0)
  for (const at of [-0.08, 0, 0.08]) addPart(can, matte(0x0d0e10, 0.6, 0.5), 0.072, 0.025, at)
  addPart(can, matte(0x8d8a7e, 0.4, 0.9), 0.045, 0.06, 0.16)
  return can
}

function addPart(group: Group, material: Material, radius: number, height: number, y: number): void {
  const mesh = new Mesh(CYLINDER, material)
  mesh.scale.set(radius, height, radius)
  mesh.position.y = y
  mesh.castShadow = true
  group.add(mesh)
}

function burstTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const c = canvas.getContext('2d')!
  const fade = c.createRadialGradient(64, 64, 0, 64, 64, 64)
  fade.addColorStop(0, 'rgba(255,255,255,1)')
  fade.addColorStop(0.15, 'rgba(255,255,255,0.85)')
  fade.addColorStop(0.45, 'rgba(255,255,255,0.18)')
  fade.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = fade
  c.fillRect(0, 0, 128, 128)
  return new CanvasTexture(canvas)
}

type Slot = { root: Group; smoke: Group; flash: Group; lamp: Mesh }

export type GrenadeFx = { group: Group; update(grenades: readonly GrenadeView[], flashes: readonly FlashView[], time: number): void }

/** Thrown grenades with a blinking fuse light, and the blinding pop of a flashbang. */
export function createGrenades(): GrenadeFx {
  const group = new Group()
  const slots: Slot[] = Array.from({ length: MAX_GRENADES }, () => {
    const root = new Group()
    const smoke = smokeCanister()
    const flash = flashbang()
    const lamp = new Mesh(BALL, LAMP_OFF)
    lamp.scale.setScalar(0.035)
    lamp.position.set(0, 0.2, 0.06)
    root.add(smoke, flash, lamp)
    // A little larger than life, so a grenade on the floor is easy to spot at game zoom.
    root.scale.setScalar(1.4)
    root.visible = false
    group.add(root)
    return { root, smoke, flash, lamp }
  })

  const plane = new PlaneGeometry(1, 1)
  const texture = burstTexture()
  const bursts = Array.from({ length: MAX_FLASHES }, () => {
    // A white-hot core that blooms, and a much wider, faint wash that lights up the room around it.
    const core = new Mesh(plane, new MeshBasicMaterial({ map: texture, color: new Color(40, 40, 38), blending: AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }))
    const wash = new Mesh(plane, new MeshBasicMaterial({ map: texture, color: new Color(1.4, 1.4, 1.35), blending: AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }))
    core.renderOrder = wash.renderOrder = 4
    core.visible = wash.visible = false
    group.add(core, wash)
    return { core, wash }
  })

  return {
    group,
    update(grenades, flashes, time) {
      slots.forEach((slot, index) => {
        const grenade = grenades[index]
        slot.root.visible = Boolean(grenade)
        if (!grenade) return
        slot.smoke.visible = grenade.kind === 'smoke'
        slot.flash.visible = grenade.kind === 'flash'
        // Sits on its side, tumbling a little; the fuse light blinks faster as it runs down.
        slot.root.position.set(grenade.x, -grenade.y, 0.15)
        slot.root.rotation.z = 1.25 + Math.sin(index * 2.1) * 0.3
        const rate = 2.5 + 9 / (Math.max(0, grenade.fuse) + 0.35)
        slot.lamp.material = Math.sin(time * rate * Math.PI * 2) > 0 ? LAMP_ON : LAMP_OFF
      })
      bursts.forEach(({ core, wash }, index) => {
        const flash = flashes[index]
        core.visible = wash.visible = Boolean(flash)
        if (!flash) return
        const life = Math.max(0, Math.min(1, flash.life))
        core.position.set(flash.x, -flash.y, 0.3)
        core.scale.setScalar(2.5 + (1 - life) * 6)
        ;(core.material as MeshBasicMaterial).opacity = Math.pow(life, 1.5)
        wash.position.set(flash.x, -flash.y, -2.2)
        wash.scale.setScalar(26)
        ;(wash.material as MeshBasicMaterial).opacity = life * life
      })
    },
  }
}
