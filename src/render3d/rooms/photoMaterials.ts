import { CanvasTexture, LinearSRGBColorSpace, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three'
import { TEXTURES } from '../assetManifest'
import { ceramicTextures } from './art'

/**
 * Photo-scanned surfaces from `public/textures2` and `public/textures`, loaded once and shrunk on arrival.
 * A wall seen from this camera is about 30 pixels per tile and a photo repeats every two to four tiles,
 * so 512 texels is already more than the screen shows. Shrinking the 1024 originals cuts their video
 * memory by three quarters (all sets together stay well under 100 MB).
 */
const SIZE = 512

/** The sets the finishes use: ids from `TEXTURES`, plus the original sets under `public/textures` marked `old/`. */
export type PhotoSet =
  | 'Carpet012' | 'dirty_carpet' | 'herringbone_parquet' | 'laminate_floor_02' | 'marble_tiles' | 'terrazzo_tiles'
  | 'floor_tiles_06' | 'old_linoleum_flooring_01' | 'garage_floor' | 'concrete_floor_worn_001' | 'cracked_concrete'
  | 'DiamondPlate001' | 'metal_plate' | 'OfficeCeiling001' | 'painted_plaster_wall' | 'yellow_plaster' | 'decrepit_wallpaper'
  | 'dark_paneled_wood' | 'preconcrete_wall_001' | 'painted_brick' | 'red_brick_03'
  | 'rusty_painted_metal' | 'rusty_metal_02' | 'corrugated_iron' | 'asphalt_02'
  | 'old/concrete' | 'old/brick' | 'old/plaster' | 'old/steel'
  | 'ceramic'

export type PhotoSpec = { set: PhotoSet; rough: number; metal?: number; normal?: number }

let ceramicMaps: ReturnType<typeof ceramicTextures> | null = null
function ceramic(): ReturnType<typeof ceramicTextures> {
  ceramicMaps ??= ceramicTextures()
  return ceramicMaps
}

function folderOf(set: PhotoSet): string {
  if (set.startsWith('old/')) return `textures/${set.slice(4)}`
  return TEXTURES.find((texture) => texture.id === set)!.dir
}

/** A texture that starts as a flat colour and fills in when its picture arrives. */
function lazyTexture(url: string, placeholder: string, isColor: boolean): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const context = canvas.getContext('2d')!
  context.fillStyle = placeholder
  context.fillRect(0, 0, SIZE, SIZE)
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.colorSpace = isColor ? SRGBColorSpace : LinearSRGBColorSpace
  texture.anisotropy = 4
  const image = new Image()
  image.onload = () => {
    context.drawImage(image, 0, 0, SIZE, SIZE)
    texture.needsUpdate = true
  }
  image.src = `${import.meta.env.BASE_URL}${url}`
  return texture
}

const textures = new Map<string, CanvasTexture>()
function shared(url: string, placeholder: string, isColor: boolean): CanvasTexture {
  return textures.get(url) ?? textures.set(url, lazyTexture(url, placeholder, isColor)).get(url)!
}

const materials = new Map<string, MeshStandardMaterial>()

/**
 * One material per photo set and finish. Paint colours come from per-corner colours (vertex colours),
 * so twenty differently painted offices still share a single material and draw call.
 */
export function photoMaterial(spec: PhotoSpec): MeshStandardMaterial {
  const key = `${spec.set}:${spec.rough}:${spec.metal ?? 0}:${spec.normal ?? 1}`
  const known = materials.get(key)
  if (known) return known
  // There is no photo of plain small wall tiles among the sets, so those are drawn.
  const maps = spec.set === 'ceramic' ? ceramic() : { color: shared(`${folderOf(spec.set)}/color.jpg`, '#808080', true), normal: shared(`${folderOf(spec.set)}/normal.jpg`, '#8080ff', false) }
  const material = new MeshStandardMaterial({
    map: maps.color,
    normalMap: maps.normal,
    roughness: spec.rough,
    metalness: spec.metal ?? 0,
    vertexColors: true,
  })
  material.normalScale.setScalar(spec.normal ?? 1)
  materials.set(key, material)
  return material
}

export function photoMaterialCount(): number {
  return materials.size
}
