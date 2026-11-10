import type { World } from '../game/world'
import type { Camera } from './camera'
import { drawGuardMarks, drawSignals } from './drawActors'

/**
 * Flat markers drawn over the 3D scene, in world units: guards' "!" and "?" marks and awareness bars, sound ripples, lockpick progress and the extraction label.
 */
export function drawOverlay(context: CanvasRenderingContext2D, world: World, camera: Camera): void {
  context.setTransform(camera.scale, 0, 0, camera.scale, camera.width / 2 - camera.x * camera.scale, camera.height / 2 - camera.y * camera.scale)

  for (const guard of world.guards) {
    if (guard.state === 'dead') continue
    if (guard.awareness > 0.05 && guard.state !== 'alert') {
      const x = guard.x + guard.w / 2
      context.fillStyle = 'rgba(0,0,0,0.6)'
      context.fillRect(x - 0.5, guard.y - 0.55, 1, 0.14)
      context.fillStyle = '#ffd23f'
      context.fillRect(x - 0.5, guard.y - 0.55, guard.awareness, 0.14)
    }
  }

  for (const flash of world.effects.flashes) {
    if (flash.kind !== 'noise') continue
    const age = 1 - flash.life / flash.duration
    context.globalAlpha = (1 - age) * 0.22
    context.strokeStyle = '#dfe6f2'
    context.lineWidth = 0.05
    context.beginPath()
    context.arc(flash.x, flash.y, flash.radius * age, 0, Math.PI * 2)
    context.stroke()
  }
  context.globalAlpha = 1

  const player = world.player
  if (player.pick > 0) {
    const x = player.x + player.w / 2
    context.fillStyle = 'rgba(0,0,0,0.6)'
    context.fillRect(x - 0.75, player.y - 0.5, 1.5, 0.18)
    context.fillStyle = '#39ff6a'
    context.fillRect(x - 0.75, player.y - 0.5, 1.5 * player.pick, 0.18)
  }

  drawGuardMarks(context, world)
  drawSignals(context, world)
  context.setTransform(1, 0, 0, 1, 0, 0)
}
