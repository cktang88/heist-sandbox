import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { DynamicDrawUsage, Object3D, type InstancedMesh } from 'three'
import { SIMULATION_STEP, type Enemy, type SimulationState } from '../game/combat'
import type { EnemyKind } from '../game/types'
import { hasEnemyAccessory } from '../game/enemyVisuals'

const MAX_ROLE_ACCESSORIES = 8192
type AccessoryKind = Exclude<EnemyKind, 'grunt' | 'runner' | 'brute' | 'ogre'>
const ACCESSORIES: readonly AccessoryKind[] = ['shieldbearer', 'armored', 'shaman', 'banner', 'sapper', 'berserker']

function position(enemy: Enemy, interpolation: number): { x: number; z: number } {
  const previousX = enemy.previousX ?? enemy.x
  const previousZ = enemy.previousZ ?? enemy.z
  return { x: previousX + (enemy.x - previousX) * interpolation, z: previousZ + (enemy.z - previousZ) * interpolation }
}

/** Shape-coded role equipment keeps elite orcs readable without per-orc React objects. */
export function OrcRoleAccessories({ simulation }: { simulation: SimulationState }) {
  const shieldbearer = useRef<InstancedMesh>(null)
  const armored = useRef<InstancedMesh>(null)
  const shaman = useRef<InstancedMesh>(null)
  const banner = useRef<InstancedMesh>(null)
  const sapper = useRef<InstancedMesh>(null)
  const berserker = useRef<InstancedMesh>(null)
  const refs = { shieldbearer, armored, shaman, banner, sapper, berserker }
  const dummy = useMemo(() => new Object3D(), [])

  useEffect(() => {
    for (const kind of ACCESSORIES) refs[kind].current?.instanceMatrix.setUsage(DynamicDrawUsage)
  }, [])

  useFrame(() => {
    if (ACCESSORIES.some((kind) => !refs[kind].current)) return
    const counts: Record<AccessoryKind, number> = { shieldbearer: 0, armored: 0, shaman: 0, banner: 0, sapper: 0, berserker: 0 }
    const interpolation = Math.min(1, simulation.accumulator / SIMULATION_STEP)
    for (const enemy of simulation.enemies) {
      if (!hasEnemyAccessory(enemy.kind)) continue
      const kind = enemy.kind as AccessoryKind
      const index = counts[kind]
      if (index >= MAX_ROLE_ACCESSORIES) continue
      const point = position(enemy, interpolation)
      const facingX = enemy.facingX ?? 1
      const facingZ = enemy.facingZ ?? 0
      const yaw = Math.atan2(-facingZ, facingX)
      dummy.rotation.set(0, yaw, 0)
      dummy.scale.setScalar(1)
      if (kind === 'shieldbearer') {
        dummy.position.set(point.x + facingX * 0.28, 0.66, point.z + facingZ * 0.28)
        dummy.scale.set(1, 1, 1)
      } else if (kind === 'armored') {
        dummy.position.set(point.x, 0.72, point.z)
        dummy.rotation.set(0, yaw + Math.PI / 4, 0)
        dummy.scale.set(0.5, 0.72, 0.5)
      } else if (kind === 'shaman') {
        dummy.position.set(point.x - facingX * 0.22, 1.35, point.z - facingZ * 0.22)
        dummy.rotation.set(simulation.elapsedSeconds * 1.4, yaw, 0)
        dummy.scale.setScalar(0.18)
      } else if (kind === 'banner') {
        dummy.position.set(point.x - facingX * 0.18, 1.18, point.z - facingZ * 0.18)
        dummy.scale.set(0.12, 1.15, 0.52)
      } else if (kind === 'sapper') {
        dummy.position.set(point.x - facingX * 0.24, 0.7, point.z - facingZ * 0.24)
        dummy.scale.set(0.34, 0.42, 0.42)
      } else {
        dummy.position.set(point.x, 1.17, point.z)
        dummy.rotation.set(0, yaw, Math.PI)
        dummy.scale.set(0.38, 0.32, 0.38)
      }
      dummy.updateMatrix()
      refs[kind].current!.setMatrixAt(index, dummy.matrix)
      counts[kind] += 1
    }
    for (const kind of ACCESSORIES) {
      const mesh = refs[kind].current!
      mesh.count = counts[kind]
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return <>
    <instancedMesh ref={shieldbearer} args={[undefined, undefined, MAX_ROLE_ACCESSORIES]} count={0} frustumCulled={false}>
      <boxGeometry args={[0.12, 0.72, 0.62]} /><meshStandardMaterial color="#a5b0ad" metalness={0.65} roughness={0.45} />
    </instancedMesh>
    <instancedMesh ref={armored} args={[undefined, undefined, MAX_ROLE_ACCESSORIES]} count={0} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#555e62" metalness={0.78} roughness={0.38} />
    </instancedMesh>
    <instancedMesh ref={shaman} args={[undefined, undefined, MAX_ROLE_ACCESSORIES]} count={0} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} /><meshBasicMaterial color="#66e7ed" toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={banner} args={[undefined, undefined, MAX_ROLE_ACCESSORIES]} count={0} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#dc493f" roughness={0.82} />
    </instancedMesh>
    <instancedMesh ref={sapper} args={[undefined, undefined, MAX_ROLE_ACCESSORIES]} count={0} frustumCulled={false}>
      <sphereGeometry args={[1, 7, 5]} /><meshStandardMaterial color="#e59a32" emissive="#6d2d12" emissiveIntensity={0.35} />
    </instancedMesh>
    <instancedMesh ref={berserker} args={[undefined, undefined, MAX_ROLE_ACCESSORIES]} count={0} frustumCulled={false}>
      <coneGeometry args={[1, 1.8, 4]} /><meshStandardMaterial color="#ff6045" emissive="#63170f" emissiveIntensity={0.3} />
    </instancedMesh>
  </>
}
