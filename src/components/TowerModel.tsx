import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, Mesh } from 'three'
import type { SimulationState } from '../game/combat'
import type { Placement, Point, TowerKind } from '../game/types'
import { getTowerMuzzle, TOWER_VISUAL_SCALE } from '../game/towerMuzzle'
import { getTowerVariant, type TowerVariantDefinition, type TowerVariantVisual } from '../game/towerVariants'

const FAMILY_COLORS: Record<TowerKind, readonly [string, string]> = {
  gunner: ['#4f5650', '#b7a45c'], heavyGun: ['#303a3a', '#c88445'], cannon: ['#383d3c', '#bd6d42'],
  rocket: ['#363b38', '#a95f3d'], flamethrower: ['#4b3d31', '#d65735'], cryo: ['#3b5960', '#84d8df'],
  tesla: ['#3f4057', '#a685ee'], laser: ['#4c3436', '#f05f67'], mortar: ['#41443d', '#ac8d55'],
  support: ['#3a5144', '#74d69b'],
}

type TowerPlacement = Placement & { kind: TowerKind }

export function TowerModel({ tower, target, simulation }: { tower: TowerPlacement; target?: Point; simulation?: SimulationState }) {
  const weaponMount = useRef<Group>(null)
  const muzzleFlash = useRef<Mesh>(null)
  const kind = tower.kind
  const angle = target ? -Math.atan2(target.z - tower.z, target.x - tower.x) : -(tower.rotation ?? 0)
  const colors = FAMILY_COLORS[kind]
  const variant = getTowerVariant(kind, tower.variantId)
  const muzzle = getTowerMuzzle(kind)

  useFrame(() => {
    if (!weaponMount.current || !muzzleFlash.current || !simulation) return
    const age = simulation.elapsedSeconds - (simulation.towerLastShotAt.get(tower.id) ?? -100)
    const kick = age >= 0 && age < 0.16 ? Math.sin(age / 0.16 * Math.PI) : 0
    const weight = kind === 'mortar' || kind === 'cannon' ? 0.2 : kind === 'rocket' ? 0.14 : 0.07
    weaponMount.current.position.x = -kick * weight
    muzzleFlash.current.visible = age >= 0 && age < 0.065
    muzzleFlash.current.scale.setScalar(0.8 + Math.max(0, 1 - age / 0.065) * 0.65)
  })

  return <group position={[tower.x, 0, tower.z]} scale={TOWER_VISUAL_SCALE}>
    {variant && <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.6, 0.72, 18]} />
      <meshStandardMaterial color={variant.accent} emissive={variant.accent} emissiveIntensity={0.35} />
    </mesh>}
    <mesh position={[0, 0.22, 0]}>
      <cylinderGeometry args={[0.48, 0.58, 0.44, 10]} />
      <meshStandardMaterial color={colors[0]} metalness={0.45} roughness={0.7} />
    </mesh>
    <group position={[0, 0.62, 0]} rotation={[0, angle, 0]}>
      <TowerHead kind={kind} color={colors[1]} />
      <group ref={weaponMount}>
        <TowerWeapon kind={kind} />
        {variant && <VariantAttachment variant={variant} />}
        <mesh ref={muzzleFlash} visible={false} position={[muzzle.forward / TOWER_VISUAL_SCALE, muzzle.height / TOWER_VISUAL_SCALE - 0.62, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.13, 0.42, 6]} />
          <meshBasicMaterial color={muzzle.color} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  </group>
}

function TowerHead({ kind, color }: { kind: TowerKind; color: string }) {
  if (kind === 'heavyGun') return <mesh><boxGeometry args={[0.58, 0.42, 0.5]} /><meshStandardMaterial color={color} metalness={0.45} /></mesh>
  if (kind === 'rocket') return <mesh><boxGeometry args={[0.58, 0.4, 0.66]} /><meshStandardMaterial color={color} metalness={0.4} /></mesh>
  if (kind === 'support') return <mesh><cylinderGeometry args={[0.28, 0.34, 0.36, 8]} /><meshStandardMaterial color={color} metalness={0.3} /></mesh>
  return <mesh><sphereGeometry args={[0.31, 10, 8]} /><meshStandardMaterial color={color} metalness={0.35} /></mesh>
}

const barrel = (radius: number, length: number, z = 0) => <mesh position={[0.64, 0, z]} rotation={[0, 0, Math.PI / 2]}>
  <cylinderGeometry args={[radius, radius * 1.35, length, 8]} /><meshStandardMaterial color="#292d2c" metalness={0.8} />
</mesh>

function TowerWeapon({ kind }: { kind: TowerKind }) {
  if (kind === 'gunner') return <group>{barrel(0.065, 0.95)}<mesh position={[0.18, -0.22, 0]}><boxGeometry args={[0.3, 0.28, 0.28]} /><meshStandardMaterial color="#6d593b" /></mesh></group>
  if (kind === 'heavyGun') return <group>{barrel(0.075, 0.92, -0.1)}{barrel(0.075, 0.92, 0.1)}<mesh position={[0.2, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.22, 0.22, 0.2, 10]} /><meshStandardMaterial color="#574736" /></mesh></group>
  if (kind === 'cannon') return <group>{barrel(0.14, 0.82)}<mesh position={[0.28, 0, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.18, 0.055, 6, 12]} /><meshStandardMaterial color="#1f2322" metalness={0.8} /></mesh></group>
  if (kind === 'rocket') return <group position={[0.48, 0, 0]}>{[-0.16, 0.16].map((z) => <mesh key={z} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.11, 0.15, 0.82, 8]} /><meshStandardMaterial color="#2b302f" metalness={0.8} /></mesh>)}</group>
  if (kind === 'flamethrower') return <group>{barrel(0.1, 0.72)}<mesh position={[0.3, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.18, 0.18, 0.32, 8]} /><meshStandardMaterial color="#7d3f2c" /></mesh></group>
  if (kind === 'cryo') return <group>{barrel(0.07, 0.86)}{[-0.13, 0.13].map((z) => <mesh key={z} position={[0.86, 0, z]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.07, 0.36, 5]} /><meshStandardMaterial color="#b5f6ff" emissive="#4bb4c8" emissiveIntensity={0.5} /></mesh>)}</group>
  if (kind === 'tesla') return <group>{[-0.18, 0, 0.18].map((z) => <mesh key={z} position={[0, 0.3, z]}><coneGeometry args={[0.07, 0.65, 6]} /><meshStandardMaterial color="#c9afff" emissive="#6040aa" emissiveIntensity={0.6} /></mesh>)}</group>
  if (kind === 'laser') return <group position={[0.45, 0, 0]}><mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.09, 0.14, 0.72, 8]} /><meshStandardMaterial color="#292d2c" metalness={0.8} /></mesh><mesh position={[0.43, 0, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[0.12, 0.32, 6]} /><meshStandardMaterial color="#ff7a83" emissive="#8c1f2b" emissiveIntensity={0.7} /></mesh></group>
  if (kind === 'mortar') return <group><mesh position={[0.32, 0.2, 0]} rotation={[0, 0, Math.PI / 3]}><cylinderGeometry args={[0.16, 0.2, 0.8, 10]} /><meshStandardMaterial color="#292d2c" metalness={0.8} /></mesh><mesh position={[-0.12, -0.18, 0]}><boxGeometry args={[0.45, 0.18, 0.5]} /><meshStandardMaterial color="#5f5742" /></mesh></group>
  return <group><mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.06, 0.09, 0.78, 8]} /><meshStandardMaterial color="#b7ddbc" /></mesh><mesh position={[0, 0.72, 0]}><octahedronGeometry args={[0.18]} /><meshStandardMaterial color="#77e2a1" emissive="#245f3c" /></mesh></group>
}

function VariantAttachment({ variant }: { variant: TowerVariantDefinition }) {
  return <group>{variantGeometry(variant.visual, variant.accent)}</group>
}

function variantGeometry(visual: TowerVariantVisual, accent: string) {
  const material = <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.42} metalness={0.35} />
  if (visual === 'longBarrel') return <mesh position={[0.72, 0.11, 0]} rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.11, 0.72, 0.11]} />{material}</mesh>
  if (visual === 'drumFeed') return <mesh position={[0.18, 0.08, 0.34]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.24, 0.24, 0.22, 10]} />{material}</mesh>
  if (visual === 'muzzleBrake') return <mesh position={[1.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.14, 0.14, 0.2, 6]} />{material}</mesh>
  if (visual === 'tripleBarrel') return <mesh position={[0.76, 0.14, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.06, 0.06, 0.65, 6]} />{material}</mesh>
  if (visual === 'denseShell') return <mesh position={[0.38, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[0.13, 0.42, 8]} />{material}</mesh>
  if (visual === 'clusterRack') return <group>{[-0.2, 0, 0.2].map((z) => <mesh key={z} position={[0.15, 0.22, z]}><sphereGeometry args={[0.11, 6, 4]} />{material}</mesh>)}</group>
  if (visual === 'seeker') return <mesh position={[0.8, 0.22, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.16, 0.42, 8]} />{material}</mesh>
  if (visual === 'quadTubes') return <group>{[-0.2, 0.2].flatMap((y) => [-0.24, 0.24].map((z) => <mesh key={`${y}-${z}`} position={[0.45, y, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.075, 0.09, 0.6, 7]} />{material}</mesh>))}</group>
  if (visual === 'fuelTank') return <mesh position={[-0.18, 0.08, 0.36]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.24, 0.24, 0.54, 8]} />{material}</mesh>
  if (visual === 'forkedNozzle') return <group>{[-0.15, 0.15].map((z) => <mesh key={z} position={[0.78, 0, z]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.11, 0.42, 6]} />{material}</mesh>)}</group>
  if (visual === 'crystal') return <mesh position={[0.2, 0.36, 0]}><octahedronGeometry args={[0.24]} />{material}</mesh>
  if (visual === 'twinProngs') return <group>{[-0.2, 0.2].map((z) => <mesh key={z} position={[0.62, 0.18, z]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.08, 0.6, 5]} />{material}</mesh>)}</group>
  if (visual === 'stunRings') return <group>{[0.22, 0.46].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.22, 0.045, 6, 12]} />{material}</mesh>)}</group>
  if (visual === 'overchargeOrb') return <mesh position={[0, 0.62, 0]}><icosahedronGeometry args={[0.24, 1]} />{material}</mesh>
  if (visual === 'focusLens') return <mesh position={[0.86, 0, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.16, 0.055, 8, 14]} />{material}</mesh>
  if (visual === 'prism') return <group>{[-0.17, 0, 0.17].map((z) => <mesh key={z} position={[0.82, 0, z]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.08, 0.35, 3]} />{material}</mesh>)}</group>
  if (visual === 'blastCollar') return <mesh position={[0.68, 0.46, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.22, 0.08, 7, 14]} />{material}</mesh>
  if (visual === 'shellRack') return <group>{[-0.3, 0.3].map((z) => <mesh key={z} position={[-0.2, 0.22, z]} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.08, 0.28, 2, 5]} />{material}</mesh>)}</group>
  if (visual === 'turbine') return <mesh position={[0, 0.32, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.34, 0.08, 6, 12]} />{material}</mesh>
  return <group>{[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((rotation) => <mesh key={rotation} position={[Math.cos(rotation) * 0.4, 0.28, Math.sin(rotation) * 0.4]} rotation={[0, -rotation, 0]}><boxGeometry args={[0.1, 0.42, 0.3]} />{material}</mesh>)}</group>
}
