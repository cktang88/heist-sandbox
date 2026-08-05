import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Object3D, type InstancedMesh } from 'three'

export type FortressDamageStage = 'intact' | 'worn' | 'critical' | 'ruined'

export function fortressDamageStage(healthRatio: number): FortressDamageStage {
  if (healthRatio <= 0) return 'ruined'
  if (healthRatio < 0.3) return 'critical'
  if (healthRatio < 0.7) return 'worn'
  return 'intact'
}

export function FortressDamageEffects({ healthRatio, reducedFlashes }: { healthRatio: number; reducedFlashes: boolean }) {
  const smoke = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const stage = fortressDamageStage(healthRatio)
  const smokeCount = stage === 'critical' || stage === 'ruined' ? (reducedFlashes ? 3 : 7) : stage === 'worn' ? 2 : 0
  useFrame(({ clock }) => {
    if (!smoke.current) return
    for (let index = 0; index < smokeCount; index += 1) {
      const phase = (clock.elapsedTime * (0.28 + index * 0.025) + index / smokeCount) % 1
      dummy.position.set(-0.5 + (index % 3) * 0.24 + Math.sin(clock.elapsedTime + index) * 0.08, 1.05 + phase * 1.55, -0.55 + (index % 2) * 0.32)
      dummy.scale.setScalar(0.14 + phase * 0.28)
      dummy.rotation.set(0, index, 0)
      dummy.updateMatrix()
      smoke.current.setMatrixAt(index, dummy.matrix)
    }
    smoke.current.count = smokeCount
    smoke.current.instanceMatrix.needsUpdate = true
  })
  if (stage === 'intact') return null
  return <>
    <group position={[0, 0.64, 1.37]} rotation={[0, 0, -0.22]}>
      <mesh position={[-0.28, 0.12, 0]}><boxGeometry args={[0.06, 0.72, 0.025]} /><meshBasicMaterial color="#2a2925" /></mesh>
      <mesh position={[0.18, -0.08, 0]} rotation={[0, 0, 0.6]}><boxGeometry args={[0.055, 0.58, 0.025]} /><meshBasicMaterial color="#2a2925" /></mesh>
    </group>
    <group position={[0, 0.08, 1.1]}>
      {Array.from({ length: stage === 'worn' ? 3 : 7 }, (_, index) => <mesh key={index} position={[(index % 4 - 1.5) * 0.35, (index % 2) * 0.07, Math.floor(index / 4) * 0.28]} rotation={[index * 0.3, index * 0.8, index * 0.5]}>
        <boxGeometry args={[0.28, 0.16, 0.22]} /><meshStandardMaterial color="#55564f" roughness={1} />
      </mesh>)}
    </group>
    <instancedMesh ref={smoke} args={[undefined, undefined, 7]} frustumCulled={false}>
      <sphereGeometry args={[1, 7, 5]} /><meshBasicMaterial color="#5c5d56" transparent opacity={0.24} depthWrite={false} />
    </instancedMesh>
    {(stage === 'critical' || stage === 'ruined') && !reducedFlashes && <pointLight position={[0, 0.72, 0.8]} color="#e76432" intensity={1.1} distance={2.2} />}
  </>
}
