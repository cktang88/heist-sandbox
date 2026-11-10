import { Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, type Material } from 'three'
import type { TimeOfDay } from '../../game/site'
import { blobTexture, glyphAtlas, grimeTexture, hazardTexture, logoTexture, windowAtlas } from './art'
import { photoMaterial, type PhotoSpec } from './photoMaterials'

/**
 * Every material the room finishes, facades and ground markings use, made once per time of day and shared.
 * Colours come from per-corner colours, so each of these is one draw call per chunk however many rooms use it.
 */
export type FinishKit = {
  photo(spec: PhotoSpec): Material
  /** Plain painted trims: skirting, rails, panel joints, sills. */
  trim: Material
  /** Window frames, pipes, trays, railings. */
  metal: Material
  /** Road and floor markings. */
  paint: Material
  /** What windows show; unlit, so day windows read bright and night windows dark against a lit room. */
  view: Material
  /** Lit-up things: cove strips, beacons, lit windows on facades. Corner colours above 1 bloom. */
  glow: Material
  /** Stencilled letters and numbers. */
  letters: Material
  /** Glowing block letters for signs. */
  neon: Material
  /** Backlit lettering: the company sign. */
  logo: Material
  hazard: Material
  grime: Material
  mirror: Material
  puddle: Material
}

const kits = new Map<TimeOfDay, FinishKit>()

export function finishKit(time: TimeOfDay): FinishKit {
  return kits.get(time) ?? kits.set(time, createKit(time)).get(time)!
}

function createKit(time: TimeOfDay): FinishKit {
  const night = time === 'night'
  const glyphs = glyphAtlas()
  return {
    photo: photoMaterial,
    trim: new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 }),
    metal: new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.65 }),
    paint: new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 }),
    // Daylight through glass is brighter than anything painted indoors; at night the glass is mostly dark.
    view: new MeshBasicMaterial({ map: windowAtlas(time), color: new Color(1, 1, 1).multiplyScalar(night ? 0.9 : 1.25) }),
    glow: new MeshBasicMaterial({ vertexColors: true }),
    letters: new MeshStandardMaterial({ map: glyphs, vertexColors: true, transparent: true, alphaTest: 0.3, roughness: 0.8, depthWrite: false }),
    neon: new MeshBasicMaterial({ map: glyphs, vertexColors: true, transparent: true, depthWrite: false }),
    logo: new MeshBasicMaterial({ map: logoTexture(), vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide }),
    hazard: new MeshStandardMaterial({ map: hazardTexture(), vertexColors: true, roughness: 0.7 }),
    grime: new MeshStandardMaterial({ map: grimeTexture(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }),
    mirror: new MeshStandardMaterial({ color: 0xc8d0d8, roughness: 0.06, metalness: 1 }),
    puddle: new MeshStandardMaterial({
      color: 0x06080c, alphaMap: blobTexture(), transparent: true, depthWrite: false, roughness: 0.04, metalness: 0.2, envMapIntensity: 2.5,
      polygonOffset: true, polygonOffsetFactor: -3,
    }),
  }
}
