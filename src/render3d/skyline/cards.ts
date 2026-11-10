import type { Region } from './atlas'
import { regionUv } from './atlas'
import type { Sheet } from './frame'
import { LIGHT_KINDS, type Light } from './lights'

/**
 * The whole backdrop as one list of quads, drawn in order in a single call: a quad's `extra.x` says what it is.
 * Within one draw call the GPU blends triangles in the order given, so far-to-near order is kept without
 * sorting, and see-through layers and additive lights can interleave freely (see material.ts).
 */
export const MODE = { card: 0, light: 1, beam: 2, veil: 3 } as const

export type Rgba = readonly [number, number, number, number]

export class CardList {
  readonly positions: number[] = []
  readonly uvs: number[] = []
  readonly tints: number[] = []
  readonly extras: number[] = []
  readonly indices: number[] = []
  quads = 0

  private quad(corners: readonly (readonly [number, number, number])[], uvs: readonly (readonly [number, number])[], tint: Rgba, extra: Rgba): void {
    const first = this.quads * 4
    for (let corner = 0; corner < 4; corner += 1) {
      this.positions.push(...corners[corner])
      this.uvs.push(...uvs[corner])
      this.tints.push(...tint)
      this.extras.push(...extra)
    }
    this.indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
    this.quads += 1
  }

  /** A flat picture from the atlas covering `sheet` at depth `z`. */
  card(sheet: Sheet, z: number, region: Region, tint: Rgba = [1, 1, 1, 1]): void {
    const { u0, v0, u1, v1 } = regionUv(region)
    this.quad(
      [[sheet.left, sheet.bottom, z], [sheet.right, sheet.bottom, z], [sheet.right, sheet.top, z], [sheet.left, sheet.top, z]],
      [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
      tint,
      [MODE.card, 0, 0, 0],
    )
  }

  /** The region's bottom row stretched from `bottom` up to the sheet: the street disappearing into the dark below. */
  skirt(sheet: Sheet, bottom: number, z: number, region: Region): void {
    const { u0, v0, u1 } = regionUv(region)
    const v = v0 + 1.5 / 2048
    this.quad(
      [[sheet.left, bottom, z], [sheet.right, bottom, z], [sheet.right, sheet.bottom, z], [sheet.left, sheet.bottom, z]],
      [[u0, v], [u1, v], [u1, v], [u0, v]],
      [1, 1, 1, 1],
      [MODE.card, 0, 0, 0],
    )
  }

  /** One out-of-focus light: the vertex shader spreads the corners by the disc radius and animates it. */
  light(light: Light, colour: readonly [number, number, number], scale: number): void {
    const centre: [number, number, number] = [light.x, light.y, light.z]
    const kind = LIGHT_KINDS.indexOf(light.kind) + (light.hex ? 10 : 0)
    const tint: Rgba = [colour[0] * light.strength * scale, colour[1] * light.strength * scale, colour[2] * light.strength * scale, light.radius]
    this.quad([centre, centre, centre, centre], [[-1, -1], [1, -1], [1, 1], [-1, 1]], tint, [MODE.light, light.phase, kind, light.speed])
  }

  /** A searchlight beam from `base`, swept slowly by the vertex shader. */
  beam(base: readonly [number, number, number], colour: readonly [number, number, number], length: number, width: number, phase: number, speed: number): void {
    this.quad([base, base, base, base], [[-1, 0], [1, 0], [1, 1], [-1, 1]], [colour[0], colour[1], colour[2], length], [MODE.beam, phase, speed, width])
  }

  /**
   * A veil of mist (`tile` 0) or rain (`tile` 1) over `sheet`, its texture repeated every `tileSize` units and
   * scrolled by the shader. Mist thins out toward the top of the sheet; rain falls evenly.
   */
  veil(sheet: Sheet, z: number, tile: 0 | 1, tileSize: number, colour: readonly [number, number, number], strength: number): void {
    const across = (sheet.right - sheet.left) / tileSize
    const up = (sheet.top - sheet.bottom) / tileSize
    this.quad(
      [[sheet.left, sheet.bottom, z], [sheet.right, sheet.bottom, z], [sheet.right, sheet.top, z], [sheet.left, sheet.top, z]],
      [[0, 0], [across, 0], [across, up], [0, up]],
      [colour[0], colour[1], colour[2], strength],
      [MODE.veil, tile, 0, up],
    )
  }
}
