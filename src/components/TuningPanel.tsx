import { useEffect, useState } from 'react'
import { ACTIVE_POWER_OPTIONS, BUILD, DEFAULT_TUNING, TOWER_KINDS } from '../game/config'
import { storeTuning } from '../game/tuningStore'
import type { ActivePowerKind, EnemyKind, GameTuning, TowerKind } from '../game/types'
import type { RuntimeTelemetry } from './GameScene'

type TuningField = {
  id: string
  label: string
  step: number
  min?: number
  read: (tuning: GameTuning) => number
  write: (tuning: GameTuning, value: number) => GameTuning
}

const towerField = (kind: TowerKind, stat: 'cost' | 'damage' | 'range' | 'shotsPerSecond', label: string, step: number): TuningField => ({
  id: `${kind}-${stat}`,
  label,
  step,
  read: (tuning) => tuning.towers[kind][stat],
  write: (tuning, value) => ({ ...tuning, towers: { ...tuning.towers, [kind]: { ...tuning.towers[kind], [stat]: value } } }),
})

const enemyField = (kind: EnemyKind, stat: 'health' | 'speed' | 'baseDamage' | 'wallDamagePerSecond', label: string, step: number): TuningField => ({
  id: `${kind}-${stat}`,
  label,
  step,
  read: (tuning) => tuning.enemies[kind][stat],
  write: (tuning, value) => ({ ...tuning, enemies: { ...tuning.enemies, [kind]: { ...tuning.enemies[kind], [stat]: value } } }),
})

const powerField = (kind: ActivePowerKind, stat: 'cooldown' | 'damage' | 'size', label: string, step: number): TuningField => ({
  id: `${kind}-${stat}`,
  label,
  step,
  min: stat === 'damage' ? 0 : 0.1,
  read: (tuning) => tuning.powers[kind][stat],
  write: (tuning, value) => ({ ...tuning, powers: { ...tuning.powers, [kind]: { ...tuning.powers[kind], [stat]: value } } }),
})

const ENEMY_KINDS: readonly EnemyKind[] = ['grunt', 'runner', 'brute', 'shieldbearer', 'armored', 'shaman', 'banner', 'sapper', 'berserker', 'ogre']

const FIELDS: readonly TuningField[] = [
  { id: 'budget', label: 'Starting supply', step: 5, read: (tuning) => tuning.budget, write: (tuning, value) => ({ ...tuning, budget: value }) },
  ...TOWER_KINDS.flatMap((kind) => [
    towerField(kind, 'cost', `${BUILD.items[kind].label} cost`, 5),
    towerField(kind, 'damage', `${BUILD.items[kind].label} damage`, 1),
    towerField(kind, 'range', `${BUILD.items[kind].label} range`, 0.1),
    towerField(kind, 'shotsPerSecond', `${BUILD.items[kind].label} fire rate`, 0.1),
  ]),
  ...ENEMY_KINDS.flatMap((kind) => [
    enemyField(kind, 'health', `${kind} health`, 1),
    enemyField(kind, 'speed', `${kind} speed`, 0.1),
    enemyField(kind, 'baseDamage', `${kind} fortress damage`, 1),
    enemyField(kind, 'wallDamagePerSecond', `${kind} wall damage / sec`, 1),
  ]),
  ...ACTIVE_POWER_OPTIONS.flatMap(({ kind, label }) => [
    powerField(kind, 'cooldown', `${label} cooldown`, 0.5),
    powerField(kind, 'damage', `${label} damage`, 1),
    powerField(kind, 'size', `${label} area size`, 0.1),
  ]),
  { id: 'wall-cost', label: 'Wall cost', step: 1, read: (tuning) => tuning.wall.cost, write: (tuning, value) => ({ ...tuning, wall: { ...tuning.wall, cost: value } }) },
  { id: 'wall-health', label: 'Wall health', step: 5, read: (tuning) => tuning.wall.health, write: (tuning, value) => ({ ...tuning, wall: { ...tuning.wall, health: value } }) },
  { id: 'wall-radius', label: 'Wall collision radius', step: 0.05, read: (tuning) => tuning.wall.collisionRadius, write: (tuning, value) => ({ ...tuning, wall: { ...tuning.wall, collisionRadius: value } }) },
]

export function TuningPanel({ tuning, devUnlockAll, stressAvailable, invulnerable, onToggleDevUnlockAll, onSpawnStress, onSpawnEnemy, onToggleInvulnerable, onResetRuntimeCheats, onChange, onClose, onQuickRestart }: {
  tuning: GameTuning
  devUnlockAll: boolean
  stressAvailable: boolean
  invulnerable: boolean
  onToggleDevUnlockAll: () => void
  onSpawnStress: (count: number, streamed?: boolean) => void
  onSpawnEnemy: (kind: EnemyKind) => void
  onToggleInvulnerable: () => void
  onResetRuntimeCheats: () => void
  onChange: (tuning: GameTuning) => void
  onClose: () => void
  onQuickRestart: () => void
}) {
  const [draft, setDraft] = useState(tuning)
  const [query, setQuery] = useState('')
  const [telemetry, setTelemetry] = useState<RuntimeTelemetry | null>(null)
  const visibleFields = FIELDS.filter((field) => field.label.toLowerCase().includes(query.trim().toLowerCase()))
  const update = (field: TuningField, value: number) => {
    if (!Number.isFinite(value)) return
    setDraft((current) => field.write(current, Math.max(field.min ?? 0.1, value)))
  }

  useEffect(() => {
    const read = () => setTelemetry((globalThis as typeof globalThis & { __ORCFALL_TELEMETRY__?: RuntimeTelemetry }).__ORCFALL_TELEMETRY__ ?? null)
    read()
    const timer = window.setInterval(read, 500)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <aside className="tuning-panel">
      <div className="tuning-title">
        <div><p className="eyebrow">LIVE DEVTOOLS</p><h2>COMBAT TUNING</h2></div>
        <button onClick={onClose} aria-label="Close tuning panel">×</button>
      </div>
      <p>Edit a draft, then apply it with a clean restart so every entity uses the same rules.</p>
      <button className={`dev-unlock-button ${devUnlockAll ? 'active' : ''}`} onClick={onToggleDevUnlockAll}>
        {devUnlockAll ? 'ALL CONTENT UNLOCKED' : 'UNLOCK ALL CONTENT'}
      </button>
      <section className="stress-tools" aria-label="Horde stress tools">
        <span>RUNTIME CHEATS · UNRANKED · NOT SAVED</span>
        <button className={invulnerable ? 'active' : ''} onClick={onToggleInvulnerable} disabled={!stressAvailable}>
          FORTRESS INVULNERABLE: {invulnerable ? 'ON' : 'OFF'}
        </button>
        <div className="enemy-spawn-grid">
          {ENEMY_KINDS.map((kind) => <button key={kind} onClick={() => onSpawnEnemy(kind)} disabled={!stressAvailable}>+ {kind}</button>)}
        </div>
        <div className="stress-presets">
          <button onClick={() => onSpawnStress(2000)} disabled={!stressAvailable}>SPAWN 2,000</button>
          <button onClick={() => onSpawnStress(5000)} disabled={!stressAvailable}>SPAWN 5,000</button>
          <button onClick={() => onSpawnStress(50000, true)} disabled={!stressAvailable}>STREAM 50,000</button>
        </div>
        {telemetry && <dl className="runtime-telemetry" aria-label="Runtime telemetry">
          <div><dt>LIVE / DRAWN</dt><dd>{telemetry.entities.toLocaleString()} / {telemetry.renderedOrcs.toLocaleString()}</dd></div>
          <div><dt>FPS / FRAME</dt><dd>{telemetry.fps.toFixed(0)} / {telemetry.frameMs.toFixed(1)}ms</dd></div>
          <div><dt>SIM STEP</dt><dd>{telemetry.lastStepMs.toFixed(2)}ms</dd></div>
          <div><dt>SPATIAL CHECKS</dt><dd>{telemetry.candidatesChecked.toLocaleString()}</dd></div>
          {telemetry.stressRemaining > 0 && <div><dt>STREAM LEFT</dt><dd>{telemetry.stressRemaining.toLocaleString()}</dd></div>}
        </dl>}
        <button className="runtime-reset" onClick={onResetRuntimeCheats}>RESET RUNTIME CHEATS</button>
        {!stressAvailable && <small>Start a battle to inject a diagnostic horde.</small>}
      </section>
      <label className="tuning-search">
        <span>FIND A METRIC</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try: ogre, range, wall…" />
      </label>
      <div className="tuning-fields">
        {visibleFields.map((field) => (
          <label key={field.id}>
            <span>{field.label}</span>
            <input type="number" min={field.min ?? 0.1} step={field.step} value={field.read(draft)} onChange={(event) => update(field, Number(event.target.value))} />
          </label>
        ))}
        {visibleFields.length === 0 && <p className="tuning-empty">No matching metrics.</p>}
      </div>
      <div className="tuning-actions">
        <button className="secondary-button" onClick={() => setDraft(structuredClone(DEFAULT_TUNING))}>RESET VALUES</button>
        <button className="primary-button" onClick={() => { onChange(draft); storeTuning(draft); onQuickRestart() }}>APPLY & RESTART</button>
      </div>
      <small>Shortcut: backtick (`)</small>
    </aside>
  )
}
