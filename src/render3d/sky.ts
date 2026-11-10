import { Group } from 'three'
import type { TimeOfDay } from '../game/site'
import { lookFor } from './core/looks'
import { moodFor } from './skyline/moods'
import { createSkyline } from './skyline/skyline'
import { styleFromQuery, type Style } from './style/styles'

type Build = { levelWidth: number; groundY: number; time: TimeOfDay; variantSeed?: number }

/**
 * Everything seen beyond the level, built once: a sky and a distant, out-of-focus city in three layers
 * (see skyline/). `variantSeed` is the value the lighting picks its photographed sky with (`lookFor`), so
 * the backdrop matches it (wet night, moonlit night, golden hour, overcast day); it also seeds the layout.
 * `style` is the art style: the pixel looks get a pixel-art version of the same city (see setSkyStyle).
 */
export function createSky(levelWidth: number, groundY: number, time: TimeOfDay = 'night', variantSeed?: number, style: Style = styleFromQuery(location.search)): Group {
  const group = new Group()
  const build: Build = { levelWidth, groundY, time, variantSeed }
  group.userData.build = build
  setSkyStyle(group, style)
  return group
}

/** Rebuilds a backdrop made by `createSky` for another art style, only when that style needs the other version. */
export function setSkyStyle(group: Group, style: Style): void {
  const pixel = style.finish.kind === 'pixel' || style.finish.kind === 'sketch'
  if (group.userData.pixel === pixel) return
  group.userData.dispose?.()
  group.clear()
  const { levelWidth, groundY, time, variantSeed } = group.userData.build as Build
  const sky = variantSeed === undefined ? null : lookFor(time, variantSeed).sky
  const skyline = createSkyline(levelWidth, groundY, moodFor(time, sky), variantSeed ?? 1, pixel)
  group.add(skyline.mesh)
  group.userData.pixel = pixel
  group.userData.dispose = skyline.dispose
}
