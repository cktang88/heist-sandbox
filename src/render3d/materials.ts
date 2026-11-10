import { Color, MeshPhysicalMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three'
import type { SurfaceMaterials } from './levelMesh'
import { rock } from './surfaces'
import { bakeMaterial } from './textures'

/** Photo-scanned surfaces in `public/textures` (ambientCG, CC0). `tilesAcross` is how many tiles one copy of the photo covers. */
const PHOTO = {
  brick: { tilesAcross: 2.6, metalness: 0, tint: 0xffffff },
  concrete: { tilesAcross: 4, metalness: 0, tint: 0xd8d8d8 },
  plaster: { tilesAcross: 5, metalness: 0, tint: 0x8d99a8 },
  steel: { tilesAcross: 3, metalness: 1, tint: 0xb9c0c8 },
  wood: { tilesAcross: 2, metalness: 0, tint: 0xa89888 },
  dirt: { tilesAcross: 4, metalness: 0, tint: 0xbfb3a6 },
  asphalt: { tilesAcross: 4, metalness: 0, tint: 0xffffff },
} as const

/** Level geometry uses UVs that repeat every two tiles; this rescales them per surface. */
const UV_TILES = 2

function photoMaterial(name: keyof typeof PHOTO, loader: TextureLoader, anisotropy: number): MeshStandardMaterial {
  const spec = PHOTO[name]
  const load = (file: string, isColor: boolean): Texture => {
    const map = loader.load(`${import.meta.env.BASE_URL}textures/${name}/${file}.jpg`)
    map.wrapS = RepeatWrapping
    map.wrapT = RepeatWrapping
    map.repeat.setScalar(UV_TILES / spec.tilesAcross)
    map.anisotropy = anisotropy
    if (isColor) map.colorSpace = SRGBColorSpace
    return map
  }
  return new MeshStandardMaterial({
    map: load('color', true),
    normalMap: load('normal', false),
    roughnessMap: load('rough', false),
    color: new Color(spec.tint),
    roughness: 1,
    metalness: spec.metalness,
    vertexColors: true,
  })
}

/** Builds every wall and floor material once, at start-up. */
export function createSurfaceMaterials(anisotropy: number): SurfaceMaterials {
  const loader = new TextureLoader()
  const door = photoMaterial('wood', loader, anisotropy)
  door.color = new Color(0.42, 0.36, 0.32)
  return {
    brick: photoMaterial('brick', loader, anisotropy),
    concrete: photoMaterial('concrete', loader, anisotropy),
    steel: photoMaterial('steel', loader, anisotropy),
    dirt: photoMaterial('dirt', loader, anisotropy),
    wood: photoMaterial('wood', loader, anisotropy),
    asphalt: photoMaterial('asphalt', loader, anisotropy),
    plaster: photoMaterial('plaster', loader, anisotropy),
    // No photo set for bedrock, so that one is generated.
    rock: bakeMaterial(rock, anisotropy),
    door,
    glass: new MeshPhysicalMaterial({ color: 0x9fd0e6, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, envMapIntensity: 1.5 }),
    water: new MeshStandardMaterial({ color: 0x1d4a55, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.72 }),
  }
}
