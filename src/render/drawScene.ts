import type { Grid } from '../game/tiles'
import type { Vec } from '../game/types'
import type { World } from '../game/world'
import { createBackdrop } from './backdrop'
import type { Camera } from './camera'
import { drawStealthScreen, drawStealthWorld } from './stealthOverlay'
import { hudUnit } from './drawHud'
import { drawEffects, drawFalling, drawGoggles, drawGuard, drawGuardMarks, drawLamps, drawPlayer, drawProjectiles, drawSignals, drawThings } from './drawActors'
import { drawPickups, drawProps } from './drawProps'
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
      drawRain(context, camera, world.clock)

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
      drawGuardMarks(context, world)
      drawSignals(context, world)
      drawProjectiles(context, world)
      drawEffects(context, world)
      drawStealthWorld(context, world, camera)
      context.setTransform(1, 0, 0, 1, 0, 0)
      drawStealthScreen(context, world, camera, hudUnit(camera.height))
    },
  }
}
