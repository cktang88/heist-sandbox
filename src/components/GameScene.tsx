import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Color, Object3D, type InstancedMesh } from 'three'
import { BUILD, isTowerKind } from '../game/config'
import { isValidPlacement } from '../game/placement'
import { addPower, barrageImpactPoint, createSimulation, findTowerTarget, getSimulationTelemetry, guideActivePower, interpolatedEnemyPosition, isRunWon, SIMULATION_STEP, spawnStressEnemies, stepSimulation, syncWalls, toSnapshot, type Enemy, type PowerRun, type SimulationState } from '../game/combat'
import { buildPathInfo, distance, distanceToPath, pointAlongPath } from '../game/path'
import { resolvePowerLine } from '../game/powerTargeting'
import type { ActivePowerKind, BattleSnapshot, BuildTool, CombatPower, EnemyKind, GameRules, MapDecoration, MapDefinition, MapSecondaryObjective, Placement, Point, PowerCommand, PowerDefinition, RunRules } from '../game/types'
import { deriveWallRotation, wallVisualLength } from '../game/wall'
import { consumeCombatAudioEvents, createCombatAudioState, playSound } from '../game/audio'
import type { GameSettings } from '../game/settings'

export type StressCommand = { id: number; count: number; kind?: EnemyKind }

type GameSceneProps = {
  map: MapDefinition
  run: RunRules
  rules: GameRules
  reducedFlashes: boolean
  screenShake: boolean
  settings: GameSettings
  placements: Placement[]
  selectedPlacementId: number | null
  movingPlacement: Placement | null
  phase: 'setup' | 'battle' | 'victory' | 'defeat'
  selectedTool: BuildTool
  selectedPower: CombatPower | null
  powerCommand: PowerCommand | null
  stressCommand: StressCommand | null
  invulnerable: boolean
  paused: boolean
  speed: 1 | 2
  onPlace: (point: Point, lineEnd?: Point) => void
  onSelectPlacement: (id: number) => void
  onCancelSetupEdit: () => void
  onCancelPowerTarget: () => void
  onSnapshot: (snapshot: BattleSnapshot) => void
  onBattleEnd: (won: boolean, snapshot: BattleSnapshot) => void
  onWallRemoved: (id: number) => void
}

export function GameScene(props: GameSceneProps) {
  return (
    <Canvas
      orthographic
      dpr={[1, 1.6]}
      camera={{ position: [0, 15, 13], zoom: 55, near: 0.1, far: 60 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onContextMenu={(event) => {
        event.preventDefault()
        if (props.phase === 'setup') props.onCancelSetupEdit()
        if (props.phase === 'battle') props.onCancelPowerTarget()
      }}
      onCreated={({ camera }) => {
        camera.lookAt(0, 0, 0)
      }}
    >
      <color attach="background" args={[props.map.palette?.background ?? '#101811']} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[-5, 12, 6]} intensity={2.1} color="#fff2c2" />
      <World {...props} />
    </Canvas>
  )
}

function World(props: GameSceneProps) {
  const [pointer, setPointer] = useState<Point | null>(null)
  const [lineStart, setLineStart] = useState<Point | null>(null)
  const [lineEnd, setLineEnd] = useState<Point | null>(null)
  const suppressClick = useRef(false)
  const buildKind = props.movingPlacement?.kind ?? props.selectedTool
  const valid = pointer ? isValidPlacement(pointer, buildKind, props.placements, props.map) : false
  const isLanePower = props.phase === 'battle' && (props.selectedPower === 'strafe' || props.selectedPower === 'cryoBeam')

  useEffect(() => {
    if (!isLanePower) {
      setLineStart(null)
      setLineEnd(null)
    }
  }, [isLanePower])

  return (
    <>
      <Terrain map={props.map}
        onClick={(event) => {
          event.stopPropagation()
          if (suppressClick.current) {
            suppressClick.current = false
            return
          }
          props.onPlace({ x: event.point.x, z: event.point.z })
        }}
        onMove={(event) => {
          const point = { x: event.point.x, z: event.point.z }
          setPointer(point)
          if (lineStart) setLineEnd(point)
        }}
        onPointerDown={(event) => {
          if (!isLanePower) return
          event.stopPropagation()
          const point = { x: event.point.x, z: event.point.z }
          setLineStart(point)
          setLineEnd(point)
        }}
        onPointerUp={(event) => {
          if (!isLanePower || !lineStart) return
          event.stopPropagation()
          const released = { x: event.point.x, z: event.point.z }
          const line = resolvePowerLine(lineStart, released, props.map.width)
          suppressClick.current = true
          setLineStart(null)
          setLineEnd(null)
          props.onPlace(line.start, line.end)
        }}
      />
      <Path map={props.map} />
      <Fortress map={props.map} health={props.phase === 'battle' ? undefined : 100} />
      {props.phase === 'setup' && pointer && (
        <BuildPreview
          point={pointer}
          kind={buildKind}
          valid={valid}
          range={buildKind === 'wall' ? 0 : props.rules.tuning.towers[buildKind].range}
          minRange={buildKind === 'wall' ? 0 : props.rules.tuning.towers[buildKind].minRange}
          wallRotation={props.movingPlacement?.rotation ?? deriveWallRotation(props.map, pointer)}
          wallLength={props.rules.wall.length}
        />
      )}
      {props.phase === 'battle' && pointer && props.selectedPower && props.selectedPower !== 'wall' && (
        <PowerPreview
          kind={props.selectedPower}
          point={lineStart ?? pointer}
          lineEnd={lineStart ? lineEnd ?? lineStart : undefined}
          mapWidth={props.map.width}
          definition={props.rules.powers[props.selectedPower]}
        />
      )}
      {props.phase === 'battle' && pointer && props.selectedPower === 'wall' && (
        <BuildPreview point={pointer} kind="wall" valid={isValidPlacement(pointer, 'wall', props.placements, props.map)} range={0} wallRotation={deriveWallRotation(props.map, pointer)} wallLength={props.rules.wall.length} />
      )}
      {props.phase !== 'battle' && props.placements.map((placement) => (
        <PlacementModel
          key={placement.id}
          placement={placement}
          map={props.map}
          wallMaxHealth={props.rules.tuning.wall.health}
          wallLength={props.rules.wall.length}
          selected={props.phase === 'setup' && props.selectedPlacementId === placement.id}
          onSelect={props.phase === 'setup' ? props.onSelectPlacement : undefined}
        />
      ))}
      {props.phase === 'battle' && (
        <Battle
          map={props.map}
          run={props.run}
          rules={props.rules}
          reducedFlashes={props.reducedFlashes}
          screenShake={props.screenShake}
          settings={props.settings}
          placements={props.placements}
          powerCommand={props.powerCommand}
          guidePoint={pointer}
          stressCommand={props.stressCommand}
          invulnerable={props.invulnerable}
          paused={props.paused}
          speed={props.speed}
          onSnapshot={props.onSnapshot}
          onEnd={props.onBattleEnd}
          onWallRemoved={props.onWallRemoved}
        />
      )}
    </>
  )
}

function Terrain({ map, onClick, onMove, onPointerDown, onPointerUp }: {
  map: MapDefinition
  onClick: (event: ThreeEvent<MouseEvent>) => void
  onMove: (event: ThreeEvent<PointerEvent>) => void
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void
  onPointerUp: (event: ThreeEvent<PointerEvent>) => void
}) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow onClick={onClick} onPointerMove={onMove} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <planeGeometry args={[map.width, map.depth]} />
        <meshStandardMaterial color={map.palette?.ground ?? '#33472e'} roughness={1} />
      </mesh>
      {Array.from({ length: 28 }, (_, index) => {
        const x = ((index * 73) % 210) / 10 - 10.5
        const z = ((index * 47) % 128) / 10 - 6.4
        if (Math.abs(x) >= map.width / 2 || Math.abs(z) >= map.depth / 2
          || Math.min(...map.paths.map((path) => distanceToPath({ x, z }, path))) < 1.5
          || map.obstacles?.some((obstacle) => distance({ x, z }, obstacle) < obstacle.radius + 0.5)) return null
        return <Rock key={index} x={x} z={z} scale={0.2 + (index % 4) * 0.07} color={map.palette?.rock ?? '#6d7257'} />
      })}
      {map.obstacles?.map((obstacle, index) => <Rock key={`obstacle-${index}`} x={obstacle.x} z={obstacle.z} scale={obstacle.radius} color={map.palette?.rock ?? '#6d7257'} />)}
      {map.decorations?.map((decoration, index) => <TerrainDecoration key={`decoration-${index}`} decoration={decoration} />)}
      {map.secondaryObjective && <SupplyCache objective={map.secondaryObjective} />}
      {map.buildZones?.map((zone, index) => (
        <mesh key={`build-zone-${index}`} position={[zone.x, -0.095, zone.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(0.05, zone.radius - 0.08), zone.radius, 48]} />
          <meshBasicMaterial color="#e3cf6b" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}

function SupplyCache({ objective }: { objective: MapSecondaryObjective }) {
  return <group position={[objective.x, 0, objective.z]}>
    <mesh position={[0, 0.32, 0]}><boxGeometry args={[0.9, 0.64, 0.72]} /><meshStandardMaterial color="#9b6c35" roughness={0.85} /></mesh>
    <mesh position={[0, 0.66, 0]} rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.1, 0.94, 0.76]} /><meshStandardMaterial color="#d8b761" metalness={0.35} /></mesh>
  </group>
}

function TerrainDecoration({ decoration }: { decoration: MapDecoration }) {
  if (decoration.kind === 'tree') return <group position={[decoration.x, 0, decoration.z]}>
    <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.08, 0.11, 0.56, 7]} /><meshStandardMaterial color="#62462e" roughness={1} /></mesh>
    <mesh position={[0, 0.72, 0]}><coneGeometry args={[0.42, 0.9, 7]} /><meshStandardMaterial color="#365a32" roughness={1} /></mesh>
  </group>
  if (decoration.kind === 'shrub') return <mesh position={[decoration.x, 0.16, decoration.z]} scale={[1.3, 0.65, 1]}>
    <dodecahedronGeometry args={[0.3, 0]} /><meshStandardMaterial color="#5b753b" roughness={1} />
  </mesh>
  return <mesh position={[decoration.x, -0.085, decoration.z]} rotation={[-Math.PI / 2, 0, 0]}>
    <torusGeometry args={[0.28, 0.09, 8, 20]} /><meshStandardMaterial color="#55483b" roughness={1} />
  </mesh>
}

function Rock({ x, z, scale, color }: { x: number; z: number; scale: number; color: string }) {
  return (
    <mesh position={[x, scale * 0.55 - 0.05, z]} rotation={[0, x + z, 0]}>
      <dodecahedronGeometry args={[scale, 0]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  )
}

function Path({ map }: { map: MapDefinition }) {
  return (
    <group>
      {map.paths.flatMap((path, pathIndex) => path.slice(1).map((end, index) => {
        const start = path[index]
        const length = distance(start, end)
        const angle = Math.atan2(end.z - start.z, end.x - start.x)
        return (
          <mesh
            key={`${pathIndex}-${start.x}-${start.z}`}
            position={[(start.x + end.x) / 2, -0.045, (start.z + end.z) / 2]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[length + 0.12, 0.09, map.pathWidth]} />
            <meshStandardMaterial color={map.palette?.path ?? '#796442'} roughness={1} />
          </mesh>
        )
      }))}
    </group>
  )
}

function Fortress({ map, health: _health }: { map: MapDefinition; health?: number }) {
  const path = map.paths[0]
  const end = path[path.length - 1]
  return (
    <group position={[end.x - 0.25, 0, end.z]}>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.8, 1.1, 2.7]} />
        <meshStandardMaterial color="#77766c" roughness={0.85} />
      </mesh>
      <mesh position={[-0.6, 1.25, -0.9]}>
        <cylinderGeometry args={[0.38, 0.48, 1.4, 8]} />
        <meshStandardMaterial color="#4e514c" />
      </mesh>
      <mesh position={[-0.6, 1.65, -0.9]}>
        <coneGeometry args={[0.48, 0.55, 8]} />
        <meshStandardMaterial color="#8b3229" />
      </mesh>
    </group>
  )
}

function BuildPreview({ point, kind, valid, range, minRange = 0, wallRotation = 0, wallLength = 1 }: { point: Point; kind: BuildTool; valid: boolean; range: number; minRange?: number; wallRotation?: number; wallLength?: number }) {
  return (
    <group position={[point.x, 0.05, point.z]}>
      {kind !== 'wall' && range > 0 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[range - 0.04, range, 64]} />
          <meshBasicMaterial color={valid ? '#f2d06b' : '#d65042'} transparent opacity={0.36} />
        </mesh>
      )}
      {kind !== 'wall' && minRange > 0 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(0, minRange - 0.05), minRange, 48]} />
          <meshBasicMaterial color="#e26b4d" transparent opacity={0.5} />
        </mesh>
      )}
      {kind === 'wall' ? <mesh position={[0, 0.15, 0]} rotation={[0, wallRotation, 0]}>
        <boxGeometry args={[0.45, 0.3, wallVisualLength(wallLength)]} />
        <meshBasicMaterial color={valid ? '#d9e28e' : '#ff594d'} transparent opacity={0.55} />
      </mesh> : <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.44, 0.44, 0.3, 16]} />
        <meshBasicMaterial color={valid ? '#d9e28e' : '#ff594d'} transparent opacity={0.55} />
      </mesh>}
      {valid ? (
        <mesh position={[0, 0.48, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.045, 6, 18]} />
          <meshBasicMaterial color="#f7efc0" />
        </mesh>
      ) : (
        <group position={[0, 0.48, 0]} rotation={[0, Math.PI / 4, 0]}>
          <mesh><boxGeometry args={[0.55, 0.055, 0.09]} /><meshBasicMaterial color="#fff4db" /></mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[0.55, 0.055, 0.09]} /><meshBasicMaterial color="#fff4db" /></mesh>
        </group>
      )}
    </group>
  )
}

function PowerPreview({ kind, point, lineEnd, mapWidth, definition }: { kind: ActivePowerKind; point: Point; lineEnd?: Point; mapWidth: number; definition: PowerDefinition }) {
  const line = resolvePowerLine(point, lineEnd ?? point, mapWidth)
  const dx = line.end.x - line.start.x
  const dz = line.end.z - line.start.z
  return definition.shape === 'lane' ? (
    <mesh position={[(line.start.x + line.end.x) / 2, 0.08, (line.start.z + line.end.z) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]}>
      <boxGeometry args={[Math.hypot(dx, dz), 0.025, definition.size]} />
      <meshBasicMaterial color={kind === 'cryoBeam' ? '#78dbe8' : '#f0c85b'} transparent opacity={0.22} />
    </mesh>
  ) : (
    <mesh position={[point.x, 0.08, point.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[definition.size, 48]} />
      <meshBasicMaterial color={kind === 'nuke' ? '#ff553b' : '#f0a65b'} transparent opacity={0.2} />
    </mesh>
  )
}

function PlacementModel({ placement, map, wallMaxHealth, wallLength, selected, onSelect }: {
  placement: Placement
  map: MapDefinition
  wallMaxHealth: number
  wallLength: number
  selected: boolean
  onSelect?: (id: number) => void
}) {
  return <group onClick={(event) => { event.stopPropagation(); onSelect?.(placement.id) }}>
    {selected && <mesh position={[placement.x, 0.07, placement.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.62, 0.72, 40]} />
      <meshBasicMaterial color="#f5d66d" transparent opacity={0.85} />
    </mesh>}
    {placement.kind === 'wall'
      ? <Wall point={{ ...placement, rotation: placement.rotation ?? deriveWallRotation(map, placement) }} health={wallMaxHealth} maxHealth={wallMaxHealth} length={wallLength} />
      : <TowerModel tower={placement} />}
  </group>
}

function TowerModel({ tower, target }: { tower: Placement; target?: Point }) {
  const angle = target ? -Math.atan2(target.z - tower.z, target.x - tower.x) : 0
  const colors = tower.kind === 'cannon' || tower.kind === 'mortar' || tower.kind === 'rocket' ? ['#383d3c', '#bd6d42']
    : tower.kind === 'flamethrower' ? ['#4b3d31', '#d65735']
      : tower.kind === 'cryo' ? ['#3b5960', '#84d8df']
        : tower.kind === 'tesla' ? ['#3f4057', '#a685ee']
          : tower.kind === 'laser' ? ['#4c3436', '#f05f67']
            : tower.kind === 'support' ? ['#3a5144', '#74d69b']
              : ['#4f5650', '#b7a45c']
  const barrelRadius = tower.kind === 'cannon' || tower.kind === 'mortar' || tower.kind === 'rocket' ? 0.14 : tower.kind === 'flamethrower' ? 0.1 : 0.07
  return (
    <group position={[tower.x, 0, tower.z]}>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.48, 0.58, 0.44, 10]} />
        <meshStandardMaterial color={colors[0]} metalness={0.45} roughness={0.7} />
      </mesh>
      <group position={[0, 0.62, 0]} rotation={[0, angle, 0]}>
        <mesh>
          <sphereGeometry args={[0.31, 10, 8]} />
          <meshStandardMaterial color={colors[1]} metalness={0.35} />
        </mesh>
        <TowerWeapon kind={tower.kind} barrelRadius={barrelRadius} />
      </group>
    </group>
  )
}

function TowerWeapon({ kind, barrelRadius }: { kind: BuildTool; barrelRadius: number }) {
  if (kind === 'rocket') return <group position={[0.48, 0, 0]}>
    {[-0.16, 0.16].map((z) => <mesh key={z} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.11, 0.15, 0.82, 8]} /><meshStandardMaterial color="#2b302f" metalness={0.8} />
    </mesh>)}
  </group>
  if (kind === 'mortar') return <mesh position={[0.32, 0.2, 0]} rotation={[0, 0, Math.PI / 3]}>
    <cylinderGeometry args={[0.16, 0.2, 0.8, 10]} /><meshStandardMaterial color="#292d2c" metalness={0.8} />
  </mesh>
  if (kind === 'tesla') return <group>
    {[-0.18, 0, 0.18].map((z) => <mesh key={z} position={[0, 0.3, z]}>
      <coneGeometry args={[0.07, 0.65, 6]} /><meshStandardMaterial color="#c9afff" emissive="#6040aa" emissiveIntensity={0.6} />
    </mesh>)}
  </group>
  if (kind === 'support') return <group>
    <mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.06, 0.09, 0.78, 8]} /><meshStandardMaterial color="#b7ddbc" /></mesh>
    <mesh position={[0, 0.72, 0]}><octahedronGeometry args={[0.18]} /><meshStandardMaterial color="#77e2a1" emissive="#245f3c" /></mesh>
  </group>
  if (kind === 'laser') return <group position={[0.45, 0, 0]}>
    <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.09, 0.14, 0.72, 8]} /><meshStandardMaterial color="#292d2c" metalness={0.8} /></mesh>
    <mesh position={[0.43, 0, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[0.12, 0.32, 6]} /><meshStandardMaterial color="#ff7a83" emissive="#8c1f2b" emissiveIntensity={0.7} /></mesh>
  </group>
  return <mesh position={[0.64, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
    <cylinderGeometry args={[barrelRadius, barrelRadius * 1.4, kind === 'flamethrower' ? 0.72 : 0.95, 8]} />
    <meshStandardMaterial color="#292d2c" metalness={0.8} />
  </mesh>
}

function Wall({ point, health, maxHealth, length }: { point: Point & { rotation?: number }; health: number; maxHealth: number; length: number }) {
  const amount = Math.max(0.2, health / maxHealth)
  const visualLength = wallVisualLength(length)
  const braceCount = Math.max(3, Math.ceil(visualLength / 0.62))
  return (
    <group position={[point.x, 0, point.z]} rotation={[0, point.rotation ?? 0, 0]} scale={[1, amount, 1]}>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.45, 0.84, visualLength]} />
        <meshStandardMaterial color="#7f6845" roughness={1} />
      </mesh>
      {Array.from({ length: braceCount }, (_, index) => -visualLength / 2 + visualLength * (index + 0.5) / braceCount).map((z) => (
        <mesh key={z} position={[0.02, 0.54, z]} rotation={[0, 0, -0.12]}>
          <boxGeometry args={[0.58, 0.16, 0.13]} />
          <meshStandardMaterial color="#b3935e" />
        </mesh>
      ))}
    </group>
  )
}

const MAX_RENDERED_ORCS = 2500
const SPECIAL_ORC_COLORS: Partial<Record<EnemyKind, Color>> = {
  shaman: new Color('#62d9dd'),
  banner: new Color('#d84a3f'),
  sapper: new Color('#f0a13b'),
  berserker: new Color('#ff5d42'),
  ogre: new Color('#ead49a'),
}

function OrcHorde({ simulation }: { simulation: SimulationState }) {
  const bodies = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)
  const armor = useRef<InstancedMesh>(null)
  const specialMarkers = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  useFrame(() => {
    if (!bodies.current || !heads.current || !armor.current || !specialMarkers.current) return
    const visible = simulation.enemies.slice(0, MAX_RENDERED_ORCS)
    const interpolation = Math.min(1, simulation.accumulator / SIMULATION_STEP)
    let armorIndex = 0
    let markerIndex = 0
    visible.forEach((enemy, index) => {
      const scale = enemyScale(enemy)
      const wobble = (enemy.id % 5 - 2) * 0.06
      const { x, z } = interpolatedEnemyPosition(enemy, interpolation)
      dummy.position.set(x, 0.56 + wobble, z)
      dummy.scale.setScalar(scale)
      dummy.rotation.set(0, 0, 0.08)
      dummy.updateMatrix()
      bodies.current!.setMatrixAt(index, dummy.matrix)

      dummy.position.set(x, 1.04 + wobble, z)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      heads.current!.setMatrixAt(index, dummy.matrix)

      if (enemy.kind === 'shieldbearer' || enemy.kind === 'armored') {
        const facingX = enemy.facingX ?? 1
        const facingZ = enemy.facingZ ?? 0
        dummy.position.set(x + facingX * 0.28 * scale, 0.66 + wobble, z + facingZ * 0.28 * scale)
        dummy.scale.setScalar(scale)
        dummy.rotation.set(0, Math.atan2(-facingZ, facingX), -0.15)
        dummy.updateMatrix()
        armor.current!.setMatrixAt(armorIndex, dummy.matrix)
        armorIndex += 1
      }

      const markerColor = SPECIAL_ORC_COLORS[enemy.kind]
      if (markerColor) {
        const markerScale = enemy.kind === 'ogre' ? 0.28 : enemy.kind === 'banner' ? 0.2 : 0.15
        dummy.position.set(x, 1.38 * scale + wobble, z)
        dummy.scale.setScalar(markerScale)
        dummy.rotation.set(0, enemy.id * 0.35, 0)
        dummy.updateMatrix()
        specialMarkers.current!.setMatrixAt(markerIndex, dummy.matrix)
        specialMarkers.current!.setColorAt(markerIndex, markerColor)
        markerIndex += 1
      }
    })
    bodies.current.count = visible.length
    heads.current.count = visible.length
    armor.current.count = armorIndex
    specialMarkers.current.count = markerIndex
    bodies.current.instanceMatrix.needsUpdate = true
    heads.current.instanceMatrix.needsUpdate = true
    armor.current.instanceMatrix.needsUpdate = true
    specialMarkers.current.instanceMatrix.needsUpdate = true
    if (specialMarkers.current.instanceColor) specialMarkers.current.instanceColor.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={bodies} args={[undefined, undefined, MAX_RENDERED_ORCS]} frustumCulled={false}>
        <capsuleGeometry args={[0.26, 0.45, 3, 6]} />
        <meshStandardMaterial color="#465f37" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, MAX_RENDERED_ORCS]} frustumCulled={false}>
        <sphereGeometry args={[0.25, 7, 5]} />
        <meshStandardMaterial color="#78944f" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={armor} args={[undefined, undefined, MAX_RENDERED_ORCS]} frustumCulled={false}>
        <boxGeometry args={[0.12, 0.72, 0.62]} />
        <meshStandardMaterial color="#606867" metalness={0.65} />
      </instancedMesh>
      <instancedMesh ref={specialMarkers} args={[undefined, undefined, MAX_RENDERED_ORCS]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial vertexColors emissive="#31140d" emissiveIntensity={0.35} />
      </instancedMesh>
    </>
  )
}

function enemyScale(enemy: Enemy): number {
  return enemy.kind === 'ogre' ? 1.35 : enemy.kind === 'brute' ? 0.92 : enemy.kind === 'runner' ? 0.48 : enemy.kind === 'sapper' ? 0.55 : 0.62
}

function Battle({ map, run, rules, reducedFlashes, screenShake, settings, placements, powerCommand, guidePoint, stressCommand, invulnerable, paused, speed, onSnapshot, onEnd, onWallRemoved }: {
  map: MapDefinition
  run: RunRules
  rules: GameRules
  reducedFlashes: boolean
  screenShake: boolean
  settings: GameSettings
  placements: Placement[]
  powerCommand: PowerCommand | null
  guidePoint: Point | null
  stressCommand: StressCommand | null
  invulnerable: boolean
  paused: boolean
  speed: 1 | 2
  onSnapshot: (snapshot: BattleSnapshot) => void
  onEnd: (won: boolean, snapshot: BattleSnapshot) => void
  onWallRemoved: (id: number) => void
}) {
  const [, render] = useState(0)
  const ended = useRef(false)
  const sim = useRef(createSimulation(placements, rules, run.mode === 'challenge' ? run.modifiers.baseHealth ?? 100 : 100, map))
  const towers = useMemo(() => placements.filter((item) => isTowerKind(item.kind)), [placements])
  const pathInfos = useMemo(() => map.paths.map(buildPathInfo), [map.paths])
  const lastPowerId = useRef<number | null>(null)
  const lastStressId = useRef<number | null>(null)
  const { camera } = useThree()
  const combatAudio = useRef(createCombatAudioState())
  const audioElapsed = useRef(0)

  useEffect(() => () => {
    camera.position.set(0, 15, 13)
  }, [camera])

  useEffect(() => {
    syncWalls(sim.current, placements, rules, map)
  }, [map, placements, rules])

  useEffect(() => {
    if (!powerCommand || powerCommand.id === lastPowerId.current) return
    lastPowerId.current = powerCommand.id
    addPower(sim.current, powerCommand.id, powerCommand.kind, powerCommand.point, rules, powerCommand.lineEnd)
  }, [powerCommand, rules])

  useEffect(() => {
    if (!paused && guidePoint) guideActivePower(sim.current, 'orbitalLaser', guidePoint)
  }, [guidePoint, paused])

  useEffect(() => {
    if (!stressCommand || stressCommand.id === lastStressId.current) return
    lastStressId.current = stressCommand.id
    spawnStressEnemies(sim.current, map, rules, stressCommand.count, stressCommand.kind)
    onSnapshot(toSnapshot(sim.current, run))
  }, [map, onSnapshot, rules, run, stressCommand])

  useFrame((_, frameDelta) => {
    if (paused || ended.current) {
      camera.position.set(0, 15, 13)
      return
    }
    const state = sim.current
    audioElapsed.current += frameDelta
    state.accumulator += Math.min(frameDelta, 0.1) * speed
    while (state.accumulator >= SIMULATION_STEP) {
      const protectedHealth = state.baseHealth
      const protectedShield = state.fortressShield
      stepSimulation(state, { towers, map, pathInfos, rules, run }, SIMULATION_STEP)
      if (invulnerable) {
        state.baseHealth = protectedHealth
        state.fortressShield = protectedShield
      }
      state.accumulator -= SIMULATION_STEP
    }
    for (const cue of consumeCombatAudioEvents(combatAudio.current, state.eventTotals, audioElapsed.current)) playSound(cue, settings)
    if (state.removedWallIds.size > 0) {
      for (const id of state.removedWallIds) onWallRemoved(id)
      state.removedWallIds.clear()
    }
    state.reportTimer += frameDelta
    if (state.reportTimer >= 1 / 15) {
      state.reportTimer = 0
      render((value) => value + 1)
      onSnapshot(toSnapshot(state, run))
      ;(globalThis as typeof globalThis & { __ORCFALL_TELEMETRY__?: ReturnType<typeof getSimulationTelemetry> }).__ORCFALL_TELEMETRY__ = getSimulationTelemetry(state)
    }

    if (state.baseHealth <= 0) {
      ended.current = true
      onEnd(false, toSnapshot(state, run))
    } else if (isRunWon(state, run)) {
      ended.current = true
      onEnd(true, toSnapshot(state, run))
    }

    const shake = screenShake ? Math.min(1, state.fortressHitFlash / 0.32) * 0.12 : 0
    camera.position.set(Math.sin(state.elapsedSeconds * 94) * shake, 15, 13 + Math.cos(state.elapsedSeconds * 79) * shake)
  })

  const state = sim.current
  return (
    <>
      {towers.map((tower) => {
        if (!isTowerKind(tower.kind)) return null
        const stats = rules.tuning.towers[tower.kind]
        const target = findTowerTarget(tower, state.enemies, stats.range, stats.minRange, state.enemyIndex)
        return <TowerModel key={tower.id} tower={tower} target={target} />
      })}
      {[...state.wallById.values()].filter((wall) => wall.health > 0).map((wall) => (
        <Wall key={wall.id} point={wall} health={wall.health} maxHealth={rules.tuning.wall.health} length={wall.length} />
      ))}
      <OrcHorde simulation={state} />
      <FortressFeedback map={map} simulation={state} reducedFlashes={reducedFlashes} />
      {map.secondaryObjective && <SecondaryObjectiveFeedback objective={map.secondaryObjective} simulation={state} reducedFlashes={reducedFlashes} />}
      <TracerPool simulation={state} />
      <CombatVisualPool simulation={state} corpseDensity={settings.corpseDensity} reducedFlashes={reducedFlashes} />
      {state.powers.map((power) => <PowerVisual key={power.id} power={power} definition={rules.powers[power.kind]} mapWidth={map.width} reducedFlashes={reducedFlashes} />)}
    </>
  )
}

const CORPSE_LIMIT = { off: 0, low: 24, high: 72 } as const
export function corpseVisualLimit(density: GameSettings['corpseDensity']): number { return CORPSE_LIMIT[density] }

function CombatVisualPool({ simulation, corpseDensity, reducedFlashes }: {
  simulation: SimulationState
  corpseDensity: GameSettings['corpseDensity']
  reducedFlashes: boolean
}) {
  const corpses = useRef<InstancedMesh>(null)
  const bursts = useRef<InstancedMesh>(null)
  const debris = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  useFrame(() => {
    if (!corpses.current || !bursts.current || !debris.current) return
    const corpseLimit = corpseVisualLimit(corpseDensity)
    const allDeaths = simulation.visuals.filter((visual) => visual.kind === 'death')
    const deaths = corpseLimit === 0 ? [] : allDeaths.slice(-corpseLimit)
    const impacts = simulation.visuals.filter((visual) => visual.kind === 'impact')
    const breaks = simulation.visuals.filter((visual) => visual.kind === 'wallBreak')
    deaths.forEach((visual, index) => {
      dummy.position.set(visual.x, 0.08, visual.z)
      dummy.rotation.set(Math.PI / 2, visual.id * 1.7, 0)
      dummy.scale.set(0.42, 0.18, 0.55)
      dummy.updateMatrix()
      corpses.current!.setMatrixAt(index, dummy.matrix)
    })
    impacts.forEach((visual, index) => {
      const amount = reducedFlashes ? 0.22 : Math.min(1, visual.life * 5)
      dummy.position.set(visual.x, 0.15, visual.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(0.18 + amount * 0.35)
      dummy.updateMatrix()
      bursts.current!.setMatrixAt(index, dummy.matrix)
    })
    breaks.forEach((visual, index) => {
      dummy.position.set(visual.x, 0.16, visual.z)
      dummy.rotation.set(visual.id, visual.id * 0.7, visual.id * 0.4)
      dummy.scale.setScalar(0.28 + visual.life * 0.3)
      dummy.updateMatrix()
      debris.current!.setMatrixAt(index, dummy.matrix)
    })
    corpses.current.count = deaths.length
    bursts.current.count = impacts.length
    debris.current.count = breaks.length
    corpses.current.instanceMatrix.needsUpdate = true
    bursts.current.instanceMatrix.needsUpdate = true
    debris.current.instanceMatrix.needsUpdate = true
  })
  return <>
    <instancedMesh ref={corpses} args={[undefined, undefined, 72]} frustumCulled={false}>
      <capsuleGeometry args={[0.22, 0.35, 2, 5]} /><meshStandardMaterial color="#304027" roughness={1} transparent opacity={0.68} />
    </instancedMesh>
    <instancedMesh ref={bursts} args={[undefined, undefined, 96]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 4]} /><meshBasicMaterial color="#ffc268" transparent opacity={reducedFlashes ? 0.16 : 0.46} depthWrite={false} />
    </instancedMesh>
    <instancedMesh ref={debris} args={[undefined, undefined, 96]} frustumCulled={false}>
      <boxGeometry args={[0.55, 0.18, 0.2]} /><meshStandardMaterial color="#8c7149" roughness={1} />
    </instancedMesh>
  </>
}

function FortressFeedback({ map, simulation, reducedFlashes }: { map: MapDefinition; simulation: SimulationState; reducedFlashes: boolean }) {
  const end = map.paths[0].at(-1) ?? { x: 0, z: 0 }
  const health = Math.max(0, Math.min(1, simulation.baseHealth / 100))
  const flash = Math.max(0, Math.min(1, simulation.fortressHitFlash / 0.32))
  return (
    <group position={[end.x - 0.25, 0, end.z]}>
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[2.05, 0.18, 0.16]} />
        <meshBasicMaterial color="#251b18" />
      </mesh>
      {health > 0 && <mesh position={[-1.025 + health * 1.025, 2.2, -0.01]}>
        <boxGeometry args={[2.05 * health, 0.12, 0.18]} />
        <meshBasicMaterial color={health > 0.5 ? '#8fd06b' : health > 0.25 ? '#e0ae55' : '#e45b48'} />
      </mesh>}
      {simulation.fortressShield > 0 && (
        <mesh position={[0, 0.95, 0]} scale={[1.25, 1.1, 1.35]}>
          <sphereGeometry args={[1.35, 18, 12]} />
          <meshBasicMaterial color="#76d9ec" wireframe transparent opacity={0.34} depthWrite={false} />
        </mesh>
      )}
      {flash > 0 && (
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[2.05, 1.35, 2.95]} />
          <meshBasicMaterial color={simulation.fortressHitWasShielded ? '#87e8f3' : '#ff4f3d'} transparent opacity={flash * (reducedFlashes ? 0.12 : 0.38)} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

function SecondaryObjectiveFeedback({ objective, simulation, reducedFlashes }: { objective: MapSecondaryObjective; simulation: SimulationState; reducedFlashes: boolean }) {
  const health = simulation.secondaryObjectiveMaxHealth > 0 ? Math.max(0, simulation.secondaryObjectiveHealth / simulation.secondaryObjectiveMaxHealth) : 0
  return <group position={[objective.x, 0, objective.z]}>
    <mesh position={[0, 1.02, 0]}><boxGeometry args={[1.15, 0.12, 0.12]} /><meshBasicMaterial color="#211a12" /></mesh>
    {health > 0 && <mesh position={[-0.575 + health * 0.575, 1.03, -0.01]}><boxGeometry args={[1.15 * health, 0.08, 0.14]} /><meshBasicMaterial color="#e5c55c" /></mesh>}
    {simulation.secondaryObjectiveHitFlash > 0 && <mesh position={[0, 0.35, 0]}><boxGeometry args={[1.05, 0.8, 0.88]} /><meshBasicMaterial color="#ff7b42" transparent opacity={reducedFlashes ? 0.12 : 0.38} /></mesh>}
  </group>
}

function PowerVisual({ power, definition, mapWidth, reducedFlashes }: { power: PowerRun; definition: PowerDefinition; mapWidth: number; reducedFlashes: boolean }) {
  const warning = !power.fired
  const color = power.kind === 'cryoBeam' ? '#80e8f2' : power.kind === 'nuke' ? '#ff583d'
    : power.kind === 'barrage' ? '#ffad58' : power.kind === 'orbitalLaser' ? '#f4c7ff'
      : power.kind === 'repair' ? '#79dfa0' : '#f5d46c'
  if (definition.shape === 'circle') return (
    <group position={[power.point.x, 0, power.point.z]}>
      <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[definition.size * 0.88, definition.size, 48]} />
        <meshBasicMaterial color={color} transparent opacity={warning ? 0.65 : Math.max(0, power.life)} />
      </mesh>
      {!warning && !reducedFlashes && <mesh position={[0, 0.5, 0]}><sphereGeometry args={[definition.size * 0.55, 12, 8]} /><meshBasicMaterial color={color} transparent opacity={Math.max(0, power.life * 0.7)} /></mesh>}
      {!warning && power.kind === 'orbitalLaser' && (
        <mesh position={[0, 4.2, 0]}><cylinderGeometry args={[0.16, 0.38, 8, 12]} /><meshBasicMaterial color="#faeaff" transparent opacity={0.82} /></mesh>
      )}
      {!warning && power.kind === 'barrage' && Array.from({ length: power.impactsFired }, (_, index) => {
        const impact = barrageImpactPoint(power.point, definition.size, index)
        return (
          <mesh key={index} position={[impact.x - power.point.x, 0.35, impact.z - power.point.z]}>
            <sphereGeometry args={[0.18, 7, 5]} />
            <meshBasicMaterial color="#ffb45d" transparent opacity={Math.max(0.2, power.life)} />
          </mesh>
        )
      })}
    </group>
  )
  const line = resolvePowerLine(power.point, power.lineEnd ?? power.point, mapWidth)
  const dx = line.end.x - line.start.x
  const dz = line.end.z - line.start.z
  const lineLength = Math.hypot(dx, dz)
  return (
    <group position={[(line.start.x + line.end.x) / 2, 0, (line.start.z + line.end.z) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]}>
      {power.kind === 'strafe' && !warning && (
        <Aircraft x={-lineLength / 2 + (1 - power.life / definition.duration) * lineLength} />
      )}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[lineLength, 0.035, warning ? definition.size : 0.22]} />
        <meshBasicMaterial color={color} transparent opacity={warning ? 0.48 : Math.max(0, power.life)} />
      </mesh>
      {!warning && !reducedFlashes && Array.from({ length: 13 }, (_, index) => (
        <mesh key={index} position={[-lineLength / 2 + (index / 12) * lineLength, 0.24, ((index % 3) - 1) * 0.32]}>
          <sphereGeometry args={[0.11 + (index % 2) * 0.07, 6, 5]} />
          <meshBasicMaterial color={power.kind === 'cryoBeam' ? '#b5f4ff' : index % 2 ? '#ff8c3c' : '#fff0a4'} transparent opacity={Math.max(0, power.life)} />
        </mesh>
      ))}
    </group>
  )
}

function Aircraft({ x }: { x: number }) {
  return (
    <group position={[x, 2.4, 0]} rotation={[0, 0, -Math.PI / 2]} scale={0.72}>
      <mesh><coneGeometry args={[0.22, 1.5, 6]} /><meshStandardMaterial color="#5d655e" metalness={0.55} /></mesh>
      <mesh position={[0, -0.15, 0]}><boxGeometry args={[1.55, 0.1, 0.35]} /><meshStandardMaterial color="#3f4942" metalness={0.45} /></mesh>
      <mesh position={[0, 0.55, 0]}><boxGeometry args={[0.65, 0.08, 0.22]} /><meshStandardMaterial color="#83855e" /></mesh>
      <mesh position={[0, -0.52, 0.08]}><sphereGeometry args={[0.13, 6, 4]} /><meshBasicMaterial color="#f3b65b" /></mesh>
    </group>
  )
}

const MAX_RENDERED_TRACERS = 2048
const TRACER_COLORS = {
  cryo: new Color('#8ee8f2'), flamethrower: new Color('#ff6637'), cannon: new Color('#ffb14f'), default: new Color('#ffe585'),
}

function TracerPool({ simulation }: { simulation: SimulationState }) {
  const mesh = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  useFrame(() => {
    if (!mesh.current) return
    const visible = simulation.tracers.slice(0, MAX_RENDERED_TRACERS)
    visible.forEach((tracer, index) => {
      const dx = tracer.to.x - tracer.from.x
      const dz = tracer.to.z - tracer.from.z
      const length = Math.hypot(dx, dz)
      const fade = Math.max(0.15, Math.min(1, tracer.life * 10))
      dummy.position.set((tracer.from.x + tracer.to.x) / 2, 0.65, (tracer.from.z + tracer.to.z) / 2)
      dummy.rotation.set(0, -Math.atan2(dz, dx), 0)
      dummy.scale.set(length, fade, fade)
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(index, dummy.matrix)
      const color = tracer.tower === 'cryo' ? TRACER_COLORS.cryo : tracer.tower === 'flamethrower'
        ? TRACER_COLORS.flamethrower : tracer.tower === 'cannon' ? TRACER_COLORS.cannon : TRACER_COLORS.default
      mesh.current!.setColorAt(index, color)
    })
    mesh.current.count = visible.length
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_RENDERED_TRACERS]} frustumCulled={false}>
      <boxGeometry args={[1, 0.035, 0.035]} />
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  )
}
