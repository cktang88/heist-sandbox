import { describeFilter, searchArea, talkersLeft, type Clue, type SearchArea } from '../game/intel/intel'
import type { World } from '../game/world'
import { caption, measure, panel } from './drawHud'

/**
 * What the player has learned about where the case is: the Intel log (a HUD panel under the vitals)
 * and the search area (a highlighted region of the building, drawn over the 3D view in tile units).
 */

const SHOWN_CLUES = 5
const COLOURS = { title: '#f0c060', open: '#f0c060', confirmed: '#7ee08a', stale: '#6b7280', moved: '#ff6a3a', hint: '#8a93a3' }
const AREA = { fill: 'rgba(255,190,60,0.07)', edge: 'rgba(255,190,60,0.55)', room: 'rgba(255,214,110,0.85)' }
const HINTS = ['No intel yet. Make someone talk:', 'a guard with his hands up, held or tied.', 'Read notes, hack computers, eavesdrop.']

type Line = { text: string; colour: string; size: number }

/** The Intel panel, top left under the health and focus bars. */
export function drawIntel(context: CanvasRenderingContext2D, world: World, unit: number, width: number, height: number, top: number): void {
  if (world.intel.places.length < 2 || world.player.hasLoot || world.status !== 'playing') return
  const lines = panelLines(world, unit)
  const x = unit
  const lineHeight = unit * 1.15
  const textWidth = Math.min(width * 0.4, Math.max(...lines.map((line) => measure(context, line.text, line.size))))
  if (top + lines.length * lineHeight > height * 0.6) lines.length = Math.max(1, Math.floor((height * 0.6 - top) / lineHeight))
  panel(context, x - unit * 0.5, top, textWidth + unit, lines.length * lineHeight + unit * 0.6)
  lines.forEach((line, index) => caption(context, line.text, x, top + unit * 1.05 + index * lineHeight, line.colour, line.size, 'left'))
}

function panelLines(world: World, unit: number): Line[] {
  const small = unit * 0.7
  const lines: Line[] = [{ text: `INTEL   ${talkersLeft(world)} alive who might talk`, colour: COLOURS.title, size: unit * 0.75 }]
  if (world.intel.move.moves > 0) lines.push({ text: 'They moved the case. Old intel is stale.', colour: COLOURS.moved, size: small })
  const clues = world.intel.clues.slice(-SHOWN_CLUES).reverse()
  if (clues.length === 0) return [...lines, ...HINTS.map((text) => ({ text, colour: COLOURS.hint, size: small }))]
  return [...lines, ...clues.map((clue) => ({ text: clueLine(clue), colour: colourOf(clue), size: small }))]
}

function clueLine(clue: Clue): string {
  const tag = clue.stale ? '  [STALE]' : clue.confirmed ? '  [CONFIRMED]' : ''
  return `${describeFilter(clue.filter)}  (${clue.origin})${tag}`
}

function colourOf(clue: Clue): string {
  if (clue.stale) return COLOURS.stale
  return clue.confirmed ? COLOURS.confirmed : COLOURS.open
}

/**
 * The search area, drawn in tile units under the other markers: a faint band over the part of the building
 * the clues point to, and the rooms of the named kind outlined inside it.
 */
export function drawSearchArea(context: CanvasRenderingContext2D, world: World): SearchArea | null {
  if (world.player.hasLoot) return null
  const area = searchArea(world)
  if (!area?.region) return area
  const { x, y, w, h } = area.region
  context.fillStyle = AREA.fill
  context.fillRect(x, y, w, h)
  context.strokeStyle = AREA.edge
  context.lineWidth = 0.12
  context.setLineDash([0.6, 0.4])
  context.strokeRect(x, y, w, h)
  context.setLineDash([])
  context.strokeStyle = AREA.room
  context.lineWidth = 0.16
  for (const room of area.rooms) context.strokeRect(room.x, room.y, room.w, room.h)
  return area
}
