import { outlineTarget } from '../game/hover'
import type { Grid } from '../game/tiles'
import type { Vec } from '../game/types'
import type { World } from '../game/world'
import { createBackdrop } from './backdrop'
import type { Camera } from './camera'
import { drawEffects, drawFalling, drawGoggles, drawGuard, drawLamps, drawPlayer, drawProjectiles, drawThings } from './drawActors'
import { drawPickups, drawProps } from './drawProps'
import { drawSystemsBehind, drawSystemsFront } from './drawSystems'
import { createLighting } from './lighting'
import { drawRain } from './rain'
import { createTileCache, type TileCache } from './tileCache'

const MAX_SHAKE_TILES = 0.45

export type SceneRenderer = { draw(context: CanvasRenderingContext2D, world: World, camera: Camera, aim: Vec): void }

/**
 * Draws the whole heist in layers:
 * sky -> back walls -> props and people -> walls -> darkness and light -> things that glow.
 */
export function createSceneRenderer(): SceneRenderer {
  const backdrop = createBackdrop()
  const lighting = createLighting()
  const caches = new WeakMap<Grid, TileCache>()

  return {
    draw(context, world, camera, aim) {
      let tiles = caches.get(world.grid)
      if (!tiles) caches.set(world.grid, (tiles = createTileCache(world.grid, world.interiors)))

      context.setTransform(1, 0, 0, 1, 0, 0)
      context.imageSmoothingEnabled = true
      backdrop.draw(context, camera, world.groundY)
      // Only on a rainy night (the rain condition sets the outdoor masking).
      if (world.director.masking.outdoors > 0) drawRain(context, camera, world.clock)

      // Shake grows with the square of the jolt, so small hits stay subtle and big ones slam.
      const jolt = world.shake * world.shake * MAX_SHAKE_TILES
      const shakeX = (Math.random() - 0.5) * 2 * jolt
      const shakeY = (Math.random() - 0.5) * 2 * jolt
      const toWorld = () => {
        context.setTransform(camera.scale, 0, 0, camera.scale, camera.width / 2 + (shakeX - camera.x) * camera.scale, camera.height / 2 + (shakeY - camera.y) * camera.scale)
      }

      toWorld()
      tiles.draw(context, camera, 'back')
      drawProps(context, world)
      drawPickups(context, world)
      drawSystemsBehind(context, world, camera)
      drawThings(context, world)
      drawLamps(context, world)
      for (const guard of world.guards) drawGuard(context, world, guard)
      tiles.draw(context, camera, 'front')
      drawFalling(context, world)
      drawPlayer(context, world, aim)

      lighting.apply(context, world, camera)

      toWorld()
      lighting.drawGlows(context, world)
      drawGoggles(context, world)
      drawProjectiles(context, world)
      drawEffects(context, world)
      drawSystemsFront(context, world, camera)
      drawOutline(context, world, aim, camera.scale, world.clock)
      // Markers, names, barks and arrows are the same over both views: main.ts draws `overlay.ts` on top.
      context.setTransform(1, 0, 0, 1, 0, 0)
    },
  }
}

/** Line width of the hover outline, in screen pixels, and how far it stands off the thing. */
const OUTLINE_PIXELS = 2.5
const OUTLINE_GAP_PIXELS = 2

/** A yellow box round the interactive thing under the cursor, or, quieter, round what E would act on. */
function drawOutline(context: CanvasRenderingContext2D, world: World, aim: Vec, scale: number, clock: number): void {
  const choice = outlineTarget(world, aim)
  if (!choice) return
  const { x, y, w, h } = choice.target.box
  const gap = OUTLINE_GAP_PIXELS / scale
  const pulse = 0.85 + 0.15 * Math.sin(clock * 5)
  context.save()
  context.globalAlpha = (choice.hovered ? 1 : 0.7) * pulse
  context.strokeStyle = '#ffd71f'
  context.lineWidth = OUTLINE_PIXELS / scale
  context.lineJoin = 'round'
  context.strokeRect(x - gap, y - gap, w + gap * 2, h + gap * 2)
  context.restore()
}
