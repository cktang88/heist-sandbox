import { revealedRooms } from '../game/devices/devices'
import { GUNS } from '../game/guns'
import { playerShotSpread, resolveAim, shotBlock } from '../game/aiming'
import { lightLevelAt } from '../game/light'
import { MAX_FOCUS_SECONDS } from '../game/player'
import type { Room, RoomKind } from '../game/site'
import { HOTKEYS, TOOLS, toolsOnKey } from '../game/toolDefs'
import { handOf } from '../game/tools'
import { centerOf, type Vec } from '../game/types'
import type { World } from '../game/world'
import { objectiveText } from '../game/intel/intel'
import { stealthCues, type Cue } from '../game/stealth/cues'
import { stealthRating } from '../game/stealth/rating'
import { worldToScreen, type Camera } from './camera'
import { morePressesLine } from '../ui/controls'
import { drawIntel } from './intelHud'

const HELP = [
  'A/D move    W/S climb and take stairs    SPACE jump, tap again to double jump',
  'HOLD SPACE while falling: parachute    C or CTRL: crouch',
  'MOUSE aim and fire    R reload    1-0 or wheel: pick a tool',
  `Press a key again for more: ${morePressesLine()}`,
  'Q or RIGHT-CLICK: set off C4    E: pick locks, use devices, take down (crouch + hold E: choke), hide',
  'F punch    V kick    HOLD G drag furniture or grab a guard    G pick up a body    T throw    X whistle',
  'SHIFT: focus (slow motion, slowest when you hold still)',
  'Find the gold case: make guards talk, read notes, hack files. Then get to the van.',
]

/** The site's alert levels as the player reads them, from calm to locked down. */
const ALERT_LEVELS = [
  { word: 'CALM', color: '#7ee08a' },
  { word: 'UNEASE', color: '#d8d45a' },
  { word: 'SEARCHING', color: '#f0a83c' },
  { word: 'CONFIRMED', color: '#ff6a3a' },
  { word: 'LOCKDOWN', color: '#ff2d3d' },
] as const

const ROOM_LABELS: Record<RoomKind, string> = {
  lobby: 'Lobby', office: 'Office', executive: 'Executive suite', conference: 'Conference room', breakRoom: 'Break room',
  cafeteria: 'Cafeteria', kitchen: 'Kitchen', restroom: 'Restroom', lockers: 'Locker room', barracks: 'Barracks', lounge: 'Lounge',
  gym: 'Gym', infirmary: 'Infirmary', lab: 'Laboratory', server: 'Server room', security: 'Security office', armory: 'Armory',
  cells: 'Holding cells', archive: 'Archive', janitor: 'Janitor closet', mechanical: 'Plant room', electrical: 'Electrical room',
  storage: 'Storage', loadingDock: 'Loading dock', garage: 'Garage', stairwell: 'Stairwell', elevatorLobby: 'Elevator lobby',
  vault: 'Vault', penthouse: 'Penthouse', workshop: 'Workshop', silo: 'Silo', gatehouse: 'Gatehouse', sewer: 'Sewer',
  street: 'Street', yard: 'Yard', rooftop: 'Rooftop',
}

export const HUD_FONT = 'ui-monospace, "DejaVu Sans Mono", Menlo, Consolas, monospace'
const TEXT = '#d8dce4'
const DIM = '#8a93a3'

/** The HUD's base size in pixels: everything is laid out in multiples of it, so it scales with the window. */
export function hudUnit(height: number): number {
  return Math.max(11, Math.round(height / 48))
}

export function drawHud(context: CanvasRenderingContext2D, world: World, camera: Camera, aim: Vec): void {
  const { width, height } = camera
  const unit = hudUnit(height)
  drawSlowmoTint(context, world, width, height)
  drawHurt(context, world, width, height)
  const cues = stealthCues(world)
  drawVitals(context, world, unit, cues)
  drawIntel(context, world, unit, width, height, intelTop(unit, cues.length > 0))
  drawSituation(context, world, unit, width)
  drawTools(context, world, unit, width, height)
  drawCrosshair(context, world, camera, aim)
  // The DEAFENED notice (flashOverlay.ts) takes the top of the middle column while the ears ring.
  const statusTop = unit * (world.player.deafSeconds > 0 ? 2.4 : 1.6)
  if (world.drone) statusCaption(context, `DRONE  ${Math.ceil(world.drone.battery)}s`, 'click: detonate   E: recall', statusTop, '#6fd0ff', unit, width)
  if (world.charges.length > 0) statusCaption(context, `C4 SET x${world.charges.length}`, 'Q or right-click: detonate all', statusTop + (world.drone ? unit * 2.3 : 0), '#ffb347', unit, width)
  if (world.prompt && world.status === 'playing') drawPrompt(context, world.prompt, unit, width, height)
  if (world.stealth.hint && world.status === 'playing') caption(context, world.stealth.hint, width / 2, height - unit * 3.55, DIM, unit * 0.75, 'center')
  if (world.terminal && world.status === 'playing') drawTerminal(context, world.terminal, unit, width, height)
  if (world.status === 'playing' && world.clock < 9 && world.security.level === 0) drawHelp(context, unit, width, height)
  if (world.status !== 'playing') drawEndScreen(context, world, width, height, unit)
}

/** Where the Intel panel starts: under the vitals, and under the row of stealth tags when there is one. */
export function intelTop(unit: number, hasCues: boolean): number {
  return hasCues ? CUES_Y * unit + unit * 0.75 : unit * 5.6
}

const CUES_Y = 5.9

/** Health, focus and how visible the player is. */
function drawVitals(context: CanvasRenderingContext2D, world: World, unit: number, cues: readonly Cue[]): void {
  const player = world.player
  const x = unit
  const barWidth = unit * 11
  panel(context, x - unit * 0.5, unit * 0.5, barWidth + unit * 5.2, unit * 4.6)
  meter(context, x, unit, barWidth, unit * 0.8, player.hp / 100, player.hp < 30 ? '#ff4a3d' : '#e0524a', 'HP')
  meter(context, x, unit * 2.2, barWidth, unit * 0.8, player.focus / MAX_FOCUS_SECONDS, '#6fb8ff', 'FOCUS')
  const seen = visibility(world)
  const segments = 10
  const segmentWidth = barWidth / segments
  for (let index = 0; index < segments; index += 1) {
    const lit = index < Math.round(seen * segments)
    context.fillStyle = lit ? `hsl(${48 - index * 2}, ${55 + index * 4}%, ${38 + index * 4}%)` : 'rgba(255,255,255,0.08)'
    context.fillRect(x + index * segmentWidth, unit * 3.4, segmentWidth - 2, unit * 0.8)
  }
  const word = seen < 0.25 ? 'HIDDEN' : seen < 0.55 ? 'DIM' : 'EXPOSED'
  caption(context, word, x + barWidth + unit * 0.5, unit * 4.1, seen < 0.25 ? '#7ee08a' : seen < 0.55 ? '#e8d27a' : '#ffb347', unit * 0.75, 'left')
  if (player.crouching) caption(context, 'LOW', x + barWidth - unit * 0.2, unit * 3.15, DIM, unit * 0.6, 'right')
  drawCues(context, cues, x, unit * CUES_Y, unit)
}

/** Under the vitals: why the player is or is not being seen, each cue a small tag (green helps, amber gives away). */
function drawCues(context: CanvasRenderingContext2D, cues: readonly Cue[], x: number, y: number, unit: number): void {
  const size = unit * 0.62
  let left = x
  for (const cue of cues) {
    const w = measure(context, cue.text, size) + unit * 0.7
    context.fillStyle = cue.good ? 'rgba(20,60,30,0.75)' : 'rgba(80,40,10,0.8)'
    context.fillRect(left - unit * 0.1, y - size * 1.05, w, size * 1.5)
    caption(context, cue.text, left + unit * 0.25, y, cue.good ? '#9ff0a8' : '#ffc070', size, 'left')
    left += w + unit * 0.3
  }
}

let lastLight = { clock: -1, level: 0 }
/** How easy the player is to spot: the light on them, less when crouched, none shut in a hiding place. Re-read a few times a second. */
export function visibility(world: World): number {
  if (world.player.hidden) return 0
  if (Math.abs(world.clock - lastLight.clock) > 0.15) lastLight = { clock: world.clock, level: lightLevelAt(world, centerOf(world.player)) }
  return Math.max(0, Math.min(1, lastLight.level * (world.player.crouching ? 0.65 : 1)))
}

/** Site alert level, the objective and where the player is. */
function drawSituation(context: CanvasRenderingContext2D, world: World, unit: number, width: number): void {
  const level = Math.max(0, Math.min(4, world.security.level))
  const alert = ALERT_LEVELS[level]
  const right = width - unit
  // The panel may take what the vitals leave free; a long objective goes onto a second line rather than over them.
  const room = Math.max(unit * 15, width - unit * 20)
  const goals = wrapLine(objectiveLine(world), room, (text) => measure(context, text, unit * 0.85))
  const place = fit(context, locationLine(world), unit * 0.75, room)
  const textWidth = Math.max(...goals.map((line) => measure(context, line, unit * 0.85)), measure(context, place, unit * 0.75), unit * 15)
  const extra = (goals.length - 1) * unit * 1.1
  panel(context, right - textWidth - unit * 0.5, unit * 0.5, textWidth + unit, unit * 5.4 + extra)
  // Five pips, filled up to the current level; the top two pulse so a lockdown is impossible to miss.
  const pip = unit * 0.9
  const pulse = level >= 3 ? 0.6 + 0.4 * Math.sin(world.clock * 8) : 1
  for (let index = 0; index < 5; index += 1) {
    const px = right - (5 - index) * (pip + unit * 0.25)
    context.fillStyle = index <= level && level > 0 ? ALERT_LEVELS[index].color : 'rgba(255,255,255,0.12)'
    context.globalAlpha = index <= level && level > 0 ? (index === level ? pulse : 0.85) : 1
    context.fillRect(px, unit * 0.95, pip, pip * 0.55)
    context.globalAlpha = 1
  }
  caption(context, 'ALERT', right - 5 * (pip + unit * 0.25) - unit * 0.5, unit * 1.45, DIM, unit * 0.6, 'right')
  caption(context, alert.word, right, unit * 2.95, alert.color, unit * 1.25, 'right')
  goals.forEach((line, index) => caption(context, line, right, unit * (4.1 + index * 1.1), TEXT, unit * 0.85, 'right'))
  caption(context, place, right, unit * 5.25 + extra, DIM, unit * 0.75, 'right')
}

/** Splits text at spaces into at most two lines that each fit `room`; whatever still does not fit is cut. */
export function wrapLine(text: string, room: number, widthOf: (text: string) => number): string[] {
  if (widthOf(text) <= room) return [text]
  const words = text.split(' ')
  const cut = (line: string) => {
    let short = line
    while (short.length > 1 && widthOf(short) > room) short = short.slice(0, -1)
    return short
  }
  if (words.length < 2) return [cut(text)]
  let split = words.length - 1
  while (split > 1 && widthOf(words.slice(0, split).join(' ')) > room) split -= 1
  return [cut(words.slice(0, split).join(' ')), cut(words.slice(split).join(' '))]
}

let lastRoom: Room | null = null
function roomAt(world: World, at: Vec): Room | null {
  const inside = (room: Room) => at.x >= room.x && at.x < room.x + room.w && at.y >= room.y && at.y < room.y + room.h
  if (lastRoom && world.rooms.includes(lastRoom) && inside(lastRoom)) return lastRoom
  lastRoom = world.rooms.find(inside) ?? null
  return lastRoom
}

function storeyName(storey: number): string {
  return storey < 0 ? `BASEMENT ${-storey}` : storey === 0 ? 'GROUND FLOOR' : `FLOOR ${storey}`
}

function locationLine(world: World): string {
  const room = roomAt(world, centerOf(world.player))
  if (!room) return world.player.y > world.groundY ? 'UNDERGROUND' : 'OUTSIDE'
  return `${room.building.toUpperCase()}  ·  ${storeyName(room.storey)}  ·  ${ROOM_LABELS[room.kind].toUpperCase()}`
}

/** The objective, naming where the vault is once a terminal has shown it. */
export function objectiveLine(world: World): string {
  const goal = objectiveText(world)
  if (world.player.hasLoot) return goal
  const revealed = revealedRooms(world)
  const vault = revealed.size > 0 ? world.rooms.find((room) => room.kind === 'vault' && revealed.has(room.id)) : undefined
  // The case may not be in the vault, so a terminal's map only adds where the vault is.
  return vault ? `${goal} (vault: ${vault.building}, ${storeyName(vault.storey).toLowerCase()})` : goal
}

/** The action available right now, near the bottom centre, with its key picked out. */
function drawPrompt(context: CanvasRenderingContext2D, prompt: string, unit: number, width: number, height: number): void {
  const split = prompt.indexOf(':')
  const key = split > 0 && split <= 6 ? prompt.slice(0, split).trim() : ''
  const rest = key ? prompt.slice(split + 1).trim() : prompt
  const size = unit * 1.05
  const keyWidth = key ? measure(context, key, size) + unit * 0.9 : 0
  const total = keyWidth + (key ? unit * 0.6 : 0) + measure(context, rest, size)
  const x = width / 2 - total / 2
  const y = height - unit * 5.2
  panel(context, x - unit * 0.7, y - size * 1.05, total + unit * 1.4, size * 1.6)
  if (key) {
    context.strokeStyle = '#ffd27a'
    context.lineWidth = 1.5
    context.strokeRect(x, y - size * 0.85, keyWidth, size * 1.15)
    caption(context, key, x + keyWidth / 2, y, '#ffd27a', size, 'center')
  }
  caption(context, rest, x + keyWidth + (key ? unit * 0.6 : 0), y, '#ffffff', size, 'left')
}

/** The hacking menu: a terminal-style panel with the device's title and numbered options. */
function drawTerminal(context: CanvasRenderingContext2D, terminal: NonNullable<World['terminal']>, unit: number, width: number, height: number): void {
  const size = unit * 0.9
  const longest = Math.max(measure(context, terminal.title, size * 1.1), ...terminal.options.map((option) => measure(context, `00  ${option}`, size)))
  const w = Math.min(width - unit * 2, Math.max(unit * 18, longest + unit * 3))
  const h = unit * (4.4 + terminal.options.length * 1.6)
  const x = width / 2 - w / 2
  const y = Math.max(unit * 6.5, height * 0.42 - h / 2)
  context.fillStyle = 'rgba(8,12,10,0.86)'
  context.fillRect(x, y, w, h)
  context.strokeStyle = 'rgba(255,190,90,0.55)'
  context.lineWidth = 1.5
  context.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  context.fillStyle = 'rgba(255,170,60,0.16)'
  context.fillRect(x, y, w, unit * 1.9)
  caption(context, terminal.title.toUpperCase(), x + unit, y + unit * 1.3, '#ffd28a', size * 1.1, 'left')
  terminal.options.forEach((option, index) => {
    const rowY = y + unit * (3.3 + index * 1.6)
    const key = optionKey(index)
    if (key) {
      context.strokeStyle = 'rgba(255,190,90,0.45)'
      context.strokeRect(x + unit, rowY - size * 0.95, size * 1.5, size * 1.3)
      caption(context, key, x + unit + size * 0.75, rowY, '#ffd28a', size, 'center')
    }
    caption(context, option, x + unit + size * 2.2, rowY, key ? '#f0e6d0' : DIM, size, 'left')
  })
  caption(context, 'NUMBER KEYS: CHOOSE    E OR WALK AWAY: CLOSE', x + w / 2, y + h - unit * 0.6, DIM, unit * 0.62, 'center')
}

/**
 * The key that picks a terminal option: 1-9, then 0 for the tenth (the number keys are read as 1-9 then 0).
 * Options past the tenth have no key, so they are shown dim and unnumbered rather than with a number that does nothing.
 */
export function optionKey(index: number): string | null {
  return index < 10 ? String((index + 1) % 10) : null
}

/** The ring widens as sustained fire makes the gun less accurate, so spread is never a surprise. */
function drawCrosshair(context: CanvasRenderingContext2D, world: World, camera: Camera, aim: Vec): void {
  const at = worldToScreen(camera, aim)
  const hand = handOf(world)
  const gun = GUNS[TOOLS[world.player.tool].id]
  const target = gun ? resolveAim(world, hand, aim) : { point: aim, guard: null }
  const spread = gun ? playerShotSpread(gun, world.player.bloom, Math.hypot(target.point.x - hand.x, target.point.y - hand.y)) : 0
  const reach = Math.hypot(aim.x - hand.x, aim.y - hand.y) * camera.scale
  const radius = Math.max(camera.height / 110, Math.tan(spread) * reach)
  const tick = camera.height / 90
  context.strokeStyle = target.guard ? '#7ee08a' : 'rgba(255,255,255,0.9)'
  context.lineWidth = Math.max(1.5, camera.height / 500)
  context.beginPath()
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    context.moveTo(at.x + dx * radius, at.y + dy * radius)
    context.lineTo(at.x + dx * (radius + tick), at.y + dy * (radius + tick))
  }
  context.stroke()
  context.fillStyle = '#ff2d3d'
  context.fillRect(at.x - 1.5, at.y - 1.5, 3, 3)
  if (gun) {
    const block = shotBlock(world, hand, target.point)
    if (block && Math.hypot(block.x - target.point.x, block.y - target.point.y) > 1) {
      const stop = worldToScreen(camera, block)
      context.strokeStyle = '#ffb347'
      context.beginPath()
      context.moveTo(stop.x - tick, stop.y - tick); context.lineTo(stop.x + tick, stop.y + tick)
      context.moveTo(stop.x - tick, stop.y + tick); context.lineTo(stop.x + tick, stop.y - tick)
      context.stroke()
    }
  }
  if (gun && world.player.reload > 0) {
    // Reload progress sweeps round the crosshair.
    context.strokeStyle = '#39ff6a'
    context.beginPath()
    context.arc(at.x, at.y, radius + tick * 1.6, -Math.PI / 2, -Math.PI / 2 + (1 - world.player.reload / gun.reloadSeconds) * Math.PI * 2)
    context.stroke()
  }
}

/**
 * A slot along the bottom for each key with a carried tool (ten with the full kit). On a narrow screen the slots
 * shrink and names are cut short, but ammo always shows.
 */
function drawTools(context: CanvasRenderingContext2D, world: World, unit: number, width: number, height: number): void {
  const carried = world.player.carried
  const keys = Array.from({ length: HOTKEYS }, (_, key) => key).filter((key) => toolsOnKey(key, carried).length > 0)
  const gap = Math.max(2, unit * 0.2)
  const slot = Math.min(unit * 8.5, (width - unit * 2) / HOTKEYS)
  const left = width / 2 - (slot * keys.length) / 2
  const h = unit * 2.7
  const y = height - h - unit * 0.6
  const size = Math.min(unit * 0.78, slot / 6.5)
  // One box per key. A key with several tools shows the one in hand (or its first) and how many it cycles through.
  keys.forEach((key, place) => {
    const onKey = toolsOnKey(key, carried)
    const held = onKey.indexOf(world.player.tool)
    const index = held < 0 ? onKey[0] : world.player.tool
    const tool = TOOLS[index]
    const x = left + place * slot
    const w = slot - gap
    const selected = held >= 0
    context.fillStyle = selected ? 'rgba(255,255,255,0.2)' : 'rgba(6,8,12,0.6)'
    context.fillRect(x, y, w, h)
    if (selected) {
      context.strokeStyle = 'rgba(255,255,255,0.75)'
      context.lineWidth = 1.5
      context.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5)
    }
    context.fillStyle = tool.quiet ? '#7ee08a' : '#ff7a5a'
    context.fillRect(x, y + h - unit * 0.18, w, unit * 0.18)
    const label = String((key + 1) % 10)
    caption(context, label, x + unit * 0.35, y + size * 1.25, selected ? '#ffd27a' : DIM, size * 0.85, 'left')
    const nameLeft = x + unit * 0.35 + measure(context, label, size * 0.85) + unit * 0.35
    caption(context, fit(context, tool.name.toUpperCase(), size, x + w - unit * 0.3 - nameLeft), nameLeft, y + size * 1.25, selected ? '#ffffff' : '#b4bcc8', size, 'left')
    const ammo = world.player.ammo[index]
    const gun = GUNS[tool.id] && !tool.action
    const count = gun ? `${world.player.mags[index]} / ${ammo}` : Number.isFinite(ammo) ? `${ammo}` : '∞'
    const empty = gun ? world.player.mags[index] === 0 : ammo === 0
    // Which of the key's tools this is ("1/2"), when it fits beside the ammo: on a narrow window the ammo wins.
    const page = `${Math.max(0, held) + 1}/${onKey.length}`
    const pageFits = measure(context, page, size * 0.8) + measure(context, count, size) + unit * 1.1 <= w
    if (onKey.length > 1 && pageFits) caption(context, page, x + unit * 0.35, y + h - unit * 0.55, selected ? '#ffd27a' : DIM, size * 0.8, 'left')
    caption(context, count, x + w - unit * 0.35, y + h - unit * 0.55, empty ? '#ff6a5a' : selected ? '#ffffff' : DIM, size, 'right')
  })
}

/**
 * A drone or C4 status between the vitals and the alert panel: its name, and under it in smaller type the keys.
 * Two short lines rather than one long one, so it fits between the corner panels on a narrow window too.
 */
function statusCaption(context: CanvasRenderingContext2D, title: string, keys: string, top: number, colour: string, unit: number, width: number): void {
  const w = Math.max(measure(context, title, unit * 0.95), measure(context, keys, unit * 0.68)) + unit
  panel(context, width / 2 - w / 2, top, w, unit * 2.05)
  caption(context, title, width / 2, top + unit * 0.95, colour, unit * 0.95, 'center')
  caption(context, keys, width / 2, top + unit * 1.75, TEXT, unit * 0.68, 'center')
}

/** The first seconds' key list, low in the middle: clear of the player, who starts at the centre falling from the plane. */
function drawHelp(context: CanvasRenderingContext2D, unit: number, width: number, height: number): void {
  const size = Math.min(unit, (width - unit * 4) / 62)
  const w = Math.min(width - unit * 2, size * 50)
  const h = size * (HELP.length * 1.5 + 1.2)
  const top = helpTop(unit, height, h)
  panel(context, width / 2 - w / 2, top, w, h)
  HELP.forEach((line, index) => caption(context, line, width / 2, top + size * 1.8 + index * size * 1.5, 'rgba(255,255,255,0.88)', size * 0.82, 'center'))
}

/** Where the help panel starts: its bottom sits above the action prompt, and it never rises into the screen's middle. */
export function helpTop(unit: number, height: number, panelHeight: number): number {
  return Math.max(height * 0.56, height - unit * 6.6 - panelHeight)
}

function drawEndScreen(context: CanvasRenderingContext2D, world: World, width: number, height: number, unit: number): void {
  context.fillStyle = 'rgba(5,6,10,0.78)'
  context.fillRect(0, 0, width, height)
  const won = world.status === 'won'
  const colour = won ? '#7ee08a' : '#ff5a4a'
  context.fillStyle = colour
  context.fillRect(width / 2 - unit * 10, height * 0.36 - unit * 3.4, unit * 20, 2)
  caption(context, won ? 'CLEAN GETAWAY' : 'OPERATIVE DOWN', width / 2, height * 0.36, colour, unit * 3, 'center')
  const peak = ALERT_LEVELS[Math.max(0, Math.min(4, world.security.level))].word
  const rating = stealthRating(world)
  const stats = world.stats
  const lines = [
    won ? `${rating.name}: ${rating.line}` : 'The heist is over.',
    `TIME ${clockText(world.clock)}    KILLS ${stats.kills}    KNOCKOUTS ${stats.knockouts}    TILES DESTROYED ${stats.tilesDestroyed}`,
    `TIMES SPOTTED ${stats.timesSpotted}    BODIES FOUND ${stats.bodiesFound}    ALARMS ${stats.alarms}    ALERT AT THE END ${peak}`,
  ]
  lines.forEach((line, index) => caption(context, line, width / 2, height * 0.47 + index * unit * 1.9, TEXT, Math.min(unit * 1.05, width / 52), 'center'))
  caption(context, 'PRESS ENTER FOR A NEW HEIST', width / 2, height * 0.47 + unit * 7, '#ffd27a', unit, 'center')
}

/** Minutes and seconds, as the debrief writes the time: 734.2 seconds is "12:14". */
export function clockText(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** The red at the screen's edges after a hit: how hard it was, and when. */
export type Hurt = { hp: number; at: number; strength: number }
const HURT_SECONDS = 0.6
const hurts = new WeakMap<World, Hurt>()

/**
 * Follows the player's health from frame to frame: a drop starts a red flash scaled by the damage, which fades over
 * `HURT_SECONDS` of game time. Healing only moves the baseline.
 */
export function nextHurt(last: Hurt | undefined, hp: number, clock: number): Hurt {
  if (!last || hp >= last.hp - 0.5) return { hp, at: last?.at ?? -Infinity, strength: last?.strength ?? 0 }
  return { hp, at: clock, strength: Math.min(1, 0.35 + (last.hp - hp) / 40) }
}

export function hurtAlpha(hurt: Hurt, clock: number): number {
  const age = clock - hurt.at
  return age < 0 || age > HURT_SECONDS ? 0 : hurt.strength * (1 - age / HURT_SECONDS)
}

/** Without this a hit only showed as a shorter HP bar: easy to miss in a firefight. */
function drawHurt(context: CanvasRenderingContext2D, world: World, width: number, height: number): void {
  const hurt = nextHurt(hurts.get(world), world.player.hp, world.clock)
  hurts.set(world, hurt)
  const alpha = hurtAlpha(hurt, world.clock)
  if (alpha <= 0.01) return
  const edge = context.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, height * 0.85)
  edge.addColorStop(0, 'rgba(200,20,20,0)')
  edge.addColorStop(1, `rgba(200,20,20,${(alpha * 0.6).toFixed(3)})`)
  context.fillStyle = edge
  context.fillRect(0, 0, width, height)
}

function drawSlowmoTint(context: CanvasRenderingContext2D, world: World, width: number, height: number): void {
  const slow = 1 - world.time.scale
  if (slow < 0.05) return
  const tint = context.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height * 0.9)
  tint.addColorStop(0, 'rgba(90,160,255,0)')
  tint.addColorStop(1, `rgba(90,160,255,${slow * 0.45})`)
  context.fillStyle = tint
  context.fillRect(0, 0, width, height)
}

function meter(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, amount: number, color: string, name: string): void {
  context.fillStyle = 'rgba(255,255,255,0.08)'
  context.fillRect(x, y, w, h)
  context.fillStyle = color
  context.fillRect(x, y, w * Math.max(0, Math.min(1, amount)), h)
  caption(context, name, x + w + h * 0.6, y + h * 0.85, TEXT, h * 0.95, 'left')
}

/** A soft dark backing so text reads over both bright and dark scenes. */
export function panel(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  // Dark enough for the dim grey lines to read over the pale skies of the pixel and sketch looks.
  context.fillStyle = 'rgba(6,8,12,0.7)'
  context.fillRect(x, y, w, h)
  context.fillStyle = 'rgba(255,255,255,0.07)'
  context.fillRect(x, y, w, 1)
}

function font(size: number): string {
  return `bold ${Math.round(size)}px ${HUD_FONT}`
}

export function caption(context: CanvasRenderingContext2D, value: string, x: number, y: number, color: string, size: number, align: CanvasTextAlign): void {
  context.font = font(size)
  context.textAlign = align
  context.fillStyle = color
  context.fillText(value, x, y)
}

const widths = new Map<string, number>()
/** Text width, remembered: the HUD redraws the same strings every frame, so each is measured once. */
export function measure(context: CanvasRenderingContext2D, value: string, size: number): number {
  const key = `${Math.round(size)}|${value}`
  let known = widths.get(key)
  if (known === undefined) {
    if (widths.size > 800) widths.clear()
    context.font = font(size)
    known = context.measureText(value).width
    widths.set(key, known)
  }
  return known
}

/** Cuts text short so it fits in `room` pixels. */
export function fit(context: CanvasRenderingContext2D, value: string, size: number, room: number): string {
  let cut = value
  while (cut.length > 1 && measure(context, cut, size) > room) cut = cut.slice(0, -1)
  return cut
}
