import type { LayerName, Sheet } from './frame'

/**
 * Every picture of the backdrop shares one 2048 x 2048 texture, so the whole backdrop is one draw call.
 * The city is out of focus, so it needs far fewer texels than the sharp building in front of it.
 */
export const ATLAS_SIZE = 2048

/** A rectangle of the atlas in pixels, y down (canvas convention). */
export type Region = { x: number; y: number; w: number; h: number }

export type RegionName = LayerName | 'sky' | 'mist' | 'rain'

export const REGIONS: Record<RegionName, Region> = {
  near: { x: 0, y: 0, w: 2048, h: 470 },
  mid: { x: 0, y: 474, w: 2048, h: 802 },
  far: { x: 0, y: 1280, w: 1024, h: 600 },
  sky: { x: 1028, y: 1280, w: 1020, h: 512 },
  mist: { x: 1028, y: 1796, w: 128, h: 128 },
  rain: { x: 1160, y: 1796, w: 128, h: 128 },
}

/** Texture coordinates (v up, as uploaded with flipY) of a region, pulled in half a texel so neighbours never bleed in. */
export function regionUv(region: Region): { u0: number; v0: number; u1: number; v1: number } {
  const inset = 0.5
  return {
    u0: (region.x + inset) / ATLAS_SIZE,
    u1: (region.x + region.w - inset) / ATLAS_SIZE,
    v0: 1 - (region.y + region.h - inset) / ATLAS_SIZE,
    v1: 1 - (region.y + inset) / ATLAS_SIZE,
  }
}

/** Maps world positions on a sheet to pixels of its region. */
export type Mapping = { x(world: number): number; y(world: number): number; scaleX: number; scaleY: number; width: number; height: number }

export function mapping(sheet: Sheet, region: Region): Mapping {
  const scaleX = region.w / (sheet.right - sheet.left)
  const scaleY = region.h / (sheet.top - sheet.bottom)
  return {
    x: (world) => (world - sheet.left) * scaleX,
    y: (world) => (sheet.top - world) * scaleY,
    scaleX,
    scaleY,
    width: region.w,
    height: region.h,
  }
}
