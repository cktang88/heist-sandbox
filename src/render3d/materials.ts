import { CanvasTexture, Color, DoubleSide, ImageLoader, MeshPhysicalMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector2, type Texture } from 'three'
import type { SurfaceMaterials } from './levelMesh'
import { rock } from './surfaces'
import { bakeMaterial } from './textures'

/** Photo-scanned surfaces in `public/textures` (ambientCG, CC0). `tilesAcross` is how many tiles one copy of the photo covers. */
const PHOTO = {
  brick: { tilesAcross: 2.6, metalness: 0, tint: 0xffffff },
  concrete: { tilesAcross: 4, metalness: 0, tint: 0xd8d8d8 },
  plaster: { tilesAcross: 5, metalness: 0, tint: 0x8d99a8 },
  steel: { tilesAcross: 3, metalness: 1, tint: 0xb9c0c8 },
  reinforced: { tilesAcross: 4, metalness: 0, tint: 0xaab4bf },
  wood: { tilesAcross: 2, metalness: 0, tint: 0xa89888 },
  dirt: { tilesAcross: 4, metalness: 0, tint: 0xbfb3a6 },
  asphalt: { tilesAcross: 4, metalness: 0, tint: 0xffffff },
} as const

/** Level geometry uses UVs that repeat every two tiles; this rescales them per surface. */
const UV_TILES = 2
/** Photo sets with their own folder; the structural concrete reuses the plain concrete photos. */
const FOLDER: Partial<Record<keyof typeof PHOTO, string>> = { reinforced: 'concrete' }
/** The photo normal maps are soft at this viewing distance; a little extra depth keeps surfaces gritty. */
const NORMAL_DEPTH = 1.35

function photoMaterial(name: keyof typeof PHOTO, loader: TextureLoader, anisotropy: number): MeshStandardMaterial {
  const spec = PHOTO[name]
  const load = (file: string, isColor: boolean): Texture => {
    const map = loader.load(`${import.meta.env.BASE_URL}textures/${FOLDER[name] ?? name}/${file}.jpg`)
    return repeat(map, spec.tilesAcross, anisotropy, isColor)
  }
  return new MeshStandardMaterial({
    map: name === 'reinforced' ? formwork(anisotropy) : load('color', true),
    normalMap: load('normal', false),
    normalScale: new Vector2(NORMAL_DEPTH, NORMAL_DEPTH),
    roughnessMap: load('rough', false),
    color: new Color(spec.tint),
    roughness: 1,
    metalness: spec.metalness,
    vertexColors: true,
  })
}

function repeat(map: Texture, tilesAcross: number, anisotropy: number, isColor: boolean): Texture {
  map.wrapS = RepeatWrapping
  map.wrapT = RepeatWrapping
  map.repeat.setScalar(UV_TILES / tilesAcross)
  map.anisotropy = anisotropy
  if (isColor) map.colorSpace = SRGBColorSpace
  return map
}

const FORMWORK_SIZE = 1024
/** Formwork panels per photo copy (which covers four tiles each way), and tie holes per panel side. */
const PANELS = 2
const TIES = 3

/**
 * Cast-in-place concrete for the building's skeleton: the concrete photo with the seams and tie holes
 * of the shuttering it was poured against. This is how players tell structure that will not break.
 * The canvas is drawn once the photo arrives; until then it is plain grey.
 */
function formwork(anisotropy: number): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = FORMWORK_SIZE
  const c = canvas.getContext('2d')!
  c.fillStyle = '#8a8d90'
  c.fillRect(0, 0, FORMWORK_SIZE, FORMWORK_SIZE)
  const texture = repeat(new CanvasTexture(canvas), PHOTO.reinforced.tilesAcross, anisotropy, true)
  new ImageLoader().load(`${import.meta.env.BASE_URL}textures/concrete/color.jpg`, (photo) => {
    c.drawImage(photo, 0, 0, FORMWORK_SIZE, FORMWORK_SIZE)
    const panel = FORMWORK_SIZE / PANELS
    for (let index = 0; index <= PANELS; index += 1) {
      const at = index * panel
      c.fillStyle = 'rgba(20,22,26,0.55)'
      c.fillRect(at - 3, 0, 5, FORMWORK_SIZE)
      c.fillRect(0, at - 3, FORMWORK_SIZE, 5)
      c.fillStyle = 'rgba(235,238,240,0.18)'
      c.fillRect(at + 2, 0, 3, FORMWORK_SIZE)
      c.fillRect(0, at + 2, FORMWORK_SIZE, 3)
    }
    for (let px = 0; px < PANELS * TIES; px += 1) {
      for (let py = 0; py < PANELS * TIES; py += 1) {
        const x = (px + 0.5) * (panel / TIES)
        const y = (py + 0.5) * (panel / TIES)
        c.fillStyle = 'rgba(230,232,235,0.22)'
        c.beginPath()
        c.arc(x, y, 11, 0, Math.PI * 2)
        c.fill()
        c.fillStyle = 'rgba(15,16,18,0.7)'
        c.beginPath()
        c.arc(x, y, 6, 0, Math.PI * 2)
        c.fill()
      }
    }
    texture.needsUpdate = true
  })
  return texture
}

/** Chain-link fencing: a diamond wire pattern you can see and shoot through. */
function chainLink(): MeshStandardMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const c = canvas.getContext('2d')!
  c.strokeStyle = '#aeb6c0'
  c.lineWidth = 5
  for (let offset = -128; offset <= 256; offset += 32) {
    c.beginPath()
    c.moveTo(offset, 0)
    c.lineTo(offset + 128, 128)
    c.moveTo(offset, 128)
    c.lineTo(offset + 128, 0)
    c.stroke()
  }
  const wire = new CanvasTexture(canvas)
  wire.wrapS = RepeatWrapping
  wire.wrapT = RepeatWrapping
  wire.colorSpace = SRGBColorSpace
  return new MeshStandardMaterial({ map: wire, alphaTest: 0.4, transparent: false, side: DoubleSide, metalness: 0.8, roughness: 0.45, vertexColors: true })
}

/** Builds every wall and floor material once, at start-up. */
export function createSurfaceMaterials(anisotropy: number): SurfaceMaterials {
  const loader = new TextureLoader()
  const door = photoMaterial('wood', loader, anisotropy)
  door.color = new Color(0.42, 0.36, 0.32)
  return {
    brick: photoMaterial('brick', loader, anisotropy),
    concrete: photoMaterial('concrete', loader, anisotropy),
    reinforced: photoMaterial('reinforced', loader, anisotropy),
    steel: photoMaterial('steel', loader, anisotropy),
    dirt: photoMaterial('dirt', loader, anisotropy),
    wood: photoMaterial('wood', loader, anisotropy),
    asphalt: photoMaterial('asphalt', loader, anisotropy),
    plaster: photoMaterial('plaster', loader, anisotropy),
    // No photo set for bedrock, so that one is generated.
    rock: bakeMaterial(rock, anisotropy),
    door,
    glass: new MeshPhysicalMaterial({ color: 0x9fd0e6, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, envMapIntensity: 1.5 }),
    fence: chainLink(),
    water: new MeshStandardMaterial({ color: 0x1d4a55, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.72 }),
  }
}

/** How much rain smooths each outdoor ground surface: wet tarmac turns nearly glossy, earth much less. */
const SOAKS: Partial<Record<keyof SurfaceMaterials, number>> = { asphalt: 0.6, dirt: 0.3 }

/**
 * Rain-soaked ground (0 dry to 1 soaked): lower roughness so lamps and sky streak across the street.
 * Only a number on the material changes, so no shader is rebuilt.
 */
export function setWetness(materials: SurfaceMaterials, wetness: number): void {
  for (const [name, soak] of Object.entries(SOAKS)) {
    const material = materials[name as keyof SurfaceMaterials]
    if (material instanceof MeshStandardMaterial) material.roughness = 1 - wetness * (soak ?? 0)
  }
}
