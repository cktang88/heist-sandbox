import { GRAVITY } from './physics'
import type { Rng } from './rng'
import type { Vec } from './types'

export type Particle = Vec & { vx: number; vy: number; life: number; color: string; size: number }
/** Short-lived ring or burst drawn at a spot: explosions, noise ripples, muzzle flashes. */
export type Flash = Vec & { radius: number; life: number; duration: number; kind: 'explosion' | 'noise' | 'muzzle'; angle: number }

export type Effects = { particles: Particle[]; flashes: Flash[] }

const MAX_PARTICLES = 700

/** Spent particles, reused by the next burst so a busy fight does not make garbage for every spark. */
const spare: Particle[] = []

function particle(x: number, y: number, vx: number, vy: number, life: number, color: string, size: number): Particle {
  const reused = spare.pop()
  if (!reused) return { x, y, vx, vy, life, color, size }
  reused.x = x
  reused.y = y
  reused.vx = vx
  reused.vy = vy
  reused.life = life
  reused.color = color
  reused.size = size
  return reused
}

export function burst(effects: Effects, rng: Rng, at: Vec, count: number, color: string, speed: number): void {
  for (let index = 0; index < count && effects.particles.length < MAX_PARTICLES; index += 1) {
    const angle = rng() * Math.PI * 2
    const power = speed * (0.3 + rng() * 0.7)
    const vx = Math.cos(angle) * power
    const vy = Math.sin(angle) * power - speed * 0.3
    const life = 0.4 + rng() * 0.6
    effects.particles.push(particle(at.x, at.y, vx, vy, life, color, 0.12 + rng() * 0.16))
  }
}

export function flash(effects: Effects, at: Vec, radius: number, duration: number, kind: Flash['kind'], angle = 0): void {
  effects.flashes.push({ x: at.x, y: at.y, radius, life: duration, duration, kind, angle })
}

/** A spent brass casing flicked out behind the shooter. */
export function ejectShell(effects: Effects, rng: Rng, at: Vec, facing: number): void {
  if (effects.particles.length >= MAX_PARTICLES) return
  const vx = -facing * (2 + rng() * 3)
  effects.particles.push(particle(at.x, at.y, vx, -4 - rng() * 3, 1.4, '#e0b95a', 0.11))
}

/** Moves the particles and ages the flashes. Spent ones are dropped in place, keeping the lists' order. */
export function stepEffects(effects: Effects, dt: number): void {
  const particles = effects.particles
  let kept = 0
  for (let index = 0; index < particles.length; index += 1) {
    const item = particles[index]
    item.vy += GRAVITY * 0.6 * dt
    item.x += item.vx * dt
    item.y += item.vy * dt
    item.life -= dt
    if (item.life > 0) particles[kept++] = item
    else if (spare.length < MAX_PARTICLES) spare.push(item)
  }
  particles.length = kept
  // Flashes are not reused: other systems remember which blasts they have already reacted to.
  const flashes = effects.flashes
  kept = 0
  for (let index = 0; index < flashes.length; index += 1) {
    const item = flashes[index]
    item.life -= dt
    if (item.life > 0) flashes[kept++] = item
  }
  flashes.length = kept
}
