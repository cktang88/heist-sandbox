import {
  AdditiveBlending, BoxGeometry, CanvasTexture, Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  Quaternion, SphereGeometry, Sprite, SpriteMaterial, Vector3,
} from 'three'
import type { Flash, Particle } from '../game/effects'
import type { World } from '../game/world'
import { createRubble3d } from './rubble3d'

const MAX_TRACERS = 96
const MAX_PARTICLES = 700
const MAX_BLASTS = 6
const MAX_MUZZLES = 8
const MAX_SMOKE = 60
/** Colours brighter than white. The glow pass picks these up, so they read as light sources. */
const TRACER_PLAYER = new Color(5, 3.6, 1.6)
const TRACER_ENEMY = new Color(5, 0.9, 0.7)
const ROCKET_FLAME = new Color(6, 2.6, 0.6)
const SPARK_COLORS = new Set(['#ffb347', '#ffd27a', '#e0b95a', '#d8d2c4'])

function softDisc(inner: string, outer: string): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const c = canvas.getContext('2d')!
  const fade = c.createRadialGradient(64, 64, 0, 64, 64, 64)
  fade.addColorStop(0, inner)
  fade.addColorStop(1, outer)
  c.fillStyle = fade
  c.fillRect(0, 0, 128, 128)
  return new CanvasTexture(canvas)
}

function starBurst(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const c = canvas.getContext('2d')!
  c.translate(64, 64)
  c.fillStyle = '#ffffff'
  c.beginPath()
  c.moveTo(-50, -8)
  c.lineTo(62, 0)
  c.lineTo(-50, 8)
  c.lineTo(-30, 44)
  c.lineTo(-40, 0)
  c.lineTo(-30, -44)
  c.closePath()
  c.fill()
  return new CanvasTexture(canvas)
}

type Smoke = { sprite: Sprite; life: number; duration: number; vx: number; vy: number; grow: number }

/** Shots, sparks, rubble, fireballs, smoke and dust. */
export type Effects3d = {
  group: Group
  update(world: World, gameDt: number): void
  /** Pale dust kicked up at a spot in game space, such as where a falling piece of wall lands. */
  dust(x: number, y: number, amount: number): void
}

export function createEffects3d(): Effects3d {
  const group = new Group()
  const box = new BoxGeometry(1, 1, 1)

  const tracers = new InstancedMesh(box, new MeshBasicMaterial({ toneMapped: false }), MAX_TRACERS)
  const particles = new InstancedMesh(box, new MeshBasicMaterial({ toneMapped: false }), MAX_PARTICLES)
  for (const mesh of [tracers, particles]) {
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.frustumCulled = false
    mesh.setColorAt(0, new Color(1, 1, 1))
    group.add(mesh)
  }

  const fireball = new SphereGeometry(1, 20, 14)
  const blasts = Array.from({ length: MAX_BLASTS }, () => {
    const mesh = new Mesh(fireball, new MeshBasicMaterial({ color: new Color(8, 3.5, 0.9), transparent: true, toneMapped: false }))
    mesh.visible = false
    group.add(mesh)
    return mesh
  })

  const star = starBurst()
  const muzzles = Array.from({ length: MAX_MUZZLES }, () => {
    const sprite = new Sprite(new SpriteMaterial({ map: star, color: new Color(6, 4, 1.6), blending: AdditiveBlending, depthWrite: false, toneMapped: false }))
    sprite.visible = false
    group.add(sprite)
    return sprite
  })

  const puff = softDisc('rgba(120,120,125,0.8)', 'rgba(60,60,65,0)')
  const smoke: Smoke[] = []
  const smokePool = Array.from({ length: MAX_SMOKE }, () => {
    const sprite = new Sprite(new SpriteMaterial({ map: puff, color: 0x55524f, transparent: true, depthWrite: false }))
    sprite.visible = false
    group.add(sprite)
    return sprite
  })
  const seen = new WeakSet<Flash>()
  const rubble = createRubble3d()
  group.add(rubble.group)
  // Bits of wall thrown by a blast become lasting rubble, drawn by `rubble` instead of as short-lived specks.
  const looked = new WeakSet<Particle>()
  const adopted = new WeakSet<Particle>()

  const matrix = new Matrix4()
  const spin = new Quaternion()
  const axis = new Vector3(0, 0, 1)
  const place = new Vector3()
  const size = new Vector3()
  const tint = new Color()

  return {
    group,
    dust: rubble.dust,
    update(world, gameDt) {
      let count = 0
      for (const shot of world.projectiles) {
        if (count >= MAX_TRACERS) break
        const speed = Math.hypot(shot.vx, shot.vy)
        const rocket = shot.kind === 'rocket'
        const length = rocket ? 1.2 : Math.min(2.4, speed * 0.028)
        spin.setFromAxisAngle(axis, Math.atan2(-shot.vy, shot.vx))
        place.set(shot.x - (shot.vx / speed) * length * 0.5, -(shot.y - (shot.vy / speed) * length * 0.5), 0.15)
        size.set(length, rocket ? 0.16 : 0.045, rocket ? 0.16 : 0.045)
        tracers.setMatrixAt(count, matrix.compose(place, spin, size))
        tracers.setColorAt(count, rocket ? ROCKET_FLAME : shot.fromPlayer ? TRACER_PLAYER : TRACER_ENEMY)
        count += 1
      }
      tracers.count = count
      tracers.instanceMatrix.needsUpdate = true
      if (tracers.instanceColor) tracers.instanceColor.needsUpdate = true

      count = 0
      for (const particle of world.effects.particles) {
        if (count >= MAX_PARTICLES) break
        if (!looked.has(particle)) {
          looked.add(particle)
          if (rubble.adopt(particle)) adopted.add(particle)
        }
        if (adopted.has(particle)) continue
        spin.setFromAxisAngle(axis, particle.x * 3 + particle.y * 2)
        place.set(particle.x, -particle.y, 0.2 + ((count * 37) % 10) * 0.03)
        size.setScalar(particle.size * Math.min(1, particle.life * 2))
        particles.setMatrixAt(count, matrix.compose(place, spin, size))
        // Sparks glow; rubble and blood are dim, because nothing is lighting them directly.
        tint.set(particle.color).multiplyScalar(SPARK_COLORS.has(particle.color) ? 4 : 0.22)
        particles.setColorAt(count, tint)
        count += 1
      }
      particles.count = count
      particles.instanceMatrix.needsUpdate = true
      if (particles.instanceColor) particles.instanceColor.needsUpdate = true

      let blast = 0
      let muzzle = 0
      for (const mesh of blasts) mesh.visible = false
      for (const sprite of muzzles) sprite.visible = false
      for (const flash of world.effects.flashes) {
        const age = 1 - flash.life / flash.duration
        if (flash.kind === 'explosion') {
          if (blast < MAX_BLASTS) {
            const mesh = blasts[blast++]
            mesh.visible = true
            mesh.position.set(flash.x, -flash.y, 0.2)
            mesh.scale.setScalar(flash.radius * (0.35 + age * 0.75))
            ;(mesh.material as MeshBasicMaterial).opacity = 1 - age
          }
          if (!seen.has(flash)) {
            seen.add(flash)
            rubble.dust(flash.x, flash.y, Math.min(5, flash.radius))
            for (let index = 0; index < 9; index += 1) {
              const sprite = smokePool.find((candidate) => !candidate.visible)
              if (!sprite) break
              const angle = (index / 9) * Math.PI * 2
              sprite.visible = true
              sprite.position.set(flash.x + Math.cos(angle) * flash.radius * 0.3, -flash.y + Math.sin(angle) * flash.radius * 0.3, 0.3 + (index % 3) * 0.2)
              smoke.push({ sprite, life: 2.6, duration: 2.6, vx: Math.cos(angle) * 1.6, vy: 1 + Math.sin(angle) * 1.2 + (index % 3) * 0.5, grow: flash.radius * (0.7 + (index % 4) * 0.2) })
            }
          }
        } else if (flash.kind === 'muzzle' && muzzle < MAX_MUZZLES) {
          const sprite = muzzles[muzzle++]
          sprite.visible = true
          sprite.position.set(flash.x + Math.cos(flash.angle) * 0.45, -flash.y - Math.sin(flash.angle) * 0.45, 0.25)
          sprite.material.rotation = -flash.angle
          sprite.scale.setScalar(1.3 + age * 0.9)
          sprite.material.opacity = 1 - age * 0.8
        }
      }

      rubble.update(world.grid, gameDt)
      for (let index = smoke.length - 1; index >= 0; index -= 1) {
        const cloud = smoke[index]
        cloud.life -= gameDt
        const age = 1 - cloud.life / cloud.duration
        cloud.sprite.position.x += cloud.vx * gameDt * (1 - age)
        cloud.sprite.position.y += cloud.vy * gameDt
        cloud.sprite.scale.setScalar(cloud.grow * (0.8 + age * 2.2))
        cloud.sprite.material.opacity = Math.max(0, 0.6 * (1 - age))
        if (cloud.life > 0) continue
        cloud.sprite.visible = false
        smoke.splice(index, 1)
      }
    },
  }
}
