import { useEffect, useState } from 'react'
import { findBuiltInMap } from '../game/maps'
import type { MapDefinition } from '../game/types'

type MapLibraryPanelProps = {
  maps: readonly MapDefinition[]
  selectedMap: MapDefinition
  onSelect: (map: MapDefinition) => void
  onNew: () => void
  onDuplicate: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onEdit: () => void
  onPlay: () => void
}

export function MapLibraryPanel({
  maps, selectedMap, onSelect, onNew, onDuplicate, onRename, onDelete, onEdit, onPlay,
}: MapLibraryPanelProps) {
  const [name, setName] = useState(selectedMap.name)
  const selectedIsCustom = !findBuiltInMap(selectedMap.id)

  useEffect(() => setName(selectedMap.name), [selectedMap.id, selectedMap.name])

  return (
    <section className="map-library" aria-label="Custom map library">
      <header><b>MAP FORGE LIBRARY</b><small>{maps.filter((map) => !findBuiltInMap(map.id)).length} CUSTOM</small></header>
      <div className="map-library-list">
        {maps.map((map) => {
          const custom = !findBuiltInMap(map.id)
          return (
            <button key={map.id} className={map.id === selectedMap.id ? 'selected' : ''} onClick={() => onSelect(map)}>
              <span>{map.name}</span>
              <small>{custom ? 'CUSTOM' : 'BUILT-IN'} · {map.paths.length} {map.paths.length === 1 ? 'LANE' : 'LANES'}</small>
            </button>
          )
        })}
      </div>
      <div className="map-library-rename">
        <input aria-label="Selected map name" value={name} onChange={(event) => setName(event.target.value)} disabled={!selectedIsCustom} />
        <button onClick={() => onRename(name)} disabled={!selectedIsCustom || !name.trim() || name.trim() === selectedMap.name}>RENAME</button>
      </div>
      <div className="map-library-actions">
        <button onClick={onNew}>NEW</button>
        <button onClick={onDuplicate}>DUPLICATE</button>
        <button onClick={onDelete} disabled={!selectedIsCustom}>DELETE</button>
        <button onClick={onEdit}>EDIT</button>
        <button className="play" onClick={onPlay}>PLAY</button>
      </div>
    </section>
  )
}
