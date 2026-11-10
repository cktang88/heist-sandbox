import { CatmullRomCurve3, MeshStandardMaterial, TubeGeometry, Vector3, type CanvasTexture } from 'three'
import { lazy, lit, paint, printed, seeded } from './officeParts'

/** Images for the decor props, each painted once on first use and shared by every prop that shows it. */

type Ctx = CanvasRenderingContext2D

/** Speckle, scuffs and a yellowed edge so printed paper does not look factory fresh. */
function age(c: Ctx, r: () => number, w: number, h: number, amount: number): void {
  for (let n = 0; n < 900 * amount; n += 1) {
    c.fillStyle = `rgba(${r() > 0.6 ? '255,250,235' : '40,30,20'},${r() * 0.1})`
    c.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2)
  }
  const edge = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75)
  edge.addColorStop(0, 'rgba(0,0,0,0)')
  edge.addColorStop(1, `rgba(90,70,30,${0.35 * amount})`)
  c.fillStyle = edge
  c.fillRect(0, 0, w, h)
}

function centred(c: Ctx, text: string, y: number, font: string, colour: string, w: number): void {
  c.font = font
  c.fillStyle = colour
  c.fillText(text, (w - c.measureText(text).width) / 2, y)
}

type PosterArt = (c: Ctx, w: number, h: number, r: () => number) => void

const POSTER_ART: PosterArt[] = [
  // Corporate safety notice.
  (c, w, h) => {
    c.fillStyle = '#e8e2d0'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#c8102e'
    c.fillRect(0, 0, w, 70)
    centred(c, 'SECURITY', 46, 'bold 38px Arial', '#fff', w)
    c.fillStyle = '#1b1f26'
    c.beginPath(); c.arc(w / 2, 170, 60, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#e8e2d0'
    c.beginPath(); c.ellipse(w / 2, 170, 44, 22, 0, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#1b1f26'
    c.beginPath(); c.arc(w / 2, 170, 15, 0, Math.PI * 2); c.fill()
    centred(c, 'IS WATCHING', 270, 'bold 30px Arial', '#1b1f26', w)
    centred(c, 'Report unbadged visitors', 300, '16px Arial', '#444', w)
    centred(c, 'to Control, ext. 4000', 320, '16px Arial', '#444', w)
  },
  // Soft-drink advert in loud neon colours.
  (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#2a0b3d')
    g.addColorStop(1, '#ff2d95')
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#19e3ff'
    c.beginPath(); c.moveTo(90, 300); c.lineTo(166, 300); c.lineTo(160, 130); c.lineTo(96, 130); c.closePath(); c.fill()
    c.fillStyle = '#0b1220'
    c.fillRect(96, 180, 64, 50)
    centred(c, 'NEURO', 64, 'bold italic 48px Arial', '#ffe14d', w)
    centred(c, 'COLA', 104, 'bold italic 40px Arial', '#ffffff', w)
    centred(c, 'THINK FASTER', 340, 'bold 20px Arial', '#ffffff', w)
  },
  // Gig poster for a band.
  (c, w, h, r) => {
    c.fillStyle = '#d9c9a3'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#121212'
    for (let n = 0; n < 9; n += 1) c.fillRect(0, 120 + n * 14, w, 6 + r() * 4)
    c.fillStyle = '#e0533a'
    c.beginPath(); c.arc(w / 2, 150, 70, 0, Math.PI * 2); c.fill()
    centred(c, 'RUST', 70, 'bold 64px Impact, Arial', '#121212', w)
    centred(c, 'ORCHARD', 300, 'bold 34px Impact, Arial', '#121212', w)
    centred(c, 'LIVE — SAT — PIER 9', 335, 'bold 15px Arial', '#121212', w)
  },
  // Wanted-style propaganda.
  (c, w, h) => {
    c.fillStyle = '#1d2a3a'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#ffb000'
    c.fillRect(16, 16, w - 32, h - 32)
    c.fillStyle = '#1d2a3a'
    c.fillRect(24, 24, w - 48, h - 48)
    centred(c, 'SEE', 80, 'bold 50px Arial', '#ffb000', w)
    centred(c, 'SOMETHING?', 128, 'bold 34px Arial', '#ffb000', w)
    c.fillStyle = '#ffb000'
    c.fillRect(w / 2 - 36, 160, 72, 92)
    c.fillStyle = '#1d2a3a'
    c.beginPath(); c.arc(w / 2, 190, 20, 0, Math.PI * 2); c.fill()
    c.fillRect(w / 2 - 26, 214, 52, 38)
    centred(c, 'SAY SOMETHING.', 300, 'bold 24px Arial', '#ffffff', w)
  },
]

function posterImage(index: number, torn: boolean): CanvasTexture {
  return paint(256, 360, (c, w, h) => {
    const r = seeded(100 + index * 7 + (torn ? 3 : 0))
    POSTER_ART[index](c, w, h, r)
    age(c, r, w, h, torn ? 1.4 : 0.6)
    // Tape at the corners.
    c.fillStyle = 'rgba(230,225,200,0.7)'
    c.fillRect(-6, 4, 40, 14)
    c.fillRect(w - 34, 4, 40, 14)
    if (!torn) return
    // Rip away the lower part along a ragged line and nibble the edges.
    c.globalCompositeOperation = 'destination-out'
    c.beginPath()
    c.moveTo(0, h)
    let y = h * 0.55
    for (let x = 0; x <= w; x += 12) {
      y += (r() - 0.45) * 40
      c.lineTo(x, Math.max(h * 0.4, Math.min(h * 0.92, y)))
    }
    c.lineTo(w, h)
    c.closePath()
    c.fill()
    c.beginPath(); c.moveTo(w, 0); c.lineTo(w - 70, 0); c.lineTo(w, 90); c.closePath(); c.fill()
    for (let n = 0; n < 30; n += 1) c.fillRect(r() > 0.5 ? 0 : w - 6, r() * h, 6 + r() * 6, 4 + r() * 10)
    c.globalCompositeOperation = 'source-over'
  })
}
export const POSTERS = [0, 1, 2, 3].map((index) => lazy(() => printed(posterImage(index, false), 0.8)))
export const TORN_POSTERS = [1, 2, 3].map((index) => lazy(() => printed(posterImage(index, true), 0.85, 'cutout')))

function graffitiImage(seed: number): CanvasTexture {
  return paint(512, 300, (c) => {
    const r = seeded(seed)
    const colours = seed === 1 ? ['#ff2d95', '#19e3ff', '#f5f5f5'] : ['#7cff4f', '#ffb000', '#111111']
    c.lineCap = 'round'
    c.lineJoin = 'round'
    // A chunky tag in outline and fill, then drips, then a thin signature.
    c.font = `bold ${seed === 1 ? 140 : 120}px Impact, Arial Black, sans-serif`
    const word = seed === 1 ? 'K1LN' : 'VOID'
    c.save()
    c.translate(40, 200)
    c.rotate(-0.08)
    c.lineWidth = 16
    c.strokeStyle = colours[2]
    c.strokeText(word, 0, 0)
    c.fillStyle = colours[0]
    c.fillText(word, 0, 0)
    c.lineWidth = 4
    c.strokeStyle = colours[1]
    c.strokeText(word, 4, -4)
    c.restore()
    c.fillStyle = colours[0]
    for (let n = 0; n < 14; n += 1) {
      const x = 60 + r() * 340
      const top = 180 + r() * 30
      c.fillRect(x, top, 3 + r() * 3, 20 + r() * 60)
    }
    c.strokeStyle = colours[1]
    c.lineWidth = 3
    c.beginPath()
    let x = 330
    c.moveTo(x, 260)
    for (let n = 0; n < 12; n += 1) { x += 10; c.lineTo(x, 250 + r() * 20) }
    c.stroke()
    // Overspray haze.
    for (let n = 0; n < 1500; n += 1) {
      c.fillStyle = colours[n % 2]
      c.globalAlpha = 0.25
      c.fillRect(30 + r() * 440, 60 + r() * 180, 1.5, 1.5)
    }
    c.globalAlpha = 1
  })
}
export const GRAFFITI = [1, 2].map((seed) => lazy(() => printed(graffitiImage(seed), 0.9, 'blend')))

export const NOTICE_BOARD = lazy(() => printed(paint(384, 288, (c, w, h) => {
  const r = seeded(51)
  c.fillStyle = '#9a7a52'
  c.fillRect(0, 0, w, h)
  for (let n = 0; n < 5000; n += 1) {
    c.fillStyle = `rgba(${r() > 0.5 ? '60,40,20' : '200,170,120'},0.3)`
    c.fillRect(r() * w, r() * h, 2, 2)
  }
  const sheets: [number, number, number, number, string][] = [
    [20, 20, 90, 120, '#f2efe6'], [125, 14, 110, 80, '#f2efe6'], [250, 30, 100, 130, '#fff6a8'],
    [40, 160, 120, 100, '#f2efe6'], [180, 110, 70, 90, '#ffd0e0'], [270, 180, 90, 90, '#cfe8ff'],
  ]
  for (const [x, y, sw, sh, colour] of sheets) {
    c.save()
    c.translate(x + sw / 2, y + sh / 2)
    c.rotate((r() - 0.5) * 0.15)
    c.fillStyle = 'rgba(0,0,0,0.25)'
    c.fillRect(-sw / 2 + 3, -sh / 2 + 3, sw, sh)
    c.fillStyle = colour
    c.fillRect(-sw / 2, -sh / 2, sw, sh)
    c.fillStyle = '#333'
    c.fillRect(-sw / 2 + 8, -sh / 2 + 10, sw * 0.6, 6)
    c.fillStyle = '#777'
    for (let line = 0; line < sh / 12 - 2; line += 1) c.fillRect(-sw / 2 + 8, -sh / 2 + 24 + line * 10, sw * (0.4 + r() * 0.45), 3)
    c.fillStyle = ['#c8102e', '#1d6f3a', '#1d3f8f'][Math.floor(r() * 3)]
    c.beginPath(); c.arc(0, -sh / 2 + 5, 4, 0, Math.PI * 2); c.fill()
    c.restore()
  }
}), 0.95))

function artImage(seed: number): CanvasTexture {
  return paint(512, 320, (c, w, h) => {
    const r = seeded(seed)
    if (seed === 61) {
      // Colour-field abstract in warm tones.
      c.fillStyle = '#2b1d1a'
      c.fillRect(0, 0, w, h)
      for (const [colour, y, bh] of [['#b0452c', 20, 130], ['#d89a3c', 160, 60], ['#3a2a40', 230, 70]] as const) {
        c.fillStyle = colour
        c.globalAlpha = 0.9
        c.fillRect(24 + r() * 10, y, w - 48, bh)
      }
      c.globalAlpha = 1
    } else {
      // Ink-wash skyline over a pale sky.
      const g = c.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#d8d4c8')
      g.addColorStop(1, '#9aa4aa')
      c.fillStyle = g
      c.fillRect(0, 0, w, h)
      for (let layer = 0; layer < 3; layer += 1) {
        c.fillStyle = ['#7a8288', '#4a5258', '#1e2428'][layer]
        for (let x = 0; x < w; x += 18 + r() * 20) {
          const bh = 60 + r() * (90 + layer * 50)
          c.fillRect(x, h - bh - layer * 10 + 30, 14 + r() * 22, bh)
        }
      }
      c.fillStyle = '#c8102e'
      c.beginPath(); c.arc(390, 80, 26, 0, Math.PI * 2); c.fill()
    }
    for (let n = 0; n < 3000; n += 1) {
      c.fillStyle = `rgba(255,255,255,${r() * 0.05})`
      c.fillRect(r() * w, r() * h, 2, 1)
    }
  })
}
export const ART = [61, 62].map((seed) => lazy(() => printed(artImage(seed), 0.6)))

export const EXIT_SIGN = lazy(() => lit(paint(256, 100, (c, w, h) => {
  c.fillStyle = '#0a8a3a'
  c.fillRect(0, 0, w, h)
  c.fillStyle = '#eaffef'
  c.font = 'bold 58px Arial'
  c.fillText('EXIT', 96, 72)
  // Running figure heading for a door.
  c.fillRect(20, 18, 50, 64)
  c.fillStyle = '#0a8a3a'
  c.fillRect(26, 24, 38, 52)
  c.fillStyle = '#eaffef'
  c.beginPath(); c.arc(44, 34, 6, 0, Math.PI * 2); c.fill()
  c.lineWidth = 6
  c.strokeStyle = '#eaffef'
  c.beginPath(); c.moveTo(42, 42); c.lineTo(38, 60); c.lineTo(30, 74); c.moveTo(38, 60); c.lineTo(50, 72); c.moveTo(30, 48); c.lineTo(52, 52); c.stroke()
}), 2.4))

type Neon = { text: string; colour: string; dead: number; sub?: string }
const NEONS: Neon[] = [
  { text: 'OPEN 24H', colour: '#ff2d95', dead: 3 },
  { text: 'RAMEN', colour: '#19e3ff', dead: -1, sub: 'ラーメン' },
  { text: 'BAR', colour: '#ffb000', dead: 1, sub: 'COLD BEER' },
]
function neonImage(neon: Neon): CanvasTexture {
  return paint(512, 192, (c, w) => {
    c.font = 'bold 96px "Arial Rounded MT Bold", Arial, sans-serif'
    c.lineJoin = 'round'
    const letters = [...neon.text]
    let x = (w - c.measureText(neon.text).width) / 2
    for (const [index, letter] of letters.entries()) {
      const dead = index === neon.dead
      c.shadowColor = dead ? 'transparent' : neon.colour
      c.shadowBlur = dead ? 0 : 22
      c.lineWidth = 7
      c.strokeStyle = dead ? 'rgba(80,60,70,0.9)' : neon.colour
      c.strokeText(letter, x, 112)
      if (!dead) {
        c.lineWidth = 1.5
        c.strokeStyle = 'rgba(255,255,255,0.7)'
        c.strokeText(letter, x, 112)
      }
      x += c.measureText(letter).width
    }
    if (neon.sub) {
      c.font = 'bold 36px sans-serif'
      c.shadowColor = '#ffffff'
      c.shadowBlur = 14
      c.fillStyle = neon.colour === '#19e3ff' ? '#ff2d95' : '#fff2c8'
      c.fillText(neon.sub, (w - c.measureText(neon.sub).width) / 2, 168)
    }
  })
}
export const NEON_SIGNS = NEONS.map((neon) => lazy(() => lit(neonImage(neon), 3, true)))

/** Room numbers come from one sheet of eight plates; each material shows one plate of it. */
const ROOM_SHEET = lazy(() => paint(512, 192, (c) => {
  const r = seeded(71)
  const numbers = ['101', '214', '07', '3B', '412', 'B2', '19', '330']
  numbers.forEach((label, index) => {
    const x = (index % 4) * 128
    const y = Math.floor(index / 4) * 96
    c.fillStyle = index % 3 === 0 ? '#c9c4b6' : '#2a2f36'
    c.fillRect(x + 2, y + 2, 124, 92)
    c.font = 'bold 60px "Courier New", monospace'
    c.fillStyle = index % 3 === 0 ? '#1b1f26' : '#e8e2d0'
    c.fillText(label, x + (128 - c.measureText(label).width) / 2, y + 68)
    for (let n = 0; n < 200; n += 1) {
      c.fillStyle = `rgba(0,0,0,${r() * 0.2})`
      c.fillRect(x + r() * 128, y + r() * 96, 2, 2)
    }
  })
}))
export const ROOM_PLATES = Array.from({ length: 8 }, (_, index) => lazy(() => {
  const texture = ROOM_SHEET().clone()
  texture.repeat.set(0.25, 0.5)
  texture.offset.set((index % 4) * 0.25, index < 4 ? 0.5 : 0)
  texture.needsUpdate = true
  return printed(texture as CanvasTexture, 0.5)
}))

export const HAZARD = lazy(() => printed(paint(512, 64, (c, w, h) => {
  const r = seeded(81)
  c.fillStyle = '#d8a520'
  c.fillRect(0, 0, w, h)
  c.fillStyle = '#16181b'
  for (let x = -h; x < w + h; x += 48) {
    c.beginPath(); c.moveTo(x, h); c.lineTo(x + 24, h); c.lineTo(x + 24 + h, 0); c.lineTo(x + h, 0); c.closePath(); c.fill()
  }
  // Scrapes through the paint where trolleys have hit it.
  for (let n = 0; n < 60; n += 1) {
    c.fillStyle = `rgba(110,110,105,${0.3 + r() * 0.5})`
    c.fillRect(r() * w, r() * h, 6 + r() * 30, 1 + r() * 3)
  }
}), 0.7))

function stainImage(seed: number): CanvasTexture {
  return paint(256, 256, (c, w, h) => {
    const r = seeded(seed)
    if (seed === 91) {
      // Water damage: a brown tide-mark blot with runs below it.
      for (let ring = 0; ring < 6; ring += 1) {
        const g = c.createRadialGradient(w / 2, 70, 5, w / 2, 70, 60 + ring * 10)
        g.addColorStop(0, 'rgba(70,50,25,0.0)')
        g.addColorStop(0.85, `rgba(70,50,25,${0.12 + ring * 0.02})`)
        g.addColorStop(1, 'rgba(70,50,25,0)')
        c.fillStyle = g
        c.beginPath(); c.ellipse(w / 2 + (r() - 0.5) * 20, 70, 60 + ring * 10, 40 + ring * 6, 0, 0, Math.PI * 2); c.fill()
      }
      for (let n = 0; n < 9; n += 1) {
        const x = w / 2 - 50 + r() * 100
        const g = c.createLinearGradient(0, 100, 0, 100 + 150 * r())
        g.addColorStop(0, 'rgba(60,45,25,0.35)')
        g.addColorStop(1, 'rgba(60,45,25,0)')
        c.fillStyle = g
        c.fillRect(x, 100, 3 + r() * 5, h - 100)
      }
    } else {
      // Rust bleeding from a fixing point, streaking down the wall.
      for (let n = 0; n < 16; n += 1) {
        const x = w / 2 + (r() - 0.5) * 70
        const g = c.createLinearGradient(0, 20, 0, 40 + r() * 210)
        g.addColorStop(0, 'rgba(120,55,20,0.55)')
        g.addColorStop(1, 'rgba(120,55,20,0)')
        c.fillStyle = g
        c.fillRect(x, 20, 2 + r() * 8, h)
      }
      c.fillStyle = 'rgba(80,35,15,0.7)'
      c.beginPath(); c.ellipse(w / 2, 26, 30, 14, 0, 0, Math.PI * 2); c.fill()
    }
  })
}
export const STAINS = [91, 92].map((seed) => lazy(() => printed(stainImage(seed), 0.95, 'blend')))

/** The night city through a window: towers with lit windows, haze, one neon sign. */
export const CITY_VIEW = lazy(() => lit(paint(512, 384, (c, w, h) => {
  const r = seeded(17)
  const sky = c.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#0b0f1e')
  sky.addColorStop(0.6, '#2a1d3f')
  sky.addColorStop(1, '#3b2a4a')
  c.fillStyle = sky
  c.fillRect(0, 0, w, h)
  for (let layer = 0; layer < 3; layer += 1) {
    for (let x = -10; x < w; ) {
      const bw = 30 + r() * 60
      const top = 80 + layer * 60 + r() * 120
      c.fillStyle = ['#1a1f36', '#141a2e', '#0c1020'][layer]
      c.fillRect(x, top, bw, h - top)
      for (let wy = top + 6; wy < h; wy += 9) {
        for (let wx = x + 4; wx < x + bw - 4; wx += 7) {
          if (r() > 0.72 - layer * 0.08) {
            c.fillStyle = r() > 0.85 ? '#cfe8ff' : ['#ffb347', '#ffc266', '#ff9a2e'][Math.floor(r() * 3)]
            c.globalAlpha = 0.35 + layer * 0.25
            c.fillRect(wx, wy, 3, 4)
          }
        }
      }
      c.globalAlpha = 1
      x += bw + r() * 8
    }
  }
  c.fillStyle = '#ff2d95'
  c.shadowColor = '#ff2d95'
  c.shadowBlur = 12
  c.fillRect(330, 170, 8, 70)
  c.fillStyle = '#19e3ff'
  c.shadowColor = '#19e3ff'
  c.fillRect(90, 220, 60, 6)
}), 1.1))

/** Horizontal blind slats with a little gap between them; the city shows through the gaps. */
export const BLINDS = lazy(() => printed(paint(64, 256, (c, w, h) => {
  for (let y = 0; y < h; y += 16) {
    const g = c.createLinearGradient(0, y, 0, y + 12)
    g.addColorStop(0, '#d8d4c8')
    g.addColorStop(1, '#9a968c')
    c.fillStyle = g
    c.fillRect(0, y, w, 12)
  }
  // Two bent slats near the bottom where someone peeked out.
  c.clearRect(20, 196, 26, 14)
}), 0.7, 'cutout'))

/** Three sagging cables, built once and shared. */
export const CABLE_TUBES = lazy(() => [0.18, 0.28, 0.12].map((sag, index) => {
  const points: Vector3[] = []
  for (let step = 0; step <= 8; step += 1) {
    const t = step / 8
    const along = -2.5 + t * 5
    const droop = Math.sin(t * Math.PI) * sag + (step % 4 === 0 ? 0 : 0.02 * index)
    points.push(new Vector3(along, -0.06 - droop - index * 0.03, (index - 1) * 0.05))
  }
  return new TubeGeometry(new CatmullRomCurve3(points), 32, 0.018 + index * 0.006, 6, false)
}))

/** A faint reflection over window glass so it reads as glass rather than a hole in the wall. */
export const GLASS_SHEEN = lazy(() => new MeshStandardMaterial({ color: 0x000000, roughness: 0.05, metalness: 1, transparent: true, opacity: 0.15, depthWrite: false }))
