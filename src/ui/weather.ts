import { isOutdoors } from '../game/director/conditions/rain'
import type { World } from '../game/world'
import { h } from './dom'
import './debrief.css'

/**
 * Tonight's weather drawn over the view as page elements: rain streaks (heavier outside than in), and the white of a
 * lightning flash. Each frame only writes the two opacities, and only when they change.
 */

const FLASH_SECONDS = 0.4
const RAIN_OUTSIDE = 0.9
const RAIN_INSIDE = 0.25

export type Weather = { update(world: World): void }

/** How much of the rain overlay shows: full outside, faint in a room (rain on the windows), none underground. */
export function rainShare(raining: boolean, outdoors: boolean, underground: boolean): number {
  if (!raining || underground) return 0
  return outdoors ? RAIN_OUTSIDE : RAIN_INSIDE
}

export function createWeather(): Weather {
  const rain = h('div', { class: 'sg-rain' })
  const flash = h('div', { class: 'sg-lightning' })
  document.body.append(h('div', { class: 'sg-weather', attrs: { 'aria-hidden': 'true' } }, rain, flash))
  let rainShown = ''
  let flashShown = ''
  return {
    update(world) {
      const feet = { x: world.player.x + world.player.w / 2, y: world.player.y + world.player.h }
      const wet = rainShare(world.director.masking.outdoors > 0, isOutdoors(world, feet), feet.y > world.groundY)
      const since = world.clock - world.director.lightningAt
      const bright = since >= 0 && since < FLASH_SECONDS ? 0.55 * (1 - since / FLASH_SECONDS) * (since < 0.08 || since > 0.16 ? 1 : 0.35) : 0
      const rainText = wet.toFixed(2)
      const flashText = bright.toFixed(2)
      if (rainText !== rainShown) rain.style.opacity = rainShown = rainText
      if (flashText !== flashShown) flash.style.opacity = flashShown = flashText
    },
  }
}
