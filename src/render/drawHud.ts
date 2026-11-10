import { GUNS } from '../game/guns'
import { MAX_FOCUS_SECONDS } from '../game/player'
import { TOOLS } from '../game/toolDefs'
import { handOf } from '../game/tools'
import type { Vec } from '../game/types'
import type { World } from '../game/world'
import { worldToScreen, type Camera } from './camera'

const HELP = [
  'A/D move    W/S climb    SPACE jump, tap again to double jump',
  'HOLD SPACE while falling: parachute',
  'MOUSE aim and fire    R reload    1-8 or wheel: pick a tool    Q: set off C4',
  'E: pick locks, take down unaware guards, recall the drone',
  'SHIFT: focus (slow motion, slowest when you hold still)',
  'Steal the gold case from the vault and get back to the van.',
]

export function drawHud(context: CanvasRenderingContext2D, world: World, camera: Camera, aim: Vec): void {
  const { width, height } = camera
  const unit = Math.max(12, Math.round(height / 45))
  drawSlowmoTint(context, world, width, height)

  bar(context, unit, unit, unit * 12, unit * 0.9, world.player.hp / 100, '#e0524a', 'HP')
  bar(context, unit, unit * 2.3, unit * 12, unit * 0.9, world.player.focus / MAX_FOCUS_SECONDS, '#6fb8ff', 'FOCUS')

  const anyAlert = world.guards.some((guard) => guard.state === 'alert')
  const anySuspicious = world.guards.some((guard) => guard.state === 'suspicious')
  const [status, color] = world.alarm ? ['ALARM', '#ff5a4a'] : anyAlert ? ['SPOTTED', '#ff9a4a'] : anySuspicious ? ['SUSPICIOUS', '#f0c83c'] : ['HIDDEN', '#7ee08a']
  text(context, status, width - unit, unit * 1.8, color, unit * 1.4, 'right')
  const goal = world.player.hasLoot ? 'Get back to the van' : 'Steal the gold case from the vault'
  text(context, goal, width - unit, unit * 3.4, '#d8dce4', unit, 'right')

  drawTools(context, world, unit, width, height)
  drawCrosshair(context, world, camera, aim)
  if (world.drone) text(context, `DRONE  ${Math.ceil(world.drone.battery)}s   click: detonate   E: recall`, width / 2, unit * 2, '#6fd0ff', unit, 'center')
  if (world.status === 'playing' && world.clock < 9 && !world.alarm) {
    context.fillStyle = 'rgba(5,6,10,0.55)'
    context.fillRect(width / 2 - unit * 21, height * 0.28 - unit * 1.6, unit * 42, unit * 9.9)
    HELP.forEach((line, index) => text(context, line, width / 2, height * 0.28 + index * unit * 1.5, 'rgba(255,255,255,0.85)', unit, 'center'))
  }
  if (world.status !== 'playing') drawEndScreen(context, world, width, height, unit)
}

/** The ring widens as sustained fire makes the gun less accurate, so spread is never a surprise. */
function drawCrosshair(context: CanvasRenderingContext2D, world: World, camera: Camera, aim: Vec): void {
  const at = worldToScreen(camera, aim)
  const hand = handOf(world)
  const gun = GUNS[TOOLS[world.player.tool].id]
  const spread = gun ? gun.shot.spread + world.player.bloom : 0
  const reach = Math.hypot(aim.x - hand.x, aim.y - hand.y) * camera.scale
  const radius = Math.max(camera.height / 110, Math.tan(spread) * reach)
  const tick = camera.height / 90
  context.strokeStyle = 'rgba(255,255,255,0.9)'
  context.lineWidth = Math.max(1.5, camera.height / 500)
  context.beginPath()
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    context.moveTo(at.x + dx * radius, at.y + dy * radius)
    context.lineTo(at.x + dx * (radius + tick), at.y + dy * (radius + tick))
  }
  context.stroke()
  context.fillStyle = '#ff2d3d'
  context.fillRect(at.x - 1.5, at.y - 1.5, 3, 3)
  if (gun && world.player.reload > 0) {
    // Reload progress sweeps round the crosshair.
    context.strokeStyle = '#39ff6a'
    context.beginPath()
    context.arc(at.x, at.y, radius + tick * 1.6, -Math.PI / 2, -Math.PI / 2 + (1 - world.player.reload / gun.reloadSeconds) * Math.PI * 2)
    context.stroke()
  }
}

function drawTools(context: CanvasRenderingContext2D, world: World, unit: number, width: number, height: number): void {
  const slot = Math.min(unit * 8, (width - unit * 2) / TOOLS.length)
  TOOLS.forEach((tool, index) => {
    const x = unit + index * slot
    const y = height - unit * 2.6
    const selected = index === world.player.tool
    context.fillStyle = selected ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.45)'
    context.fillRect(x, y, slot - unit * 0.3, unit * 2)
    const ammo = world.player.ammo[index]
    const count = GUNS[tool.id] ? ` ${world.player.mags[index]}/${ammo}` : Number.isFinite(ammo) ? ` ${ammo}` : ''
    text(context, `${index + 1} ${tool.name}${count}`, x + unit * 0.4, y + unit * 1.3, selected ? '#ffffff' : '#9aa2b0', unit * 0.8, 'left')
    context.fillStyle = tool.quiet ? '#7ee08a' : '#ff7a5a'
    context.fillRect(x, y + unit * 1.85, slot - unit * 0.3, unit * 0.15)
  })
}

function drawEndScreen(context: CanvasRenderingContext2D, world: World, width: number, height: number, unit: number): void {
  context.fillStyle = 'rgba(5,6,10,0.72)'
  context.fillRect(0, 0, width, height)
  const won = world.status === 'won'
  text(context, won ? 'CLEAN GETAWAY' : 'CAUGHT', width / 2, height * 0.36, won ? '#7ee08a' : '#ff5a4a', unit * 3.2, 'center')
  const style = !world.alarm && world.stats.kills === 0 ? 'Ghost: never seen, nobody hurt' : !world.alarm ? 'Quiet: the alarm never rang' : 'Loud: the whole block heard you'
  const lines = [
    won ? style : 'The heist is over.',
    `Time ${world.clock.toFixed(1)}s    Guards down ${world.stats.kills}    Tiles destroyed ${world.stats.tilesDestroyed}    Times spotted ${world.stats.timesSpotted}`,
    'Press ENTER for a new heist',
  ]
  lines.forEach((line, index) => text(context, line, width / 2, height * 0.46 + index * unit * 2, '#d8dce4', unit * 1.1, 'center'))
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

function bar(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, amount: number, color: string, name: string): void {
  context.fillStyle = 'rgba(0,0,0,0.5)'
  context.fillRect(x, y, w, h)
  context.fillStyle = color
  context.fillRect(x, y, w * Math.max(0, Math.min(1, amount)), h)
  text(context, name, x + w + h * 0.5, y + h * 0.85, '#d8dce4', h, 'left')
}

function text(context: CanvasRenderingContext2D, value: string, x: number, y: number, color: string, size: number, align: CanvasTextAlign): void {
  context.font = `bold ${Math.round(size)}px ui-monospace, monospace`
  context.textAlign = align
  context.fillStyle = color
  context.fillText(value, x, y)
}
