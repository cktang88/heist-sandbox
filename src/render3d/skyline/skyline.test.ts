import { describe, expect, it } from 'vitest'
import { CAMERA_DISTANCE, TILES_TALL } from '../style/cameraRig'
import { CardList } from './cards'
import { blurPixels, cameraSpan, coverBottom, LAYERS, layerSheet, skySheet, SKY_Z } from './frame'
import { buildingTop, forEachWindow, layOutLayer, windowLight } from './layout'
import { layerLights, LIGHT_BUDGET, LIGHT_KINDS, skyLights } from './lights'
import { MOODS, moodFor, type MoodName } from './moods'

const WIDTH = 300
const GROUND = -164

describe('backdrop layers', () => {
  it('are ordered far to near, each hazier and more out of focus than the one in front', () => {
    const depths = LAYERS.map((layer) => layer.z)
    expect([...depths].sort((a, b) => a - b)).toEqual(depths)
    expect(SKY_Z).toBeLessThan(depths[0])
    for (let index = 1; index < LAYERS.length; index += 1) {
      expect(LAYERS[index].haze).toBeLessThan(LAYERS[index - 1].haze)
      expect(blurPixels(LAYERS[index].z)).toBeLessThan(blurPixels(LAYERS[index - 1].z))
    }
  })

  it('fill the view from every camera position along the level, on a 21:9 screen', () => {
    const [leftmost, rightmost] = cameraSpan(WIDTH)
    for (const spec of LAYERS) {
      const sheet = layerSheet(spec, WIDTH, GROUND)
      const halfWide = (TILES_TALL / 2) * ((CAMERA_DISTANCE - spec.z) / CAMERA_DISTANCE) * (21 / 9)
      expect(sheet.left).toBeLessThanOrEqual(leftmost - halfWide)
      expect(sheet.right).toBeGreaterThanOrEqual(rightmost + halfWide)
      expect(coverBottom(GROUND)).toBeLessThan(sheet.bottom)
    }
    // From the top of the level (the parachute drop) the sky still reaches past the top of the view.
    const sky = skySheet(WIDTH, GROUND)
    expect(sky.top).toBeGreaterThan(-TILES_TALL / 2 + (TILES_TALL / 2) * ((CAMERA_DISTANCE - SKY_Z) / CAMERA_DISTANCE))
  })
})

describe('city layout', () => {
  it('is the same for the same seed and different for another', () => {
    for (const spec of LAYERS) {
      expect(layOutLayer(spec, WIDTH, GROUND, 7)).toEqual(layOutLayer(spec, WIDTH, GROUND, 7))
      expect(layOutLayer(spec, WIDTH, GROUND, 7).buildings).not.toEqual(layOutLayer(spec, WIDTH, GROUND, 8).buildings)
    }
  })

  it('spans the whole layer with buildings that fit under its roofline and step in as they rise', () => {
    for (const spec of LAYERS) {
      const layer = layOutLayer(spec, WIDTH, GROUND, 3)
      const front = layer.buildings.filter((building) => building.row === 1)
      expect(Math.min(...front.map((building) => building.x0))).toBeLessThanOrEqual(layer.sheet.left)
      expect(Math.max(...front.map((building) => building.x1))).toBeGreaterThanOrEqual(layer.sheet.right)
      for (const building of layer.buildings) {
        expect(buildingTop(building)).toBeLessThanOrEqual(GROUND + spec.rise)
        for (let index = 1; index < building.tiers.length; index += 1) {
          const [below, above] = [building.tiers[index - 1], building.tiers[index]]
          expect(above.x0).toBeGreaterThanOrEqual(below.x0)
          expect(above.x1).toBeLessThanOrEqual(below.x1)
          expect(above.top).toBeGreaterThanOrEqual(below.top)
        }
      }
    }
  })

  it('has a skyline with real megatowers far off and a mix of heights', () => {
    const far = layOutLayer(LAYERS[0], WIDTH, GROUND, 1)
    const heights = far.buildings.map((building) => buildingTop(building) - GROUND)
    expect(heights.filter((height) => height > 200).length).toBeGreaterThanOrEqual(3)
    expect(heights.filter((height) => height < 60).length).toBeGreaterThanOrEqual(10)
  })

  it('lights more windows at night than on an overcast day, and none inside a dark block', () => {
    const layer = layOutLayer(LAYERS[1], WIDTH, GROUND, 5)
    const share = (odds: number) => {
      let [lit, total] = [0, 0]
      for (const building of layer.buildings) forEachWindow(building, GROUND, (cell) => {
        total += 1
        if (windowLight(building, cell, odds) > 0) lit += 1
      })
      return lit / total
    }
    expect(share(MOODS.night.lit)).toBeGreaterThan(0.12)
    expect(share(MOODS.night.lit)).toBeLessThan(0.5)
    expect(share(MOODS.overcast.lit)).toBeLessThan(share(MOODS.night.lit) / 3)
    for (const building of layer.buildings) {
      const dark = building.dark
      if (!dark) continue
      forEachWindow(building, GROUND, (cell) => {
        if (cell.x > dark.x0 && cell.x < dark.x1 && cell.y > dark.y0 && cell.y < dark.y1) expect(windowLight(building, cell, 0.9)).toBe(0)
      })
    }
  })
})

describe('backdrop lights', () => {
  const moods = Object.keys(MOODS) as MoodName[]

  it('stay within each layer\'s budget in every mood', () => {
    for (const name of moods) {
      for (const seed of [1, 2, 3]) {
        for (const spec of LAYERS) {
          const lights = layerLights(layOutLayer(spec, WIDTH, GROUND, seed), MOODS[name], seed)
          expect(lights.length).toBeLessThanOrEqual(LIGHT_BUDGET[spec.name])
          for (const light of lights) {
            expect(LIGHT_KINDS).toContain(light.kind)
            expect(light.radius).toBeGreaterThan(0)
            expect(light.z).toBe(spec.z)
          }
        }
        expect(skyLights(WIDTH, GROUND, MOODS[name], seed).length).toBeLessThanOrEqual(LIGHT_BUDGET.sky)
      }
    }
  })

  it('are many at night and few by day, when only beacons and the odd window show', () => {
    const count = (name: MoodName) => LAYERS.reduce((sum, spec) => sum + layerLights(layOutLayer(spec, WIDTH, GROUND, 4), MOODS[name], 4).length, 0)
    expect(count('night')).toBeGreaterThan(300)
    expect(count('overcast')).toBeLessThan(count('night') / 4)
    expect(count('dusk')).toBeLessThan(count('night'))
  })

  it('get bigger discs further away, as a lens focused on the building blurs them more', () => {
    const average = (index: number) => {
      const lights = layerLights(layOutLayer(LAYERS[index], WIDTH, GROUND, 2), MOODS.night, 2)
      return lights.reduce((sum, light) => sum + light.radius / (CAMERA_DISTANCE - light.z), 0) / lights.length
    }
    expect(average(0)).toBeGreaterThan(average(2))
  })
})

describe('mood', () => {
  it('follows the photographed sky the lighting chose', () => {
    expect(moodFor('day', 'golden_hour').name).toBe('dusk')
    expect(moodFor('day', 'day_overcast').name).toBe('overcast')
    expect(moodFor('day', null).name).toBe('overcast')
    expect(moodFor('night', 'city_night_wet').name).toBe('wet')
    expect(moodFor('night', 'moonlit').name).toBe('moonlit')
    expect(moodFor('night', null).name).toBe('night')
    expect(MOODS.wet.rain).toBe(true)
  })
})

describe('card list', () => {
  it('keeps every attribute in step, four corners and two triangles per quad', () => {
    const cards = new CardList()
    cards.card({ left: 0, right: 10, bottom: 0, top: 5 }, -100, { x: 0, y: 0, w: 64, h: 64 })
    cards.light({ x: 1, y: 2, z: -100, radius: 2, colour: '#ffffff', strength: 1, kind: 'blink', hex: true, phase: 0, speed: 1 }, [1, 1, 1], 0.5)
    cards.beam([0, 0, -300], [0.1, 0.1, 0.1], 100, 4, 0, 0.1)
    cards.veil({ left: 0, right: 10, bottom: 0, top: 5 }, -90, 0, 5, [1, 1, 1], 0.3)
    expect(cards.quads).toBe(4)
    expect(cards.positions.length).toBe(4 * 4 * 3)
    expect(cards.uvs.length).toBe(4 * 4 * 2)
    expect(cards.tints.length).toBe(4 * 4 * 4)
    expect(cards.extras.length).toBe(4 * 4 * 4)
    expect(cards.indices.length).toBe(4 * 6)
    expect(Math.max(...cards.indices)).toBe(15)
    // The light's kind carries its aperture shape: blink (2) plus 10 for a hexagon.
    expect(cards.extras[4 * 4 + 2]).toBe(12)
  })
})
