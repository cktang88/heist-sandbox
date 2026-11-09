import type { Vec } from '../game/types'
import type { World } from '../game/world'
import type { Camera } from './camera'
import { drawEffects, drawGuard, drawPlayer, drawThings } from './drawActors'
import { drawBackWalls, drawTiles } from './drawTiles'

/** Draws the whole heist. Everything inside is in tile units; the camera transform scales it to pixels. */
export function drawScene(context: CanvasRenderingContext2D, world: World, camera: Camera, aim: Vec): void {
  const sky = context.createLinearGradient(0, 0, 0, camera.height)
  sky.addColorStop(0, '#0d1230')
  sky.addColorStop(1, '#3a2a4a')
  context.fillStyle = sky
  context.fillRect(0, 0, camera.width, camera.height)

  const shakeX = (Math.random() - 0.5) * world.shake * 0.6
  const shakeY = (Math.random() - 0.5) * world.shake * 0.6
  context.save()
  context.translate(camera.width / 2, camera.height / 2)
  context.scale(camera.scale, camera.scale)
  context.translate(-camera.x + shakeX, -camera.y + shakeY)

  drawBackWalls(context, world.interiors)
  drawThings(context, world)
  for (const guard of world.guards) drawGuard(context, world, guard)
  drawTiles(context, world.grid, camera)
  drawPlayer(context, world, aim)
  drawEffects(context, world)

  context.restore()
}
