import { GRAVITY } from './physics'
import type { Rng } from './rng'
import type { Vec } from './types'

export type Particle = Vec & { vx: number; vy: number; life: number; color: string; size: number }
/** Short-lived ring or burst drawn at a spot: explosions, noise ripples, muzzle flashes. */
export type Flash = Vec & { radius: number; life: number; duration: number; kind: 'explosion' | 'noise' | 'muzzle' }

export type Effects = { particles: Particle[]; flashes: Flash[] }

const MAX_PARTICLES = 700

export function burst(effects: Effects, rng: Rng, at: Vec, count: number, color: string, speed: number): void {
  for (let index = 0; index < count && effects.particles.length < MAX_PARTICLES; index += 1) {
    const angle = rng() * Math.PI * 2
    const power = speed * (0.3 + rng() * 0.7)
    effects.particles.push({
      x: at.x, y: at.y, vx: Math.cos(angle) * power, vy: Math.sin(angle) * power - speed * 0.3,
      life: 0.4 + rng() * 0.6, color, size: 0.12 + rng() * 0.16,
    })
  }
}

export function flash(effects: Effects, at: Vec, radius: number, duration: number, kind: Flash['kind']): void {
  effects.flashes.push({ x: at.x, y: at.y, radius, life: duration, duration, kind })
}

export function stepEffects(effects: Effects, dt: number): void {
  for (const particle of effects.particles) {
    particle.vy += GRAVITY * 0.6 * dt
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.life -= dt
  }
  for (const item of effects.flashes) item.life -= dt
  effects.particles = effects.particles.filter((particle) => particle.life > 0)
  effects.flashes = effects.flashes.filter((item) => item.life > 0)
}
