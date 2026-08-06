import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { DynamicDrawUsage, Object3D, type InstancedMesh } from 'three'
import { SIMULATION_STEP, type Enemy, type SimulationState } from '../game/combat'
import { hasEnemyStatusVisual, type EnemyStatusVisual } from '../game/statusVisuals'
import { getEnemyVisualScale } from '../game/enemyVisuals'

export const MAX_STATUS_VISUALS = 8192
const STATUS_ORDER: readonly EnemyStatusVisual[] = ['burn', 'slow', 'freeze', 'stun', 'brittle', 'armorBreak']

function interpolatedPosition(enemy: Enemy, interpolation: number): { x: number; z: number } {
  const previousX = enemy.previousX ?? enemy.x
  const previousZ = enemy.previousZ ?? enemy.z
  return { x: previousX + (enemy.x - previousX) * interpolation, z: previousZ + (enemy.z - previousZ) * interpolation }
}

export function OrcStatusEffects({ simulation, reducedFlashes }: { simulation: SimulationState; reducedFlashes: boolean }) {
  const burn = useRef<InstancedMesh>(null)
  const slow = useRef<InstancedMesh>(null)
  const freeze = useRef<InstancedMesh>(null)
  const stun = useRef<InstancedMesh>(null)
  const brittle = useRef<InstancedMesh>(null)
  const armorBreak = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const refs = { burn, slow, freeze, stun, brittle, armorBreak }

  useEffect(() => {
    for (const status of STATUS_ORDER) refs[status].current?.instanceMatrix.setUsage(DynamicDrawUsage)
  }, [])

  useFrame(() => {
    if (STATUS_ORDER.some((status) => !refs[status].current)) return
    const counts: Record<EnemyStatusVisual, number> = { burn: 0, slow: 0, freeze: 0, stun: 0, brittle: 0, armorBreak: 0 }
    const interpolation = Math.min(1, simulation.accumulator / SIMULATION_STEP)

    for (const enemy of simulation.enemies) {
      const position = interpolatedPosition(enemy, interpolation)
      const scale = getEnemyVisualScale(enemy.kind)
      for (const status of STATUS_ORDER) {
        if (!hasEnemyStatusVisual(enemy.status, status)) continue
        const index = counts[status]
        if (index >= MAX_STATUS_VISUALS) continue
        const pulse = reducedFlashes ? 1 : 1 + Math.sin(simulation.elapsedSeconds * (status === 'burn' ? 5 : 3) + enemy.id) * 0.08
        dummy.rotation.set(0, 0, 0)
        if (status === 'slow') {
          dummy.position.set(position.x, 0.045, position.z)
          dummy.rotation.set(-Math.PI / 2, 0, 0)
          dummy.scale.setScalar(scale * pulse)
        } else if (status === 'freeze') {
          dummy.position.set(position.x, 0.72 * scale, position.z)
          dummy.rotation.set(0, simulation.elapsedSeconds * 0.35 + enemy.id, 0)
          dummy.scale.set(scale * 0.48, scale * 0.82, scale * 0.48)
        } else if (status === 'burn') {
          dummy.position.set(position.x, 1.18 * scale, position.z)
          dummy.rotation.set(0, enemy.id * 1.7, Math.PI)
          dummy.scale.set(scale * 0.32 * pulse, scale * 0.52 * pulse, scale * 0.32 * pulse)
        } else if (status === 'stun') {
          dummy.position.set(position.x, 1.42 * scale, position.z)
          dummy.rotation.set(Math.PI / 2, 0, simulation.elapsedSeconds * 3 + enemy.id)
          dummy.scale.setScalar(scale * 0.34 * pulse)
        } else if (status === 'brittle') {
          dummy.position.set(position.x - 0.28 * scale, 1.24 * scale, position.z)
          dummy.rotation.set(simulation.elapsedSeconds * 1.8, enemy.id, 0.45)
          dummy.scale.setScalar(scale * 0.25)
        } else {
          dummy.position.set(position.x + 0.3 * scale, 1.22 * scale, position.z)
          dummy.rotation.set(0, -Math.PI / 4, simulation.elapsedSeconds * 0.6)
          dummy.scale.set(scale * 0.3, scale * 0.38, scale * 0.12)
        }
        dummy.updateMatrix()
        refs[status].current!.setMatrixAt(index, dummy.matrix)
        counts[status] += 1
      }
    }

    for (const status of STATUS_ORDER) {
      const mesh = refs[status].current!
      mesh.count = counts[status]
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return <>
    <instancedMesh ref={slow} args={[undefined, undefined, MAX_STATUS_VISUALS]} count={0} frustumCulled={false}>
      <ringGeometry args={[0.34, 0.46, 14]} /><meshBasicMaterial color="#53cfe8" transparent opacity={0.72} depthWrite={false} />
    </instancedMesh>
    <instancedMesh ref={freeze} args={[undefined, undefined, MAX_STATUS_VISUALS]} count={0} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#b9f6ff" wireframe transparent opacity={0.78} depthWrite={false} />
    </instancedMesh>
    <instancedMesh ref={burn} args={[undefined, undefined, MAX_STATUS_VISUALS]} count={0} frustumCulled={false}>
      <coneGeometry args={[1, 1.8, 5]} /><meshBasicMaterial color="#ff7a2f" transparent opacity={0.86} depthWrite={false} toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={stun} args={[undefined, undefined, MAX_STATUS_VISUALS]} count={0} frustumCulled={false}>
      <torusGeometry args={[0.75, 0.2, 4, 8]} /><meshBasicMaterial color="#ffe66d" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={brittle} args={[undefined, undefined, MAX_STATUS_VISUALS]} count={0} frustumCulled={false}>
      <tetrahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#d5b5ff" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={armorBreak} args={[undefined, undefined, MAX_STATUS_VISUALS]} count={0} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#ff655d" wireframe transparent opacity={0.9} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  </>
}
