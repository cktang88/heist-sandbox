import { dropPointAt } from '../game/insertion'
import type { World } from '../game/world'
import { h, keyCaps } from './dom'
import './dropPlan.css'

function svgNode<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value))
  if (text) node.textContent = text
  return node
}

/** A schematic of this seed's real compound, with a selectable roof or ground entry. No live intel is revealed. */
export function dropPlan(world: World, launch: (x: number) => void): HTMLElement {
  const width = world.grid.width
  const rooms = world.interiors.filter((area) => area.kind === 'room')
  const top = Math.max(0, Math.min(world.groundY - 20, ...rooms.map((room) => room.y)) - 14)
  const bottom = Math.min(world.grid.height, Math.max(world.groundY + 12, ...rooms.map((room) => room.y + room.h)) + 3)
  const svg = svgNode('svg', { viewBox: `0 ${top} ${width} ${bottom - top}`, role: 'img', 'aria-label': 'Compound blueprint. Use the drop position slider or click the map to choose an entry.' })
  svg.append(svgNode('rect', { x: 0, y: top, width, height: bottom - top, fill: '#071e2a' }))
  for (let x = 0; x < width; x += 10) svg.append(svgNode('line', { x1: x, y1: top, x2: x, y2: bottom, class: 'sg-plan-grid' }))
  for (let y = Math.ceil(top / 10) * 10; y < bottom; y += 10) svg.append(svgNode('line', { x1: 0, y1: y, x2: width, y2: y, class: 'sg-plan-grid' }))
  svg.append(svgNode('line', { x1: 0, y1: world.groundY, x2: width, y2: world.groundY, class: 'sg-plan-ground' }))
  for (const room of rooms) svg.append(svgNode('rect', { x: room.x, y: room.y, width: room.w, height: room.h, class: 'sg-plan-room' }))
  const buildings = new Map<string, { left: number; right: number; roof: number }>()
  for (const room of world.rooms) {
    if (['grounds', 'sewer'].includes(room.building)) continue
    const bounds = buildings.get(room.building)
    buildings.set(room.building, { left: Math.min(bounds?.left ?? width, room.x), right: Math.max(bounds?.right ?? 0, room.x + room.w), roof: Math.min(bounds?.roof ?? world.groundY, room.y) })
  }
  for (const [name, bounds] of buildings) svg.append(svgNode('text', { x: (bounds.left + bounds.right) / 2, y: bounds.roof - 3, class: 'sg-plan-label', 'font-size': Math.max(2.5, width / 100) }, name.toUpperCase()))
  const van = world.extraction
  svg.append(svgNode('rect', { x: van.x, y: van.y, width: van.w, height: van.h, class: 'sg-plan-van' }))
  svg.append(svgNode('text', { x: van.x + van.w / 2, y: van.y - 3, class: 'sg-plan-label sg-plan-van-label', 'font-size': Math.max(2.5, width / 100) }, 'VAN'))
  const line = svgNode('line', { class: 'sg-plan-path' })
  const marker = svgNode('circle', { r: Math.max(1.5, width / 120), class: 'sg-plan-marker' })
  svg.append(line, marker)
  let chosen = dropPointAt(world, world.player.x + world.player.w / 2)
  const status = h('p', { class: 'sg-plan-status', attrs: { 'aria-live': 'polite' } })
  const slider = h('input', { attrs: { id: 'sg-drop-position', type: 'range', min: '2', max: String(width - 3), step: '1', 'data-autofocus': '' } })
  function select(x: number): void {
    chosen = dropPointAt(world, x)
    slider.value = String(Math.floor(chosen.x))
    const building = [...buildings].find(([, b]) => chosen.x >= b.left && chosen.x <= b.right)
    const location = chosen.y < world.groundY - 3 ? `${building?.[0] ?? 'compound'} roof` : 'ground approach'
    status.textContent = `DROP ${Math.floor(chosen.x)} / ${width} · ${location.toUpperCase()}`
    slider.setAttribute('aria-valuetext', status.textContent)
    line.setAttribute('x1', String(chosen.x)); line.setAttribute('x2', String(chosen.x))
    line.setAttribute('y1', String(top + 2)); line.setAttribute('y2', String(chosen.y))
    marker.setAttribute('cx', String(chosen.x)); marker.setAttribute('cy', String(chosen.y))
  }
  slider.addEventListener('input', () => select(Number(slider.value)))
  svg.addEventListener('click', (event) => {
    const matrix = svg.getScreenCTM()
    if (matrix) select(new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()).x)
  })
  select(chosen.x)
  return h('section', { class: 'sg-panel sg-drop-plan', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sg-drop-title', 'data-drop-planner': '' } },
    h('div', { class: 'sg-strip' }),
    h('header', { class: 'sg-head' }, h('h2', { text: 'Choose your drop', attrs: { id: 'sg-drop-title' } }), h('span', { class: 'sg-tag', text: world.name })),
    h('div', { class: 'sg-body' },
      h('p', { class: 'sg-plan-intro', text: 'Pick a roof or a ground approach. Click the compound blueprint or move the slider.' }),
      h('div', { class: 'sg-plan-map' }, svg),
      h('div', { class: 'sg-plan-legend' }, h('span', { text: 'CYAN / BUILDINGS' }), h('span', { text: 'GREEN / EXTRACTION VAN' }), h('span', { text: 'AMBER / YOUR DROP' })),
      h('label', { attrs: { for: 'sg-drop-position' }, text: 'Drop position' }), slider, status,
      h('p', { class: 'sg-plan-note' }, 'You still have to land it. Hold ', keyCaps('Space'), ' while falling to open your parachute; ', keyCaps('A'), ' / ', keyCaps('D'), ' to steer. The case location is unknown.'),
      h('button', { class: 'sg-btn sg-primary sg-plan-launch', text: 'Begin drop', attrs: { type: 'button' }, on: { click: () => launch(chosen.x) } })),
    h('footer', { class: 'sg-foot' }, h('span', {}, keyCaps('←'), ' / ', keyCaps('→'), ' adjust slider'), h('span', {}, keyCaps('Tab'), ' move · ', keyCaps('Enter'), ' choose')))
}
