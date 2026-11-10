import { BufferGeometry, CatmullRomCurve3, DoubleSide, PlaneGeometry, SphereGeometry, TubeGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { drawn, grime, once, seeded } from './industrialParts'

/** Canvas pictures and shared shapes for the exterior props. Each is made once. */

/** Writes text with a soft neon halo. */
function neon(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, colour: string, align: CanvasTextAlign = 'left'): void {
  c.font = `bold ${size}px sans-serif`
  c.textAlign = align
  c.shadowColor = colour
  c.shadowBlur = size * 0.6
  c.fillStyle = colour
  c.fillText(text, x, y)
  c.shadowBlur = size * 0.2
  c.fillStyle = '#ffffff'
  c.globalAlpha = 0.65
  c.fillText(text, x, y)
  c.globalAlpha = 1
  c.shadowBlur = 0
}

type Advert = (c: CanvasRenderingContext2D) => void

/** A rice-wine advert: magenta and cyan, a glowing bottle. */
const sake: Advert = (c) => {
  const sky = c.createLinearGradient(0, 0, 1024, 512)
  sky.addColorStop(0, '#1a0628')
  sky.addColorStop(1, '#3a0a3a')
  c.fillStyle = sky
  c.fillRect(0, 0, 1024, 512)
  c.fillStyle = 'rgba(255,45,149,0.2)'
  for (let y = 0; y < 512; y += 12) c.fillRect(0, y, 1024, 3)
  c.shadowColor = '#19e3ff'
  c.shadowBlur = 40
  c.fillStyle = '#0c3a48'
  c.fillRect(760, 120, 120, 340)
  c.fillRect(795, 50, 50, 80)
  c.shadowBlur = 0
  c.strokeStyle = '#19e3ff'
  c.lineWidth = 6
  c.strokeRect(760, 120, 120, 340)
  neon(c, 'NEO-SAKE', 70, 230, 150, '#ff2d95')
  neon(c, 'DISTILLED IN ORBIT', 80, 320, 46, '#19e3ff')
  neon(c, '▲ SECTOR 9  •  AVAILABLE NOW', 80, 420, 34, '#ffb000')
}

/** A cosmetic implant advert: a cyan face in profile on violet. */
const skin: Advert = (c) => {
  const sky = c.createRadialGradient(300, 256, 40, 300, 256, 600)
  sky.addColorStop(0, '#2a1a5a')
  sky.addColorStop(1, '#07040f')
  c.fillStyle = sky
  c.fillRect(0, 0, 1024, 512)
  c.strokeStyle = '#19e3ff'
  c.shadowColor = '#19e3ff'
  c.shadowBlur = 30
  c.lineWidth = 8
  c.beginPath()
  c.moveTo(250, 470)
  c.bezierCurveTo(220, 380, 200, 330, 230, 280)
  c.lineTo(190, 240)
  c.lineTo(235, 215)
  c.bezierCurveTo(230, 120, 300, 60, 380, 70)
  c.bezierCurveTo(470, 80, 500, 170, 480, 260)
  c.bezierCurveTo(470, 330, 430, 380, 430, 470)
  c.stroke()
  c.shadowBlur = 0
  for (let ring = 0; ring < 4; ring += 1) {
    c.strokeStyle = `rgba(138,92,255,${0.7 - ring * 0.15})`
    c.beginPath()
    c.arc(390, 200, 60 + ring * 28, -1.2, 0.6)
    c.stroke()
  }
  neon(c, 'SYNTH//SKIN', 560, 210, 92, '#8a5cff')
  neon(c, 'BE SOMEONE NEW.', 566, 290, 52, '#19e3ff')
  neon(c, 'CLINICS ON LEVELS 40-44', 568, 380, 32, '#ff2d95')
}

/** A noodle bar advert: amber and red, a steaming bowl. */
const noodles: Advert = (c) => {
  c.fillStyle = '#1a0806'
  c.fillRect(0, 0, 1024, 512)
  c.fillStyle = 'rgba(255,59,48,0.18)'
  for (let x = 0; x < 1024; x += 40) c.fillRect(x, 0, 18, 512)
  c.shadowColor = '#ffb000'
  c.shadowBlur = 40
  c.fillStyle = '#ffb000'
  c.beginPath()
  c.arc(250, 270, 170, 0, Math.PI)
  c.fill()
  c.shadowBlur = 0
  c.strokeStyle = '#fff2d0'
  c.lineWidth = 6
  for (let steam = 0; steam < 3; steam += 1) {
    c.beginPath()
    c.moveTo(180 + steam * 70, 240)
    c.bezierCurveTo(150 + steam * 70, 180, 220 + steam * 70, 140, 180 + steam * 70, 80)
    c.stroke()
  }
  c.fillStyle = '#ff3b30'
  c.fillRect(80, 262, 340, 16)
  neon(c, 'KAIJU', 480, 210, 140, '#ff3b30')
  neon(c, 'NOODLE BAR', 486, 300, 80, '#ffb000')
  neon(c, 'OPEN 24H  •  STREET LEVEL', 490, 390, 34, '#fff2d0')
}

const ADVERTS: readonly Advert[] = [sake, skin, noodles]

/** One billboard advert, glowing. */
export function advert(index: number) {
  return drawn(`advert:${index}`, 1024, 512, (c) => {
    ADVERTS[index % ADVERTS.length](c)
    grime(c, 1024, 512, 0.25, index + 50)
  }, { glowing: 1.5, roughness: 0.4 })
}

type SignFace = (c: CanvasRenderingContext2D) => void

const SIGNS: readonly SignFace[] = [
  (c) => {
    c.fillStyle = '#e8e6e0'
    c.fillRect(0, 0, 160, 160)
    c.fillStyle = '#c0221a'
    c.beginPath()
    c.arc(80, 80, 70, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#f2f2f2'
    c.fillRect(30, 68, 100, 24)
  },
  (c) => {
    c.fillStyle = '#e8e6e0'
    c.fillRect(0, 0, 160, 160)
    c.strokeStyle = '#c0221a'
    c.lineWidth = 14
    c.beginPath()
    c.arc(80, 80, 64, 0, Math.PI * 2)
    c.stroke()
    c.fillStyle = '#111'
    c.font = 'bold 64px sans-serif'
    c.textAlign = 'center'
    c.fillText('10', 80, 102)
  },
  (c) => {
    c.fillStyle = '#e2b21c'
    c.fillRect(0, 0, 160, 160)
    c.fillStyle = '#111'
    c.fillRect(6, 6, 148, 148)
    c.fillStyle = '#e2b21c'
    c.fillRect(12, 12, 136, 136)
    c.fillStyle = '#111'
    c.font = 'bold 22px sans-serif'
    c.textAlign = 'center'
    c.fillText('CAUTION', 80, 46)
    c.font = 'bold 17px sans-serif'
    c.fillText('FORKLIFTS', 80, 76)
    c.fillText('OPERATING', 80, 100)
    c.fillText('IN THIS AREA', 80, 124)
  },
  (c) => {
    c.fillStyle = '#1d4f8c'
    c.fillRect(0, 0, 160, 160)
    c.fillStyle = '#f2f2f2'
    c.font = 'bold 20px sans-serif'
    c.textAlign = 'center'
    c.fillText('AUTHORISED', 80, 52)
    c.fillText('PERSONNEL', 80, 80)
    c.fillText('ONLY', 80, 108)
    c.font = '12px sans-serif'
    c.fillText('VIOLATORS DETAINED', 80, 136)
  },
]
export const SIGN_COUNT = SIGNS.length

/** A road or site sign face. */
export function signFace(index: number) {
  return drawn(`sign:${index}`, 160, 160, (c) => {
    SIGNS[index % SIGNS.length](c)
    grime(c, 160, 160, 0.35, index + 60)
  }, { roughness: 0.35, metalness: 0.2 })
}

/** The company flag: an emblem on dark blue. */
export function flagCloth() {
  const material = drawn('flag', 256, 160, (c) => {
    c.fillStyle = '#16233a'
    c.fillRect(0, 0, 256, 160)
    c.fillStyle = '#19b3c8'
    c.fillRect(0, 130, 256, 12)
    c.fillStyle = '#e8e6e0'
    c.beginPath()
    c.moveTo(70, 115)
    c.lineTo(110, 30)
    c.lineTo(150, 115)
    c.closePath()
    c.fill()
    c.fillStyle = '#16233a'
    c.beginPath()
    c.moveTo(95, 105)
    c.lineTo(110, 72)
    c.lineTo(125, 105)
    c.closePath()
    c.fill()
    c.fillStyle = '#e8e6e0'
    c.font = 'bold 26px sans-serif'
    c.fillText('AEGIS', 160, 90)
  }, { roughness: 0.9 })
  material.side = DoubleSide
  return material
}

/** Lit lettering over the guard booth. */
export function boothSign() {
  return drawn('boothSign', 256, 48, (c) => {
    c.fillStyle = '#0a0d12'
    c.fillRect(0, 0, 256, 48)
    neon(c, 'SECURITY', 128, 36, 34, '#cfe8ff', 'center')
  }, { glowing: 1.4 })
}

/** Vanes printed on a turbine ventilator head. */
export function turbineVanes() {
  return drawn('turbine', 128, 64, (c) => {
    c.fillStyle = '#a8aeb2'
    c.fillRect(0, 0, 128, 64)
    for (let x = 0; x < 128; x += 8) {
      c.fillStyle = '#4a4e52'
      c.fillRect(x, 0, 3, 64)
    }
    grime(c, 128, 64, 0.4, 70)
  }, { roughness: 0.4, metalness: 0.8 })
}

/** A flag that ripples, 1 wide and 0.62 tall, its hoist edge at x = 0. */
export const FLAG = once('flagCloth', () => {
  const plane = new PlaneGeometry(1, 0.62, 14, 1)
  plane.translate(0.5, 0, 0)
  const position = plane.attributes.position
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    position.setZ(index, Math.sin(x * 7) * 0.06 * x)
    position.setY(index, position.getY(index) - x * x * 0.06)
  }
  plane.computeVertexNormals()
  return plane
})

/** A shallow dish bowl (part of a sphere of radius 1), its deepest point at the origin, opening toward +y. */
export const DISH = once('dish', () => {
  const bowl = new SphereGeometry(1, 28, 6, 0, Math.PI * 2, Math.PI - 0.62, 0.62)
  bowl.translate(0, 1, 0)
  return bowl
})

/**
 * Concertina razor wire: two coils wound in opposite directions along x, from -1 to 1, 0.7 tall, sitting on y = 0.
 * Built once as tubes and merged into one geometry.
 */
export const RAZOR_COIL = once('razorCoil', () => {
  const random = seeded(77)
  const coil = (phase: number, radius: number, turns: number): BufferGeometry => {
    const points: Vector3[] = []
    const steps = turns * 16
    for (let step = 0; step <= steps; step += 1) {
      const angle = (step / 16) * Math.PI * 2 + phase
      const wobble = 1 + (random() - 0.5) * 0.12
      points.push(new Vector3(-1 + (2 * step) / steps, 0.34 + Math.sin(angle) * radius * wobble, Math.cos(angle) * radius * wobble))
    }
    return new TubeGeometry(new CatmullRomCurve3(points), steps * 2, 0.012, 4, false)
  }
  return mergeGeometries([coil(0, 0.32, 11), coil(Math.PI * 0.6, 0.3, 11)])
})
