import {
  CanvasTexture, Color, DynamicDrawUsage, Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Sprite,
  SpriteMaterial, Vector3,
} from 'three'
import type { Particle } from '../game/effects'
import { GRAVITY } from '../game/physics'
import { isSolidAt, TILE_DEFS, TILE_KINDS, type Grid } from '../game/tiles'

/**
 * Chunks of broken wall that fly out of a blast, bounce and stay lying where they land, and the pale dust that
 * hangs in the air afterwards. Both are pooled: one instanced mesh for all rubble and a fixed set of dust sprites.
 * Only pieces still in the air are moved each frame; resting ones are re-checked only when the level changes.
 */

const MAX_RUBBLE = 360
const MAX_DUST = 48

/** Particle colours that mean "a bit of wall", so they become lasting rubble instead of a short-lived speck. */
const RUBBLE_COLORS = new Set([
  ...TILE_KINDS.filter((kind) => TILE_DEFS[kind].opaque && TILE_DEFS[kind].solid).map((kind) => TILE_DEFS[kind].color),
  '#55504a', '#8a8f98',
])

export function isRubbleColor(color: string): boolean {
  return RUBBLE_COLORS.has(color)
}

/** One chunk of rubble, in game space (y down). */
export type Piece = { x: number; y: number; vx: number; vy: number; size: number; resting: boolean }

const BOUNCE = 0.28
/** Slower than this when it lands, a piece stops instead of bouncing again. */
const SETTLE_SPEED = 3

/**
 * Moves a piece one step: falls, bounces off walls and floors, and comes to rest on a solid tile.
 * Returns true when the piece moved, so callers know to redraw it.
 */
export function stepPiece(piece: Piece, grid: Grid, dt: number): boolean {
  if (piece.resting) {
    if (isSolidAt(grid, piece.x, piece.y + piece.size * 0.5 + 0.02)) return false
    piece.resting = false
  }
  piece.vy += GRAVITY * 0.8 * dt
  const nextX = piece.x + piece.vx * dt
  if (isSolidAt(grid, nextX, piece.y)) piece.vx *= -BOUNCE
  else piece.x = nextX
  const nextY = piece.y + piece.vy * dt
  const foot = nextY + piece.size * 0.5
  if (piece.vy > 0 && isSolidAt(grid, piece.x, foot)) {
    // Rest with the bottom a touch below the surface, as a chunk settles into the dust on a floor.
    piece.y = Math.floor(foot) - piece.size * 0.38
    if (piece.vy < SETTLE_SPEED) {
      piece.vx = 0
      piece.vy = 0
      piece.resting = true
    } else {
      piece.vy *= -BOUNCE
      piece.vx *= 0.5
    }
  } else if (piece.vy < 0 && isSolidAt(grid, piece.x, nextY - piece.size * 0.5)) piece.vy = 0
  else piece.y = nextY
  return true
}

type Slot = Piece & { z: number; spin: number; angle: number; axis: Vector3; color: Color }
type Dust = { sprite: Sprite; life: number; duration: number; vx: number; vy: number; grow: number; peak: number }

function dustTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const c = canvas.getContext('2d')!
  const fade = c.createRadialGradient(32, 32, 0, 32, 32, 32)
  fade.addColorStop(0, 'rgba(255,255,255,0.7)')
  fade.addColorStop(0.6, 'rgba(255,255,255,0.25)')
  fade.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = fade
  c.fillRect(0, 0, 64, 64)
  return new CanvasTexture(canvas)
}

export type Rubble3d = {
  group: Group
  /** Turns a newly seen particle into a chunk of rubble when it is a bit of wall. Returns whether it did. */
  adopt(particle: Particle): boolean
  /** A cloud of pale dust at a spot in game space; `amount` about 1 for a tile landing, 4 for a blast. */
  dust(x: number, y: number, amount: number): void
  update(grid: Grid, dt: number): void
}

export function createRubble3d(): Rubble3d {
  const group = new Group()
  const chunks = new InstancedMesh(new IcosahedronGeometry(0.5, 0), new MeshStandardMaterial({ roughness: 0.95, metalness: 0, flatShading: true }), MAX_RUBBLE)
  chunks.instanceMatrix.setUsage(DynamicDrawUsage)
  chunks.frustumCulled = false
  chunks.castShadow = true
  chunks.receiveShadow = true
  chunks.count = 0
  group.add(chunks)
  const slots: Slot[] = []
  let next = 0
  let seed = 1
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }

  const matrix = new Matrix4()
  const turn = new Quaternion()
  const place = new Vector3()
  const scale = new Vector3()
  const draw = (index: number) => {
    const slot = slots[index]
    turn.setFromAxisAngle(slot.axis, slot.angle)
    place.set(slot.x, -slot.y, slot.z)
    scale.set(slot.size, slot.size * 0.7, slot.size * 0.9)
    chunks.setMatrixAt(index, matrix.compose(place, turn, scale))
  }

  const texture = typeof document === 'undefined' ? null : dustTexture()
  const clouds: Dust[] = []
  const pool = Array.from({ length: MAX_DUST }, () => {
    const sprite = new Sprite(new SpriteMaterial({ map: texture, color: 0xa39a8c, transparent: true, depthWrite: false, opacity: 0 }))
    sprite.visible = false
    group.add(sprite)
    return sprite
  })
  let lastGridVersion = -1

  return {
    group,
    adopt(particle) {
      if (!isRubbleColor(particle.color) || random() < 0.3) return false
      const index = slots.length < MAX_RUBBLE ? slots.length : next
      next = (index + 1) % MAX_RUBBLE
      const color = new Color(particle.color).multiplyScalar(0.55 + random() * 0.4)
      slots[index] = {
        x: particle.x, y: particle.y, vx: particle.vx, vy: particle.vy, size: 0.1 + random() * 0.2, resting: false,
        z: -2.1 + random() * 2.3, spin: (random() - 0.5) * 18, angle: random() * 6, axis: new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(), color,
      }
      chunks.setColorAt(index, color)
      if (chunks.instanceColor) chunks.instanceColor.needsUpdate = true
      chunks.count = slots.length
      draw(index)
      chunks.instanceMatrix.needsUpdate = true
      return true
    },
    dust(x, y, amount) {
      const puffs = Math.max(1, Math.round(amount * 3))
      for (let index = 0; index < puffs; index += 1) {
        const sprite = pool.find((candidate) => !candidate.visible)
        if (!sprite) return
        sprite.visible = true
        const spread = 0.3 + amount * 0.35
        sprite.position.set(x + (random() - 0.5) * spread * 2, -y + random() * spread * 0.6, -1.6 + random() * 1.8)
        const duration = 3 + random() * 3 + amount * 0.5
        clouds.push({ sprite, life: duration, duration, vx: (random() - 0.5) * 1.2, vy: 0.15 + random() * 0.35, grow: 0.8 + amount * 0.5 + random(), peak: 0.22 + random() * 0.18 })
      }
    },
    update(grid, dt) {
      const levelChanged = grid.version !== lastGridVersion
      lastGridVersion = grid.version
      let moved = false
      slots.forEach((slot, index) => {
        if (slot.resting && !levelChanged) return
        if (!stepPiece(slot, grid, dt)) return
        if (!slot.resting) slot.angle += slot.spin * dt
        draw(index)
        moved = true
      })
      if (moved) chunks.instanceMatrix.needsUpdate = true

      for (let index = clouds.length - 1; index >= 0; index -= 1) {
        const cloud = clouds[index]
        cloud.life -= dt
        const age = 1 - cloud.life / cloud.duration
        // Dust billows up a little, spreads and thins out as it settles.
        cloud.sprite.position.x += cloud.vx * dt * (1 - age)
        cloud.sprite.position.y += cloud.vy * dt * (1 - age * 1.5)
        cloud.sprite.scale.setScalar(cloud.grow * (0.6 + age * 1.8))
        cloud.sprite.material.opacity = cloud.peak * Math.min(1, age * 6) * (1 - age)
        if (cloud.life > 0) continue
        cloud.sprite.visible = false
        clouds.splice(index, 1)
      }
    },
  }
}
