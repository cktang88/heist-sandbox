import { GROUND, type Lamp } from '../game/level'
import { isSolidAt } from '../game/tiles'
import { centerOf } from '../game/types'
import type { World } from '../game/world'
import type { Camera } from './camera'
import { eyeOf, lightPolygon, tracePolygon, visionCone } from './cone'

/** The light image is drawn small and stretched, which is cheap and softens shadow edges for free. */
const DOWNSCALE = 3
const AMBIENT = '#343e60'
const MOONLIGHT = '#1c2440'
const GLOW_COLORS = { warm: '255,196,120', cold: '170,205,255', green: '120,230,150', fire: '255,150,60', gold: '255,215,90' } as const
type GlowColor = keyof typeof GLOW_COLORS

export type Lighting = {
  /** Darkens the finished scene, leaving pools of light around lamps, torches, flashes and explosions. */
  apply(context: CanvasRenderingContext2D, world: World, camera: Camera): void
  /** Bright things that should shine through the dark: bulbs, blasts. Call with the world transform set. */
  drawGlows(context: CanvasRenderingContext2D, world: World): void
}

export function lampIsLit(world: World, lamp: Lamp): boolean {
  return !lamp.hung || isSolidAt(world.grid, lamp.x, lamp.y - 0.7)
}

export function createLighting(): Lighting {
  const map = document.createElement('canvas')
  const lc = map.getContext('2d')!
  const sprites = Object.fromEntries(Object.entries(GLOW_COLORS).map(([name, rgb]) => [name, glowSprite(rgb)])) as Record<GlowColor, HTMLCanvasElement>

  function glow(c: CanvasRenderingContext2D, color: GlowColor, x: number, y: number, radius: number, alpha = 1): void {
    c.globalAlpha = alpha
    c.drawImage(sprites[color], x - radius, y - radius, radius * 2, radius * 2)
    c.globalAlpha = 1
  }

  return {
    apply(context, world, camera) {
      const width = Math.ceil(camera.width / DOWNSCALE)
      const height = Math.ceil(camera.height / DOWNSCALE)
      if (map.width !== width || map.height !== height) {
        map.width = width
        map.height = height
      }
      const scale = camera.scale / DOWNSCALE
      lc.setTransform(1, 0, 0, 1, 0, 0)
      lc.globalCompositeOperation = 'source-over'
      lc.fillStyle = AMBIENT
      lc.fillRect(0, 0, width, height)
      lc.globalCompositeOperation = 'lighter'
      lc.setTransform(scale, 0, 0, scale, width / 2 - camera.x * scale, height / 2 - camera.y * scale)

      lc.fillStyle = MOONLIGHT
      lc.fillRect(0, 0, world.grid.width, GROUND)

      const halfWide = camera.width / camera.scale / 2
      const halfTall = camera.height / camera.scale / 2
      const onScreen = (x: number, y: number, margin: number) => Math.abs(x - camera.x) < halfWide + margin && Math.abs(y - camera.y) < halfTall + margin

      for (const lamp of world.lamps) {
        if (!onScreen(lamp.x, lamp.y, lamp.radius) || !lampIsLit(world, lamp)) continue
        lc.save()
        tracePolygon(lc, lightPolygon(world.grid, lamp, lamp.radius))
        lc.clip()
        glow(lc, lamp.color, lamp.x, lamp.y, lamp.radius)
        lc.restore()
      }

      for (const guard of world.guards) {
        if (guard.state === 'dead' || !onScreen(guard.x, guard.y, 14)) continue
        const eye = eyeOf(guard)
        lc.save()
        tracePolygon(lc, visionCone(world, guard))
        lc.clip()
        glow(lc, guard.state === 'alert' ? 'fire' : 'warm', eye.x + guard.facing * 4, eye.y, 11, 0.9)
        lc.restore()
      }

      const player = centerOf(world.player)
      glow(lc, 'cold', player.x, player.y, 3.2, 0.55)
      if (!world.loot.taken) glow(lc, 'gold', world.loot.x + 0.4, world.loot.y + 0.4, 3, 0.8)
      for (const flash of world.effects.flashes) {
        if (flash.kind === 'noise') continue
        const strength = flash.life / flash.duration
        if (flash.kind === 'explosion') glow(lc, 'fire', flash.x, flash.y, flash.radius * 4, strength)
        else glow(lc, 'fire', flash.x, flash.y, 6, strength)
      }

      context.save()
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.globalCompositeOperation = 'multiply'
      context.imageSmoothingEnabled = true
      context.drawImage(map, 0, 0, camera.width, camera.height)
      context.restore()
    },

    drawGlows(context, world) {
      context.globalCompositeOperation = 'lighter'
      for (const lamp of world.lamps) if (lampIsLit(world, lamp)) glow(context, lamp.color, lamp.x, lamp.y, 1.3, 0.9)
      for (const flash of world.effects.flashes) {
        if (flash.kind !== 'explosion') continue
        glow(context, 'fire', flash.x, flash.y, flash.radius * 2.2, flash.life / flash.duration)
      }
      context.globalCompositeOperation = 'source-over'
    },
  }
}

/** A soft round glow, drawn once and reused, because building gradients every frame is slow. */
function glowSprite(rgb: string): HTMLCanvasElement {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const c = canvas.getContext('2d')!
  const fade = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  fade.addColorStop(0, `rgba(${rgb},1)`)
  fade.addColorStop(0.35, `rgba(${rgb},0.55)`)
  fade.addColorStop(1, `rgba(${rgb},0)`)
  c.fillStyle = fade
  c.fillRect(0, 0, size, size)
  return canvas
}
