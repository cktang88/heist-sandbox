import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, Object3D, type InstancedMesh } from 'three'
import { MAX_CORPSE_VISUALS, MAX_TRANSIENT_VISUALS, type SimulationState } from '../game/combat'
import type { GameSettings } from '../game/settings'

const MAX_TRACERS = 2048
const MAX_PARTICLES = 512
const CORPSE_LIMIT = { off: 0, low: 64, high: MAX_CORPSE_VISUALS } as const
const TRACER_COLORS = {
  cryo: new Color('#8ee8f2'), flamethrower: new Color('#ff6637'), cannon: new Color('#ffb14f'),
  rocket: new Color('#ef7c45'), mortar: new Color('#e9b36b'), default: new Color('#ffe585'),
}
const CORPSE_COLORS = {
  ogre: new Color('#35452b'), brute: new Color('#304027'), runner: new Color('#435638'), default: new Color('#304027'),
}

export function corpseVisualLimit(density: GameSettings['corpseDensity']): number { return CORPSE_LIMIT[density] }
export function newestVisualStart(total: number, limit: number): number { return Math.max(0, total - Math.max(0, limit)) }

export function ProjectilePool({ simulation }: { simulation: SimulationState }) {
  const beams = useRef<InstancedMesh>(null)
  const shells = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  useFrame(() => {
    if (!beams.current || !shells.current) return
    let beamCount = 0
    let shellCount = 0
    const start = newestVisualStart(simulation.tracers.length, MAX_TRACERS)
    for (let index = start; index < simulation.tracers.length; index += 1) {
      const tracer = simulation.tracers[index]
      const dx = tracer.to.x - tracer.from.x
      const dz = tracer.to.z - tracer.from.z
      const length = Math.hypot(dx, dz)
      const progress = Math.max(0, Math.min(1, 1 - tracer.life / tracer.duration))
      const color = tracerColor(tracer.tower)
      if (tracer.arcHeight > 0 && shellCount < MAX_TRACERS) {
        dummy.position.set(
          tracer.from.x + dx * progress,
          0.72 + 4 * progress * (1 - progress) * tracer.arcHeight,
          tracer.from.z + dz * progress,
        )
        dummy.rotation.set(0, -Math.atan2(dz, dx), progress * 5)
        const scale = tracer.tower === 'mortar' ? 0.16 : tracer.tower === 'rocket' ? 0.13 : 0.1
        dummy.scale.set(scale * 1.8, scale, scale)
        dummy.updateMatrix()
        shells.current.setMatrixAt(shellCount, dummy.matrix)
        shells.current.setColorAt(shellCount, color)
        shellCount += 1
      } else if (beamCount < MAX_TRACERS) {
        const fade = Math.max(0.15, Math.min(1, tracer.life / tracer.duration))
        dummy.position.set((tracer.from.x + tracer.to.x) / 2, 0.65, (tracer.from.z + tracer.to.z) / 2)
        dummy.rotation.set(0, -Math.atan2(dz, dx), 0)
        dummy.scale.set(length, fade, fade)
        dummy.updateMatrix()
        beams.current.setMatrixAt(beamCount, dummy.matrix)
        beams.current.setColorAt(beamCount, color)
        beamCount += 1
      }
    }
    updateMesh(beams.current, beamCount, true)
    updateMesh(shells.current, shellCount, true)
  })
  return <>
    <instancedMesh ref={beams} args={[undefined, undefined, MAX_TRACERS]} frustumCulled={false}>
      <boxGeometry args={[1, 0.035, 0.035]} /><meshBasicMaterial vertexColors />
    </instancedMesh>
    <instancedMesh ref={shells} args={[undefined, undefined, MAX_TRACERS]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 4]} /><meshStandardMaterial vertexColors emissive="#4a2415" emissiveIntensity={0.45} />
    </instancedMesh>
  </>
}

export function CombatEffectPool({ simulation, corpseDensity, reducedFlashes }: {
  simulation: SimulationState
  corpseDensity: GameSettings['corpseDensity']
  reducedFlashes: boolean
}) {
  const corpses = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)
  const stains = useRef<InstancedMesh>(null)
  const bursts = useRef<InstancedMesh>(null)
  const debris = useRef<InstancedMesh>(null)
  const particles = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  useFrame(() => {
    if (!corpses.current || !heads.current || !stains.current || !bursts.current || !debris.current || !particles.current) return
    const corpseLimit = corpseVisualLimit(corpseDensity)
    let deathCount = 0
    let impactCount = 0
    let breakCount = 0
    let particleCount = 0
    for (let index = simulation.visuals.length - 1; index >= 0; index -= 1) {
      const visual = simulation.visuals[index]
      const age = Math.max(0, visual.duration - visual.life)
      if (visual.kind === 'death' && deathCount < corpseLimit) {
        const scale = visual.enemyKind === 'ogre' ? 1.5 : visual.enemyKind === 'brute' ? 1.1 : visual.enemyKind === 'runner' ? 0.72 : 0.9
        const rotation = visual.rotation ?? visual.id * 1.7
        dummy.position.set(visual.x, 0.09, visual.z)
        dummy.rotation.set(Math.PI / 2, -rotation, 0)
        dummy.scale.set(0.42 * scale, 0.18 * scale, 0.55 * scale)
        dummy.updateMatrix()
        corpses.current.setMatrixAt(deathCount, dummy.matrix)
        corpses.current.setColorAt(deathCount, corpseColor(visual.enemyKind))
        dummy.position.set(visual.x + Math.cos(rotation) * 0.38 * scale, 0.08, visual.z + Math.sin(rotation) * 0.38 * scale)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(0.2 * scale)
        dummy.updateMatrix()
        heads.current.setMatrixAt(deathCount, dummy.matrix)
        dummy.position.set(visual.x, 0.015, visual.z)
        dummy.rotation.set(-Math.PI / 2, 0, rotation)
        dummy.scale.set(0.55 * scale, 0.36 * scale, 1)
        dummy.updateMatrix()
        stains.current.setMatrixAt(deathCount, dummy.matrix)
        deathCount += 1
      } else if (visual.kind === 'impact' && impactCount < MAX_TRANSIENT_VISUALS) {
        const amount = reducedFlashes ? 0.18 : Math.max(0, visual.life / visual.duration)
        dummy.position.set(visual.x, 0.15, visual.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(0.18 + amount * 0.4)
        dummy.updateMatrix()
        bursts.current.setMatrixAt(impactCount++, dummy.matrix)
        const sparkCount = reducedFlashes ? 1 : 4
        for (let spark = 0; spark < sparkCount && particleCount < MAX_PARTICLES; spark += 1) {
          setParticle(dummy, visual.id, spark, visual.x, visual.z, age, visual.duration)
          particles.current.setMatrixAt(particleCount++, dummy.matrix)
        }
      } else if (visual.kind === 'wallBreak' && breakCount < MAX_TRANSIENT_VISUALS) {
        dummy.position.set(visual.x, 0.16 + age * 0.5, visual.z)
        dummy.rotation.set(visual.id + age * 5, visual.id * 0.7, visual.id * 0.4)
        dummy.scale.setScalar(0.25)
        dummy.updateMatrix()
        debris.current.setMatrixAt(breakCount++, dummy.matrix)
      }
    }
    updateMesh(corpses.current, deathCount, true)
    updateMesh(heads.current, deathCount)
    updateMesh(stains.current, deathCount)
    updateMesh(bursts.current, impactCount)
    updateMesh(debris.current, breakCount)
    updateMesh(particles.current, particleCount)
  })
  return <>
    <instancedMesh ref={stains} args={[undefined, undefined, MAX_CORPSE_VISUALS]} frustumCulled={false}>
      <circleGeometry args={[1, 10]} /><meshBasicMaterial color="#182019" transparent opacity={0.42} depthWrite={false} />
    </instancedMesh>
    <instancedMesh ref={corpses} args={[undefined, undefined, MAX_CORPSE_VISUALS]} frustumCulled={false}>
      <capsuleGeometry args={[0.22, 0.35, 2, 5]} /><meshStandardMaterial vertexColors roughness={1} />
    </instancedMesh>
    <instancedMesh ref={heads} args={[undefined, undefined, MAX_CORPSE_VISUALS]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 4]} /><meshStandardMaterial color="#5e7643" roughness={1} />
    </instancedMesh>
    <instancedMesh ref={bursts} args={[undefined, undefined, MAX_TRANSIENT_VISUALS]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 4]} /><meshBasicMaterial color="#ffc268" transparent opacity={reducedFlashes ? 0.15 : 0.42} depthWrite={false} />
    </instancedMesh>
    <instancedMesh ref={debris} args={[undefined, undefined, MAX_TRANSIENT_VISUALS]} frustumCulled={false}>
      <boxGeometry args={[0.55, 0.18, 0.2]} /><meshStandardMaterial color="#8c7149" roughness={1} />
    </instancedMesh>
    <instancedMesh ref={particles} args={[undefined, undefined, MAX_PARTICLES]} frustumCulled={false}>
      <tetrahedronGeometry args={[0.08, 0]} /><meshBasicMaterial color="#ffd27c" transparent opacity={reducedFlashes ? 0.35 : 0.82} depthWrite={false} />
    </instancedMesh>
  </>
}

function setParticle(dummy: Object3D, id: number, spark: number, x: number, z: number, age: number, duration: number): void {
  const angle = id * 2.399 + spark * 1.571
  const speed = 1.4 + ((id + spark * 3) % 5) * 0.22
  const life = Math.min(1, age / Math.max(0.01, duration))
  dummy.position.set(x + Math.cos(angle) * speed * age, 0.18 + Math.sin(life * Math.PI) * 0.65, z + Math.sin(angle) * speed * age)
  dummy.rotation.set(age * 8, angle, age * 5)
  dummy.scale.setScalar(Math.max(0.2, 1 - life))
  dummy.updateMatrix()
}

function tracerColor(kind: string): Color {
  return kind === 'cryo' ? TRACER_COLORS.cryo : kind === 'flamethrower' ? TRACER_COLORS.flamethrower
    : kind === 'cannon' ? TRACER_COLORS.cannon : kind === 'rocket' ? TRACER_COLORS.rocket
      : kind === 'mortar' ? TRACER_COLORS.mortar : TRACER_COLORS.default
}

function corpseColor(kind: string | undefined): Color {
  return kind === 'ogre' ? CORPSE_COLORS.ogre : kind === 'brute' ? CORPSE_COLORS.brute : kind === 'runner' ? CORPSE_COLORS.runner : CORPSE_COLORS.default
}

function updateMesh(mesh: InstancedMesh, count: number, colors = false): void {
  mesh.count = count
  mesh.instanceMatrix.needsUpdate = true
  if (colors && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}
