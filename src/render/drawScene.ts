import type { Grid } from '../game/tiles'
import type { Vec } from '../game/types'
import type { World } from '../game/world'
import { createBackdrop } from './backdrop'
import type { Camera } from './camera'
import { drawEffects, drawGuard, drawLamps, drawPlayer, drawProjectiles, drawThings } from './drawActors'
import { createLighting } from './lighting'
import { createTileCache, type TileCache } from './tileCache'

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
      backdrop.draw(context, camera)

      const shakeX = (Math.random() - 0.5) * world.shake * 0.6
      const shakeY = (Math.random() - 0.5) * world.shake * 0.6
      const toWorld = () => {
        context.setTransform(camera.scale, 0, 0, camera.scale, camera.width / 2 + (shakeX - camera.x) * camera.scale, camera.height / 2 + (shakeY - camera.y) * camera.scale)
      }

      toWorld()
      tiles.draw(context, camera, 'back')
      drawThings(context, world)
      drawLamps(context, world)
      for (const guard of world.guards) drawGuard(context, world, guard)
      tiles.draw(context, camera, 'front')
      drawPlayer(context, world, aim)

      lighting.apply(context, world, camera)

      toWorld()
      lighting.drawGlows(context, world)
      drawProjectiles(context, world)
      drawEffects(context, world)
      context.setTransform(1, 0, 0, 1, 0, 0)
    },
  }
}
