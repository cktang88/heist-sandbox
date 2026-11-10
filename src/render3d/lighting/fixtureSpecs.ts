import type { FixtureKind } from '../../game/site'

/**
 * How each kind of fitting gives off light. Positions are in 3D units relative to the lamp's point
 * (x right, y up), and `z` is the depth of its bulb: ceiling fittings hang mid-room, table lamps stand on the
 * furniture against the wall, sconces and signs are on the back wall, street lights reach over the lane.
 */
export type FixtureSpec = {
  /** Ceiling and outdoor fittings throw a downward cone (and may cast shadows); small lamps glow all round. */
  light: 'spot' | 'point'
  z: number
  /** Where the real light sits, relative to the lamp point. */
  lightY: number
  /** Spot only: half-angle of the cone, softness of its edge, and where it aims relative to the lamp. */
  angle: number
  penumbra: number
  aimY: number
  aimZ: number
  /** Real light output for a lamp of strength 1 (candela-like, as three.js uses). */
  intensity: number
  /** Reach of the real light, as a multiple of the lamp's radius, and the most it may reach in tiles. */
  reach: number
  maxReach: number
  /** Brightness of the glowing parts of the fitting when lit, as a multiple of the lamp colour. Above about 1.4 blooms. */
  glow: number
  /**
   * The soft fake pool painted on the wall behind the fitting: strength, width and height (tiles), and how far
   * below the lamp it is brightest. A ceiling fitting's pool is brightest at the ceiling and cut off by it, so it
   * reads as the scallop a real fitting throws on the wall.
   */
  wash: number
  washSize: number
  washTall: number
  washDrop: number
  /** A small haze around the bulb itself. */
  glare: number
  glareSize: number
  /** Whether a visible beam of light hangs under it (dusty air). */
  beam: number
}

/** In alarm, a red emergency beacon's pool on the wall grows by this much. */
export const ALARM_WASH_GROW = 2

const CEILING_Z = -0.9
const FURNITURE_Z = -1.4
const WALL_Z = -2.28

const ceiling: Omit<FixtureSpec, 'angle' | 'penumbra' | 'intensity' | 'glow' | 'wash' | 'beam'> = {
  light: 'spot', z: CEILING_Z, lightY: -0.12, aimY: -6, aimZ: -1.7, reach: 1, maxReach: 11,
  washSize: 6, washTall: 3.4, washDrop: 0, glare: 0.35, glareSize: 1.2,
}

const small: Omit<FixtureSpec, 'z' | 'intensity' | 'glow' | 'wash' | 'washSize' | 'washTall' | 'washDrop' | 'glare' | 'glareSize'> = {
  light: 'point', lightY: 0, angle: 0, penumbra: 0, aimY: 0, aimZ: 0, reach: 1, maxReach: 7, beam: 0,
}

export const FIXTURE_SPECS: Record<FixtureKind, FixtureSpec> = {
  ceilingPanel: { ...ceiling, angle: 1.2, penumbra: 0.9, intensity: 9, glow: 3.2, wash: 0.22, beam: 0.6 },
  fluorescentTube: { ...ceiling, angle: 1.3, penumbra: 1, intensity: 8, glow: 5, wash: 0.25, washSize: 7, beam: 0.5, glare: 0.45 },
  downlight: { ...ceiling, angle: 0.65, penumbra: 0.55, intensity: 13, glow: 5, wash: 0.22, washSize: 3, washTall: 3.6, beam: 0.7 },
  pendant: { ...small, z: CEILING_Z, lightY: -0.12, intensity: 6, glow: 6, wash: 0.3, washSize: 4.5, washTall: 2.6, washDrop: 0.3, glare: 0.4, glareSize: 1 },
  chandelier: { ...small, z: CEILING_Z, lightY: -0.1, intensity: 8, glow: 7, wash: 0.35, washSize: 6, washTall: 3, washDrop: 0.2, glare: 0.6, glareSize: 2 },
  bareBulb: { ...small, z: CEILING_Z, intensity: 5, glow: 9, wash: 0.3, washSize: 4.5, washTall: 3, washDrop: 0.3, glare: 0.6, glareSize: 1.1 },
  tableLamp: { ...small, z: FURNITURE_Z, intensity: 3.2, maxReach: 5, glow: 2.4, wash: 0.4, washSize: 3.2, washTall: 2.4, washDrop: 0.1, glare: 0.25, glareSize: 0.8 },
  deskLamp: { ...small, z: FURNITURE_Z, lightY: -0.12, intensity: 2.6, maxReach: 4, glow: 6, wash: 0.3, washSize: 2.4, washTall: 1.4, washDrop: 0.4, glare: 0.25, glareSize: 0.6 },
  floorLamp: { ...small, z: -1.6, intensity: 4, maxReach: 6, glow: 2.4, wash: 0.4, washSize: 4, washTall: 3, washDrop: 0, glare: 0.25, glareSize: 1 },
  wallSconce: { ...small, z: WALL_Z, intensity: 3, maxReach: 5, glow: 3.5, wash: 0.55, washSize: 2.6, washTall: 2.6, washDrop: -0.3, glare: 0.3, glareSize: 0.8 },
  neon: { ...small, z: WALL_Z, intensity: 2.6, maxReach: 5, glow: 9, wash: 0.45, washSize: 3.8, washTall: 2.2, washDrop: 0, glare: 0.35, glareSize: 2.2 },
  emergency: { ...small, z: WALL_Z, intensity: 2.2, maxReach: 5, glow: 6, wash: 0.35, washSize: 2.2, washTall: 1.6, washDrop: 0.1, glare: 0.35, glareSize: 0.9 },
  streetLight: { ...ceiling, z: -0.35, lightY: -0.15, angle: 0.95, penumbra: 0.75, aimY: -6, aimZ: -0.2, intensity: 7, maxReach: 16, glow: 6, wash: 0.15, washSize: 7, washTall: 6, washDrop: 0.5, glare: 0.5, glareSize: 2.4, beam: 0.9 },
  floodlight: { ...ceiling, z: -0.8, lightY: -0.1, angle: 0.62, penumbra: 0.5, aimY: -8, aimZ: 2.5, intensity: 9, maxReach: 22, glow: 8, wash: 0.12, washSize: 5, washTall: 5, washDrop: 1, glare: 0.7, glareSize: 2.8, beam: 1 },
  workLight: { ...ceiling, z: -1.1, lightY: 0, angle: 0.7, penumbra: 0.6, aimY: -2.5, aimZ: 1.5, intensity: 8, maxReach: 9, glow: 7, wash: 0.25, washSize: 4, washTall: 3, washDrop: 0.4, glare: 0.5, glareSize: 1.4, beam: 0.5 },
}
