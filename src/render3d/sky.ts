import { Group } from 'three'
import type { TimeOfDay } from '../game/site'
import { lookFor } from './core/looks'
import { moodFor } from './skyline/moods'
import { createSkyline } from './skyline/skyline'

/**
 * Everything seen beyond the level, built once: a sky and a distant, out-of-focus city in three layers
 * (see skyline/). `variantSeed` is the value the lighting picks its photographed sky with (`lookFor`), so
 * the backdrop matches it (wet night, moonlit night, golden hour, overcast day); it also seeds the layout.
 */
export function createSky(levelWidth: number, groundY: number, time: TimeOfDay = 'night', variantSeed?: number): Group {
  const sky = variantSeed === undefined ? null : lookFor(time, variantSeed).sky
  const skyline = createSkyline(levelWidth, groundY, moodFor(time, sky), variantSeed ?? 1)
  const group = new Group()
  group.add(skyline.mesh)
  group.userData.dispose = skyline.dispose
  return group
}
