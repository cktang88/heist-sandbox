import { useState, type MouseEvent } from 'react'
import { isMap, normalizeMap } from '../game/mapStore'
import { MAP_PALETTE_PRESETS, type MapPalettePreset } from '../game/maps'
import { buildPathInfo, distance, distanceToPath } from '../game/path'
import type { MapBuildZone, MapDecoration, MapDecorationKind, MapDefinition, MapObstacle, MapSecondaryObjective, Point, WaveDefinition } from '../game/types'
import { WaveSetEditor } from './WaveSetEditor'

type MapEditorProps = {
  initialMap: MapDefinition
  onCancel: () => void
  onSave: (map: MapDefinition) => void
}

export function MapEditor({ initialMap, onCancel, onSave }: MapEditorProps) {
  const [mapBase, setMapBase] = useState(initialMap)
  const [name, setName] = useState(initialMap.name)
  const [paths, setPaths] = useState<Point[][]>(initialMap.paths)
  const [obstacles, setObstacles] = useState<MapObstacle[]>(initialMap.obstacles ?? [])
  const [decorations, setDecorations] = useState<MapDecoration[]>(initialMap.decorations ?? [])
  const [buildZones, setBuildZones] = useState<MapBuildZone[]>(initialMap.buildZones ?? [])
  const [secondaryObjective, setSecondaryObjective] = useState<MapSecondaryObjective | undefined>(initialMap.secondaryObjective)
  const [buildZoneRadius, setBuildZoneRadius] = useState(2)
  const [waves, setWaves] = useState<WaveDefinition[]>(cloneWaves(initialMap.waves ?? []))
  const [tool, setTool] = useState<'route' | 'boulder' | 'buildZone' | 'supplyCache' | MapDecorationKind>('route')
  const [activePathIndex, setActivePathIndex] = useState(0)
  const [jsonDraft, setJsonDraft] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [toolError, setToolError] = useState<string | null>(null)
  const activePath = paths[activePathIndex] ?? []

  const addPoint = (event: MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width - 0.5) * mapBase.width
    const z = ((event.clientY - box.top) / box.height - 0.5) * mapBase.depth
    const fortress = paths[0]?.at(-1)
    const clicked = { x: round(x), z: round(z) }
    if (tool === 'supplyCache') {
      if (secondaryObjective && distance(clicked, secondaryObjective) <= 0.8) setSecondaryObjective(undefined)
      else setSecondaryObjective({ kind: 'supplyCache', ...clicked, health: secondaryObjective?.health ?? 280, bonusMedals: secondaryObjective?.bonusMedals ?? 10 })
      setToolError(null)
      return
    }
    if (isDecorationTool(tool)) {
      const existing = decorations.findIndex((decoration) => distance(clicked, decoration) <= 0.6)
      if (existing >= 0) setDecorations((current) => current.filter((_, index) => index !== existing))
      else if (decorations.length >= 120) setToolError('A map can contain up to 120 decoration stamps.')
      else setDecorations((current) => [...current, { ...clicked, kind: tool }])
      if (existing >= 0 || decorations.length < 120) setToolError(null)
      return
    }
    if (tool === 'buildZone') {
      const existing = buildZones.findIndex((zone) => distance(clicked, zone) <= zone.radius)
      if (existing >= 0) {
        setBuildZones((current) => current.filter((_, index) => index !== existing))
        setToolError(null)
        return
      }
      const radius = buildZoneRadius
      const outsideMap = Math.abs(clicked.x) + radius > mapBase.width / 2 || Math.abs(clicked.z) + radius > mapBase.depth / 2
      if (outsideMap) setToolError('Keep the entire build zone inside the field edge.')
      else if (buildZones.length >= 24) setToolError('A map can contain up to 24 build zones.')
      else { setBuildZones((current) => [...current, { ...clicked, radius }]); setToolError(null) }
      return
    }
    if (tool === 'boulder') {
      const tooCloseToRoute = paths.some((path) => distanceToPath(clicked, path) <= mapBase.pathWidth / 2 + 0.8)
      const outsideMap = Math.abs(clicked.x) + 0.65 > mapBase.width / 2 || Math.abs(clicked.z) + 0.65 > mapBase.depth / 2
      const overlaps = obstacles.some((obstacle) => distance(clicked, obstacle) < obstacle.radius + 0.65)
      if (tooCloseToRoute) setToolError('Boulders need clear ground away from every route.')
      else if (outsideMap) setToolError('Keep the entire boulder inside the field edge.')
      else if (overlaps) setToolError('Boulders cannot overlap each other.')
      else { setObstacles((current) => [...current, { ...clicked, radius: 0.65 }]); setToolError(null) }
      return
    }
    const point = activePathIndex > 0 && fortress && Math.hypot(clicked.x - fortress.x, clicked.z - fortress.z) <= 1
      ? fortress
      : clicked
    setToolError(null)
    setPaths((current) => current.map((path, index) => index === activePathIndex
      ? [...path, point]
      : path))
  }

  const save = () => {
    const draft = currentMap()
    if (!isMap(draft)) { setToolError('Check field size, routes, boulders, zones, stamps, and waves before saving.'); return }
    onSave(draft)
  }

  const currentMap = (): MapDefinition => ({
    ...mapBase,
    name: name.trim() || 'Untitled Front',
    paths,
    obstacles: obstacles.length ? obstacles : undefined,
    decorations: decorations.length ? decorations : undefined,
    buildZones: buildZones.length ? buildZones : undefined,
    secondaryObjective,
    waves: waves.length ? waves : undefined,
  })

  const loadJson = () => {
    try {
      const parsed = normalizeMap(JSON.parse(jsonDraft) as unknown)
      if (!isMap(parsed)) { setJsonError('That JSON is not a valid playable map.'); return }
      setMapBase(parsed)
      setName(parsed.name)
      setPaths(parsed.paths)
      setObstacles(parsed.obstacles ?? [])
      setDecorations(parsed.decorations ?? [])
      setBuildZones(parsed.buildZones ?? [])
      setSecondaryObjective(parsed.secondaryObjective)
      setWaves(cloneWaves(parsed.waves ?? []))
      setActivePathIndex(0)
      setJsonError(null)
    } catch {
      setJsonError('Fix the JSON syntax before loading it.')
    }
  }

  const routeError = getRouteError(paths)
  const routeIsValid = routeError === null && isMap(currentMap())
  const mapError = routeError ?? toolError ?? (!routeIsValid ? 'Check field size, boulders, build zones, stamps, and wave values before saving.' : null)

  const updateActivePath = (update: (path: Point[]) => Point[]) => {
    setPaths((current) => current.map((path, index) => index === activePathIndex ? update(path) : path))
  }

  const addLane = () => {
    setPaths((current) => [...current, []])
    setActivePathIndex(paths.length)
  }

  const removeLane = () => {
    if (paths.length <= 1) return
    const removedIndex = activePathIndex
    setPaths((current) => current.filter((_, index) => index !== activePathIndex))
    setWaves((current) => current.map((wave) => ({
      ...wave,
      groups: wave.groups.map((group) => group.lane === undefined ? group : {
        ...group,
        lane: group.lane === removedIndex ? undefined : group.lane > removedIndex ? group.lane - 1 : group.lane,
      }),
    })))
    setActivePathIndex((index) => Math.max(0, index - 1))
  }

  const palettePreset = findPalettePreset(mapBase.palette)

  return (
    <div className="editor-shell">
      <aside className="editor-sidebar">
        <p className="eyebrow">DEVELOPER TOOL // MAP FORGE</p>
        <h1>MAP CREATOR</h1>
        <p>Choose a lane, then click the field to lay its route. Every lane must finish at the same fortress.</p>
        <label>MAP NAME<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="editor-dimensions">
          <label>WIDTH<input aria-label="Map width" type="number" min="10" max="60" step="1" value={mapBase.width} onChange={(event) => setMapBase((current) => ({ ...current, width: clampNumber(event.target.value, 10, 60, current.width) }))} /></label>
          <label>DEPTH<input aria-label="Map depth" type="number" min="8" max="40" step="1" value={mapBase.depth} onChange={(event) => setMapBase((current) => ({ ...current, depth: clampNumber(event.target.value, 8, 40, current.depth) }))} /></label>
          <label>PATH WIDTH<input aria-label="Path width" type="number" min="0.5" max="8" step="0.1" value={mapBase.pathWidth} onChange={(event) => setMapBase((current) => ({ ...current, pathWidth: clampNumber(event.target.value, 0.5, 8, current.pathWidth) }))} /></label>
        </div>
        <label>TERRAIN PALETTE
          <select
            aria-label="Terrain palette"
            value={palettePreset}
            onChange={(event) => {
              const preset = event.target.value as MapPalettePreset
              setMapBase((current) => ({ ...current, palette: { ...MAP_PALETTE_PRESETS[preset].palette } }))
            }}
          >
            {Object.entries(MAP_PALETTE_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
          </select>
        </label>
        <div className="editor-tools" aria-label="Map drawing tool">
          <button className={tool === 'route' ? 'selected' : ''} onClick={() => setTool('route')}>DRAW ROUTE</button>
          <button className={tool === 'boulder' ? 'selected' : ''} onClick={() => setTool('boulder')}>PLACE BOULDER</button>
          <button className={tool === 'buildZone' ? 'selected' : ''} onClick={() => setTool('buildZone')}>BUILD ZONE</button>
          <button className={tool === 'tree' ? 'selected' : ''} onClick={() => setTool('tree')}>STAMP TREE</button>
          <button className={tool === 'shrub' ? 'selected' : ''} onClick={() => setTool('shrub')}>STAMP SHRUB</button>
          <button className={tool === 'crater' ? 'selected' : ''} onClick={() => setTool('crater')}>STAMP CRATER</button>
          <button className={tool === 'supplyCache' ? 'selected' : ''} onClick={() => setTool('supplyCache')}>SUPPLY CACHE</button>
        </div>
        <div className="editor-readout">
          <span>{tool === 'route' ? `Lane ${activePathIndex + 1} points` : tool === 'boulder' ? 'Boulders' : tool === 'buildZone' ? 'Build zones' : tool === 'supplyCache' ? 'Supply cache' : 'Decoration stamps'}</span>
          <strong>{tool === 'route' ? activePath.length : tool === 'boulder' ? obstacles.length : tool === 'buildZone' ? buildZones.length : tool === 'supplyCache' ? Number(Boolean(secondaryObjective)) : decorations.length}</strong>
        </div>
        {tool === 'buildZone' && <label className="zone-radius">ZONE RADIUS
          <input aria-label="Build zone radius" type="number" min="0.5" max="10" step="0.5" value={buildZoneRadius} onChange={(event) => setBuildZoneRadius(Math.min(10, Math.max(0.5, Number(event.target.value) || 0.5)))} />
          <small>Click open ground to place. Click inside a zone to delete it.</small>
        </label>}
        {secondaryObjective && <div className="editor-dimensions objective-fields">
          <label>CACHE HEALTH<input aria-label="Supply cache health" type="number" min="25" max="5000" step="25" value={secondaryObjective.health} onChange={(event) => setSecondaryObjective((current) => current ? { ...current, health: clampNumber(event.target.value, 25, 5000, current.health) } : current)} /></label>
          <label>BONUS MEDALS<input aria-label="Supply cache bonus medals" type="number" min="1" max="100" step="1" value={secondaryObjective.bonusMedals} onChange={(event) => setSecondaryObjective((current) => current ? { ...current, bonusMedals: Math.round(clampNumber(event.target.value, 1, 100, current.bonusMedals)) } : current)} /></label>
        </div>}
        <div className="editor-lanes" aria-label="Map lanes">
          {paths.map((_, index) => (
            <button key={index} className={index === activePathIndex ? 'selected' : ''} onClick={() => setActivePathIndex(index)}>LANE {index + 1}</button>
          ))}
          <button onClick={addLane}>+ LANE</button>
        </div>
        <div className="editor-actions">
          <button className="secondary-button" onClick={() => updateActivePath((path) => path.slice(0, -1))} disabled={!activePath.length}>UNDO POINT</button>
          <button className="secondary-button" onClick={() => updateActivePath(() => [])}>CLEAR LANE</button>
          <button className="secondary-button" onClick={removeLane} disabled={paths.length <= 1}>REMOVE LANE</button>
          <button className="secondary-button" onClick={() => setObstacles((current) => current.slice(0, -1))} disabled={!obstacles.length}>UNDO BOULDER</button>
          <button className="secondary-button" onClick={() => setBuildZones((current) => current.slice(0, -1))} disabled={!buildZones.length}>UNDO ZONE</button>
          <button className="secondary-button" onClick={() => setDecorations((current) => current.slice(0, -1))} disabled={!decorations.length}>UNDO STAMP</button>
          <button className="secondary-button" onClick={() => {
            setMapBase(initialMap); setPaths(initialMap.paths); setObstacles(initialMap.obstacles ?? [])
            setBuildZones(initialMap.buildZones ?? []); setDecorations(initialMap.decorations ?? []); setSecondaryObjective(initialMap.secondaryObjective); setWaves(cloneWaves(initialMap.waves ?? []))
            setActivePathIndex(0); setName(initialMap.name)
          }}>RESET MAP</button>
        </div>
        {mapError && <p className="editor-error">{mapError}</p>}
        <WaveSetEditor waves={waves} laneCount={paths.length} onChange={setWaves} />
        <details className="editor-json">
          <summary>JSON IMPORT / EXPORT</summary>
          <button className="secondary-button" onClick={() => { setJsonDraft(JSON.stringify(currentMap(), null, 2)); setJsonError(null) }}>GENERATE JSON</button>
          <textarea aria-label="Map JSON" value={jsonDraft} onChange={(event) => setJsonDraft(event.target.value)} placeholder="Paste a MapDefinition here…" />
          {jsonError && <p className="editor-error">{jsonError}</p>}
          <button className="secondary-button" onClick={loadJson} disabled={!jsonDraft.trim()}>LOAD JSON DRAFT</button>
        </details>
        <div className="editor-help">
          <span><i className="dot spawn" /> First point: spawn</span>
          <span><i className="dot route" /> Middle points: bends</span>
          <span><i className="dot base" /> Final point: fortress</span>
        </div>
        <div className="editor-footer">
          <button className="secondary-button" onClick={onCancel}>CANCEL</button>
          <button className="primary-button" onClick={save} disabled={!routeIsValid}>SAVE & PLAY</button>
        </div>
      </aside>
      <div className="editor-canvas-wrap">
        <div className="grid-label">{mapBase.width} × {mapBase.depth} FIELD UNITS</div>
        <svg
          className="map-editor-canvas"
          style={{ aspectRatio: `${mapBase.width} / ${mapBase.depth}` }}
          viewBox={`${-mapBase.width / 2} ${-mapBase.depth / 2} ${mapBase.width} ${mapBase.depth}`}
          onClick={addPoint}
          role="img"
          aria-label="Editable battlefield route"
        >
          <defs>
            <pattern id="smallGrid" width="1" height="1" patternUnits="userSpaceOnUse">
              <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#94a079" strokeWidth="0.025" opacity="0.28" />
            </pattern>
          </defs>
          <rect x={-mapBase.width / 2} y={-mapBase.depth / 2} width={mapBase.width} height={mapBase.depth} fill={mapBase.palette?.ground ?? '#293b27'} />
          <rect x={-mapBase.width / 2} y={-mapBase.depth / 2} width={mapBase.width} height={mapBase.depth} fill="url(#smallGrid)" />
          {buildZones.map((zone, index) => (
            <circle key={`zone-${index}`} cx={zone.x} cy={zone.z} r={zone.radius} fill="#d9c45c" fillOpacity="0.12" stroke="#e7d36c" strokeWidth="0.12" strokeDasharray="0.35 0.2" />
          ))}
          {obstacles.map((obstacle, index) => (
            <g key={`obstacle-${index}`}>
              <circle cx={obstacle.x} cy={obstacle.z} r={obstacle.radius} fill={mapBase.palette?.rock ?? '#77765e'} stroke="#24271f" strokeWidth="0.12" />
              <path d={`M ${obstacle.x - 0.3} ${obstacle.z + 0.15} l 0.22 -0.42 l 0.46 0.08 l 0.18 0.4 l -0.35 0.27 z`} fill="#a29c79" opacity="0.55" />
            </g>
          ))}
          {decorations.map((decoration, index) => <DecorationStamp key={`decoration-${index}`} decoration={decoration} />)}
          {secondaryObjective && <SupplyCacheStamp objective={secondaryObjective} />}
          {paths.map((path, pathIndex) => {
            const polyline = path.map((point) => `${point.x},${point.z}`).join(' ')
            return (
              <g key={pathIndex} opacity={pathIndex === activePathIndex ? 1 : 0.58}>
                {path.length > 1 && <polyline points={polyline} fill="none" stroke={mapBase.palette?.path ?? '#91764a'} strokeWidth={mapBase.pathWidth} strokeLinecap="round" strokeLinejoin="round" />}
                {path.map((point, index) => (
                  <g key={`${point.x}-${point.z}-${index}`}>
                    <circle cx={point.x} cy={point.z} r="0.34" fill={index === 0 ? '#d8664f' : index === path.length - 1 ? '#e7cf68' : '#d9dec1'} stroke="#111711" strokeWidth="0.08" />
                    <text x={point.x} y={point.z + 0.1} textAnchor="middle" fontSize="0.28" fill="#10150f" fontWeight="bold">{index + 1}</text>
                  </g>
                ))}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function round(value: number): number { return Math.round(value * 2) / 2 }

function clampNumber(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

function isDecorationTool(tool: string): tool is MapDecorationKind {
  return tool === 'tree' || tool === 'shrub' || tool === 'crater'
}

function DecorationStamp({ decoration }: { decoration: MapDecoration }) {
  if (decoration.kind === 'tree') return <g><circle cx={decoration.x} cy={decoration.z} r="0.42" fill="#395c32" stroke="#172a18" strokeWidth="0.1" /><circle cx={decoration.x - 0.12} cy={decoration.z - 0.12} r="0.23" fill="#5d7840" /></g>
  if (decoration.kind === 'shrub') return <circle cx={decoration.x} cy={decoration.z} r="0.28" fill="#6d8140" stroke="#26351e" strokeWidth="0.08" />
  return <circle cx={decoration.x} cy={decoration.z} r="0.36" fill="#302d27" fillOpacity="0.6" stroke="#796855" strokeWidth="0.12" />
}

function SupplyCacheStamp({ objective }: { objective: MapSecondaryObjective }) {
  return <g><rect x={objective.x - 0.42} y={objective.z - 0.34} width="0.84" height="0.68" rx="0.08" fill="#b88a42" stroke="#fff0a0" strokeWidth="0.1" /><path d={`M ${objective.x - 0.32} ${objective.z} h 0.64 M ${objective.x} ${objective.z - 0.25} v 0.5`} stroke="#4b351f" strokeWidth="0.09" /></g>
}

function cloneWaves(waves: readonly WaveDefinition[]): WaveDefinition[] {
  return waves.map((wave) => ({ ...wave, groups: wave.groups.map((group) => ({ ...group })) }))
}

function findPalettePreset(palette: MapDefinition['palette']): MapPalettePreset {
  const entry = Object.entries(MAP_PALETTE_PRESETS).find(([, preset]) => preset.palette.ground === palette?.ground
    && preset.palette.path === palette.path && preset.palette.background === palette.background && preset.palette.rock === palette.rock)
  return (entry?.[0] as MapPalettePreset | undefined) ?? 'woodland'
}

function getRouteError(paths: Point[][]): string | null {
  const fortress = paths[0]?.at(-1)
  if (!fortress || paths.some((path) => path.length < 2 || buildPathInfo(path).totalLength < 1)) return 'Every lane needs at least two different route points.'
  const sharesFortress = paths.every((path) => {
    const end = path.at(-1)
    return Boolean(end && Math.hypot(end.x - fortress.x, end.z - fortress.z) <= 0.25)
  })
  return sharesFortress ? null : 'Every lane must finish on the same yellow fortress point.'
}
