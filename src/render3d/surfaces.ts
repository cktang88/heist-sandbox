import { fractalNoise } from './noise'

/** One point of a surface: its colour (0..1 each), how raised it is, how rough, and how metallic. */
export type SurfacePoint = { r: number; g: number; b: number; height: number; rough: number; metal: number }
export type Surface = (u: number, v: number) => SurfacePoint

const point = (rgb: number[], height: number, rough: number, metal = 0): SurfacePoint => ({ r: rgb[0], g: rgb[1], b: rgb[2], height, rough, metal })

/** Dark fractured rock at the bottom of the map. */
export const rock: Surface = (u, v) => {
  const big = fractalNoise(u, v, 5, 71)
  const fine = fractalNoise(u, v, 30, 72, 3)
  const shade = 0.1 + big * 0.1 + fine * 0.05
  return point([shade, shade * 1.03, shade * 1.1], big * 0.7 + fine * 0.3, 0.9)
}
