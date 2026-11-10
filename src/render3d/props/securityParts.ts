import { CanvasTexture, DoubleSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three'
import { drawn, grime, once, placard, seeded, stripes } from './industrialParts'

/** Canvas-drawn surfaces for the security props: camera feeds, cash, lockers, shields. Each is drawn once. */

type Feed = (c: CanvasRenderingContext2D, w: number, h: number, random: () => number) => void

/** A corridor seen from a ceiling camera: converging walls, doors and a lamp pool. */
const corridor: Feed = (c, w, h) => {
  c.fillStyle = '#4a5650'
  c.beginPath()
  c.moveTo(0, h)
  c.lineTo(w * 0.38, h * 0.45)
  c.lineTo(w * 0.62, h * 0.45)
  c.lineTo(w, h)
  c.fill()
  c.fillStyle = '#2c3632'
  c.fillRect(w * 0.38, h * 0.12, w * 0.24, h * 0.33)
  c.fillStyle = '#1c2420'
  c.fillRect(w * 0.12, h * 0.3, w * 0.08, h * 0.45)
  c.fillRect(w * 0.8, h * 0.3, w * 0.08, h * 0.45)
  c.fillStyle = 'rgba(220,240,225,0.35)'
  c.beginPath()
  c.ellipse(w * 0.5, h * 0.72, w * 0.22, h * 0.1, 0, 0, Math.PI * 2)
  c.fill()
}

/** A car park bay with a parked car. */
const parking: Feed = (c, w, h) => {
  c.fillStyle = '#3c4642'
  c.fillRect(0, h * 0.5, w, h * 0.5)
  c.strokeStyle = '#c8d0c8'
  c.lineWidth = 3
  for (let x = -40; x < w; x += 70) {
    c.beginPath()
    c.moveTo(x + 30, h * 0.5)
    c.lineTo(x, h)
    c.stroke()
  }
  c.fillStyle = '#151a18'
  c.fillRect(w * 0.3, h * 0.58, w * 0.36, h * 0.2)
  c.fillRect(w * 0.37, h * 0.48, w * 0.22, h * 0.12)
  c.fillStyle = '#2a3430'
  c.fillRect(w * 0.1, h * 0.1, w * 0.06, h * 0.4)
  c.fillRect(w * 0.84, h * 0.1, w * 0.06, h * 0.4)
}

/** A gate in the perimeter fence, with a figure. */
const gate: Feed = (c, w, h, random) => {
  c.fillStyle = '#56625c'
  c.fillRect(0, h * 0.62, w, h * 0.38)
  c.strokeStyle = 'rgba(200,215,205,0.5)'
  c.lineWidth = 1
  for (let x = 0; x < w; x += 8) {
    c.beginPath()
    c.moveTo(x, h * 0.2)
    c.lineTo(x + 20, h * 0.62)
    c.moveTo(x + 20, h * 0.2)
    c.lineTo(x, h * 0.62)
    c.stroke()
  }
  c.fillStyle = '#0c100e'
  const x = w * (0.3 + random() * 0.4)
  c.fillRect(x, h * 0.42, 8, 26)
  c.beginPath()
  c.arc(x + 4, h * 0.39, 5, 0, Math.PI * 2)
  c.fill()
}

/** A stairwell landing from above. */
const stairs: Feed = (c, w, h) => {
  for (let step = 0; step < 9; step += 1) {
    c.fillStyle = step % 2 ? '#46524c' : '#38423e'
    c.fillRect(w * 0.15 + step * 8, h * 0.15 + step * 13, w * 0.5, 13)
  }
  c.fillStyle = '#9aa69e'
  c.fillRect(w * 0.7, h * 0.1, 4, h * 0.8)
}

const FEEDS: readonly Feed[] = [corridor, parking, gate, stairs]

/** Draws one grainy, green-grey surveillance picture with its camera label and time. */
function feed(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, index: number): void {
  c.save()
  c.translate(x, y)
  c.beginPath()
  c.rect(0, 0, w, h)
  c.clip()
  c.fillStyle = '#18201c'
  c.fillRect(0, 0, w, h)
  const random = seeded(index + 3)
  FEEDS[(index + Math.floor(index / 4)) % FEEDS.length](c, w, h, random)
  for (let line = 0; line < h; line += 3) {
    c.fillStyle = 'rgba(0,0,0,0.18)'
    c.fillRect(0, line, w, 1)
  }
  for (let dot = 0; dot < 300; dot += 1) {
    c.fillStyle = `rgba(255,255,255,${random() * 0.12})`
    c.fillRect(random() * w, random() * h, 1, 1)
  }
  c.fillStyle = 'rgba(230,240,230,0.85)'
  c.font = `${Math.round(h * 0.09)}px monospace`
  c.fillText(`CAM ${String(index + 1).padStart(2, '0')}`, 6, h * 0.12)
  c.fillText(`23:4${index % 10}:${String(10 + index * 7).slice(-2)}`, w - h * 0.55, h * 0.95)
  if (index % 3 === 0) {
    c.fillStyle = '#ff3030'
    c.beginPath()
    c.arc(w - 10, 10, 4, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()
}

/** One camera picture for a desk monitor. */
export function cctvScreen(index: number) {
  return drawn(`cctv:${index}`, 160, 100, (c) => feed(c, 0, 0, 160, 100, index), { glowing: 1.4, roughness: 0.25 })
}

/** A wall of 4 by 3 camera pictures with black bezels between them; one has lost its signal. */
export function cctvWall() {
  return drawn('cctvWall', 1024, 448, (c) => {
    c.fillStyle = '#050606'
    c.fillRect(0, 0, 1024, 448)
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const index = row * 4 + col
        const x = 8 + col * 254
        const y = 8 + row * 146
        if (index === 6) {
          c.fillStyle = '#0a1a3a'
          c.fillRect(x, y, 244, 136)
          c.fillStyle = '#d8e0ff'
          c.font = '20px monospace'
          c.fillText('NO SIGNAL', x + 70, y + 74)
        } else feed(c, x, y, 244, 136, index)
      }
    }
  }, { glowing: 1.3, roughness: 0.2 })
}

/** Radio base stations: displays, knobs and a channel readout. */
export function radioPanel() {
  return drawn('radioPanel', 256, 128, (c) => {
    c.fillStyle = '#16191c'
    c.fillRect(0, 0, 256, 128)
    for (const y of [6, 68]) {
      c.fillStyle = '#23272b'
      c.fillRect(4, y, 248, 54)
      c.fillStyle = '#0d2010'
      c.fillRect(14, y + 10, 90, 24)
      c.fillStyle = '#ffb020'
      c.font = 'bold 18px monospace'
      c.fillText(y === 6 ? 'CH 04  TAC' : 'CH 01  OPS', 18, y + 28)
      for (let knob = 0; knob < 3; knob += 1) {
        c.fillStyle = '#8a9096'
        c.beginPath()
        c.arc(140 + knob * 36, y + 26, 11, 0, Math.PI * 2)
        c.fill()
      }
      c.fillStyle = '#ff3030'
      c.fillRect(14, y + 40, 6, 6)
      c.fillStyle = '#39ff6a'
      c.fillRect(26, y + 40, 6, 6)
    }
  }, { glowing: 1.2, roughness: 0.5 })
}

/** The front of an olive ammunition locker: vents, stencil and an explosives placard. */
export function ammoLockerFront() {
  return drawn('ammoLocker', 256, 384, (c) => {
    c.fillStyle = '#4c5638'
    c.fillRect(0, 0, 256, 384)
    grime(c, 256, 384, 0.5, 31)
    c.strokeStyle = '#262c1c'
    c.lineWidth = 3
    c.strokeRect(6, 6, 120, 372)
    c.strokeRect(130, 6, 120, 372)
    c.fillStyle = '#20251a'
    for (let y = 24; y < 70; y += 9) {
      c.fillRect(30, y, 72, 4)
      c.fillRect(154, y, 72, 4)
    }
    c.fillStyle = 'rgba(232,226,200,0.85)'
    c.font = 'bold 26px monospace'
    c.textAlign = 'center'
    c.fillText('AMMUNITION', 128, 150)
    c.font = 'bold 16px monospace'
    c.fillText('AUTHORISED ACCESS ONLY', 128, 176)
    placard(c, 128, 250, 70, '#e86a1a', '1.4', '#111')
    c.fillStyle = '#c8ccd0'
    c.fillRect(112, 290, 8, 50)
    c.fillRect(136, 290, 8, 50)
  }, { roughness: 0.6, metalness: 0.2 })
}

/** Clear riot shield: see-through polycarbonate with a printed band. */
export function shieldMaterial(): MeshStandardMaterial {
  return once('riotShield', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 256
    const c = canvas.getContext('2d')!
    c.fillStyle = 'rgba(150,180,200,0.32)'
    c.fillRect(0, 0, 128, 256)
    c.fillStyle = 'rgba(10,12,14,1)'
    c.fillRect(0, 0, 128, 8)
    c.fillRect(0, 248, 128, 8)
    c.fillRect(0, 0, 6, 256)
    c.fillRect(122, 0, 6, 256)
    c.fillRect(0, 70, 128, 30)
    c.fillStyle = '#f2f2f2'
    c.font = 'bold 20px sans-serif'
    c.textAlign = 'center'
    c.fillText('SECURITY', 64, 93)
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    return new MeshStandardMaterial({ map, transparent: true, roughness: 0.1, metalness: 0.1, side: DoubleSide, depthWrite: false })
  })
}

/** Hessian weave for sandbags. */
export function burlap() {
  return drawn('burlap', 64, 64, (c) => {
    c.fillStyle = '#8a7a58'
    c.fillRect(0, 0, 64, 64)
    for (let line = 0; line < 64; line += 4) {
      c.fillStyle = 'rgba(40,30,15,0.35)'
      c.fillRect(0, line, 64, 1)
      c.fillRect(line, 0, 1, 64)
    }
    grime(c, 64, 64, 0.6, 37)
  }, { roughness: 0.95 })
}

/** Red and white reflective boards for a barricade. */
export function barricadeBoard() {
  return drawn('barricadeBoard', 256, 32, (c) => stripes(c, 0, 0, 256, 32, '#e8e6e0', '#c0221a', 20), { roughness: 0.4 })
}

/** A wall of numbered safe deposit box doors with keyholes. */
export function depositGrid() {
  return drawn('depositGrid', 512, 480, (c) => {
    c.fillStyle = '#8f949a'
    c.fillRect(0, 0, 512, 480)
    let number = 101
    for (let row = 0; row < 12; row += 1) {
      const tall = row >= 9
      const h = 40
      for (let col = 0; col < (tall ? 4 : 8); col += 1) {
        const w = tall ? 128 : 64
        const x = col * w
        const y = row * h
        const shade = 150 + ((row * 7 + col * 13) % 5) * 6
        c.fillStyle = `rgb(${shade},${shade + 4},${shade + 9})`
        c.fillRect(x + 2, y + 2, w - 4, h - 4)
        c.fillStyle = 'rgba(255,255,255,0.25)'
        c.fillRect(x + 2, y + 2, w - 4, 2)
        c.fillStyle = '#2a2c2e'
        c.beginPath()
        c.arc(x + w / 2 - 8, y + h / 2, 3, 0, Math.PI * 2)
        c.arc(x + w / 2 + 8, y + h / 2, 3, 0, Math.PI * 2)
        c.fill()
        c.fillStyle = '#b08a45'
        c.fillRect(x + 6, y + 6, 18, 8)
        c.fillStyle = '#222'
        c.font = '8px monospace'
        c.fillText(String(number), x + 7, y + 13)
        number += 1
      }
    }
  }, { roughness: 0.35, metalness: 0.75 })
}

/** Bundled banknotes with paper bands, seen from the side of a stack. */
export function cashFace() {
  return drawn('cash', 256, 256, (c) => {
    const random = seeded(41)
    for (let y = 0; y < 256; y += 32) {
      for (let x = 0; x < 256; x += 64) {
        const tone = 0.85 + random() * 0.25
        c.fillStyle = `rgb(${Math.round(120 * tone)},${Math.round(140 * tone)},${Math.round(105 * tone)})`
        c.fillRect(x + 1, y + 1, 62, 30)
        c.fillStyle = 'rgba(40,60,40,0.4)'
        for (let edge = y + 3; edge < y + 30; edge += 2) c.fillRect(x + 2, edge, 60, 1)
        c.fillStyle = '#e8dcc0'
        c.fillRect(x + 24, y + 1, 14, 30)
        c.fillStyle = '#7a2a20'
        c.fillRect(x + 27, y + 12, 8, 8)
      }
    }
  }, { roughness: 0.85 })
}

/** A brass maker's plate for the big safe. */
export function safePlate() {
  return drawn('safePlate', 128, 48, (c) => {
    c.fillStyle = '#b08a45'
    c.fillRect(0, 0, 128, 48)
    c.strokeStyle = '#5a4420'
    c.lineWidth = 3
    c.strokeRect(3, 3, 122, 42)
    c.fillStyle = '#3a2a10'
    c.font = 'bold 15px serif'
    c.textAlign = 'center'
    c.fillText('GRANITE & SONS', 64, 22)
    c.font = '10px serif'
    c.fillText('FIRE  •  BURGLAR  •  1964', 64, 38)
  }, { roughness: 0.3, metalness: 1 })
}

/** A key cabinet's backboard: rows of hooks with coloured tags and keys. */
export function keyBoard() {
  return drawn('keyBoard', 128, 160, (c) => {
    c.fillStyle = '#d8d4c8'
    c.fillRect(0, 0, 128, 160)
    const colours = ['#c0281e', '#2a5aa0', '#e2b21c', '#3d8a3d', '#e8e6e0']
    const random = seeded(43)
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const x = 10 + col * 19
        const y = 14 + row * 38
        c.fillStyle = '#444'
        c.fillRect(x + 3, y, 2, 6)
        if (random() < 0.2) continue
        c.fillStyle = '#9aa0a6'
        c.fillRect(x + 2, y + 6, 4, 14)
        c.fillStyle = colours[Math.floor(random() * colours.length)]
        c.fillRect(x - 1, y + 18, 10, 12)
      }
    }
  })
}

/** Welded steel mesh that can be seen through, for cages. `across` and `down` set how many cells a panel shows. */
export function weldedMesh(across: number, down: number): MeshStandardMaterial {
  return once(`mesh:${across}:${down}`, () => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 32
    const c = canvas.getContext('2d')!
    c.fillStyle = '#9aa2aa'
    c.fillRect(0, 0, 32, 3)
    c.fillRect(0, 0, 3, 32)
    const map = new CanvasTexture(canvas)
    map.wrapS = RepeatWrapping
    map.wrapT = RepeatWrapping
    map.repeat.set(across, down)
    map.colorSpace = SRGBColorSpace
    return new MeshStandardMaterial({ map, alphaTest: 0.5, side: DoubleSide, metalness: 0.7, roughness: 0.45 })
  })
}

/** The status panel on a walk-through metal detector. */
export function detectorDisplay() {
  return drawn('detector', 128, 32, (c) => {
    c.fillStyle = '#0a0c10'
    c.fillRect(0, 0, 128, 32)
    c.fillStyle = '#39ff6a'
    c.font = 'bold 18px monospace'
    c.fillText('READY', 8, 23)
    for (let bar = 0; bar < 5; bar += 1) {
      c.fillStyle = bar < 2 ? '#39ff6a' : '#203020'
      c.fillRect(80 + bar * 8, 8, 6, 16)
    }
  }, { glowing: 1.8 })
}
