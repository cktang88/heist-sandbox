import type { World } from '../game/world'
import { caption, hudUnit, panel } from './drawHud'

/** Above this many seconds of blindness the screen is fully white; below it the view fades back in. */
const FULL_WHITE_SECONDS = 1.2
const RECOVERY_SECONDS = 3
/** The brightest the white-out gets, so the HUD drawn on top stays legible. */
const MAX_WHITE = 0.97

/** The last frame before the flash, kept to show as a fading ghost, the way an afterimage burns into the eye. */
const ghost = { canvas: null as HTMLCanvasElement | null, lastBlind: 0 }

function captureAfterimage(target: HTMLCanvasElement): void {
  const scene = document.querySelector<HTMLCanvasElement>('#stage')
  if (!scene || scene.style.display === 'none') return
  ghost.canvas ??= document.createElement('canvas')
  ghost.canvas.width = Math.max(1, Math.round(target.width / 4))
  ghost.canvas.height = Math.max(1, Math.round(target.height / 4))
  ghost.canvas.getContext('2d')!.drawImage(scene, 0, 0, ghost.canvas.width, ghost.canvas.height)
}

/**
 * Flash blindness on the 2D canvas over the 3D view: a white-out while blinded, fading through a warm
 * afterimage and a dark vignette as sight returns. Also a small "deafened" notice while the ears ring.
 */
export function drawFlashOverlay(context: CanvasRenderingContext2D, world: World, width: number, height: number): void {
  const blind = Math.max(0, world.player.blindSeconds)
  // A fresh flash (blindness jumped up) grabs the frame the player was looking at.
  if (blind > ghost.lastBlind + 0.2) captureAfterimage(context.canvas)
  ghost.lastBlind = blind
  if (blind > 0) drawBlindness(context, blind, width, height)
  if (world.player.deafSeconds > 0) drawDeafened(context, world, width, height)
}

function drawBlindness(context: CanvasRenderingContext2D, blind: number, width: number, height: number): void {
  const white = Math.min(1, blind / FULL_WHITE_SECONDS)
  const recovering = Math.min(1, blind / (FULL_WHITE_SECONDS + RECOVERY_SECONDS))
  if (ghost.canvas && recovering > 0.05) {
    // The burned-in afterimage: the old frame, brightened and tinted, drifting out of view as sight returns.
    context.save()
    context.globalCompositeOperation = 'screen'
    context.globalAlpha = Math.min(0.7, recovering * 0.9)
    context.filter = 'blur(6px) sepia(1) saturate(2.2) hue-rotate(-25deg)'
    context.drawImage(ghost.canvas, 0, 0, width, height)
    context.restore()
  }
  const vignette = context.createRadialGradient(width / 2, height / 2, height * 0.15, width / 2, height / 2, height * 0.85)
  vignette.addColorStop(0, `rgba(255,252,240,${white * MAX_WHITE})`)
  vignette.addColorStop(1, `rgba(${Math.round(30 + white * 225)},${Math.round(26 + white * 222)},${Math.round(24 + white * 210)},${Math.min(MAX_WHITE, white + recovering * 0.55)})`)
  context.fillStyle = vignette
  context.fillRect(0, 0, width, height)
}

/** A small ear-ringing notice at the top centre; the bars shrink as hearing returns. */
function drawDeafened(context: CanvasRenderingContext2D, world: World, width: number, height: number): void {
  const unit = hudUnit(height)
  const seconds = world.player.deafSeconds
  const x = width / 2
  const y = unit * 1.6
  context.globalAlpha = Math.min(1, seconds)
  panel(context, x - unit * 4.8, y - unit, unit * 9.6, unit * 1.5)
  caption(context, 'DEAFENED', x - unit * 1.1, y + unit * 0.05, '#f0e6d0', unit * 0.8, 'center')
  const bars = Math.min(5, Math.ceil(seconds))
  for (let index = 0; index < 5; index += 1) {
    const h = unit * (0.3 + 0.12 * index) * (1 + 0.25 * Math.sin(world.clock * 30 + index))
    context.fillStyle = index < bars ? '#ffd27a' : 'rgba(255,255,255,0.15)'
    context.fillRect(x + unit * (2 + index * 0.45), y - h / 2 - unit * 0.2, unit * 0.25, h)
  }
  context.globalAlpha = 1
}
