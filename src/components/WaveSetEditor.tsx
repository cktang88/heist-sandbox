import type { EnemyKind, SpawnGroup, WaveDefinition } from '../game/types'

const ENEMY_KINDS: readonly EnemyKind[] = ['grunt', 'runner', 'brute', 'shieldbearer', 'armored', 'shaman', 'banner', 'sapper', 'berserker', 'ogre']
const NEW_GROUP: SpawnGroup = { enemy: 'grunt', count: 10, interval: 0.5, startDelay: 0 }

type WaveSetEditorProps = {
  waves: readonly WaveDefinition[]
  laneCount: number
  onChange: (waves: WaveDefinition[]) => void
}

export function WaveSetEditor({ waves, laneCount, onChange }: WaveSetEditorProps) {
  const updateWave = (waveIndex: number, update: (wave: WaveDefinition) => WaveDefinition) => {
    onChange(waves.map((wave, index) => index === waveIndex ? update(wave) : cloneWave(wave)))
  }

  const updateGroup = (waveIndex: number, groupIndex: number, update: Partial<SpawnGroup>) => {
    updateWave(waveIndex, (wave) => ({
      ...wave,
      groups: wave.groups.map((group, index) => index === groupIndex ? { ...group, ...update } : group),
    }))
  }

  const updateMultiplier = (waveIndex: number, stat: 'health' | 'speed' | 'damage', value: number) => {
    updateWave(waveIndex, (wave) => ({ ...wave, multipliers: { ...wave.multipliers, [stat]: value } }))
  }

  return (
    <details className="editor-waves">
      <summary>WAVE SET · {waves.length ? `${waves.length} AUTHORED` : 'STANDARD'}</summary>
      {!waves.length ? (
        <button className="secondary-button" onClick={() => onChange([newWave()])}>AUTHOR WAVES</button>
      ) : <>
        {waves.map((wave, waveIndex) => (
          <section className="wave-editor" key={waveIndex}>
            <header>
              <b>WAVE {waveIndex + 1}</b>
              <label>BREAK <input aria-label={`Wave ${waveIndex + 1} intermission`} type="number" min="0" max="60" step="0.1" value={wave.intermission} onChange={(event) => updateWave(waveIndex, (current) => ({ ...current, intermission: Number(event.target.value) }))} /></label>
              <label>REWARD <input aria-label={`Wave ${waveIndex + 1} reward multiplier`} type="number" min="0.25" max="5" step="0.05" value={wave.rewardMultiplier ?? 1} onChange={(event) => updateWave(waveIndex, (current) => ({ ...current, rewardMultiplier: Number(event.target.value) }))} /></label>
              <label className="wave-boss">BOSS <input aria-label={`Wave ${waveIndex + 1} boss marker`} type="checkbox" checked={wave.boss ?? false} onChange={(event) => updateWave(waveIndex, (current) => ({ ...current, boss: event.target.checked || undefined }))} /></label>
              <button onClick={() => onChange(waves.filter((_, index) => index !== waveIndex).map(cloneWave))}>×</button>
            </header>
            <div className="wave-multipliers" aria-label={`Wave ${waveIndex + 1} enemy multipliers`}>
              <label>HP ×<input aria-label={`Wave ${waveIndex + 1} health multiplier`} type="number" min="0.1" max="20" step="0.05" value={wave.multipliers?.health ?? 1} onChange={(event) => updateMultiplier(waveIndex, 'health', Number(event.target.value))} /></label>
              <label>SPEED ×<input aria-label={`Wave ${waveIndex + 1} speed multiplier`} type="number" min="0.1" max="20" step="0.05" value={wave.multipliers?.speed ?? 1} onChange={(event) => updateMultiplier(waveIndex, 'speed', Number(event.target.value))} /></label>
              <label>DAMAGE ×<input aria-label={`Wave ${waveIndex + 1} damage multiplier`} type="number" min="0.1" max="20" step="0.05" value={wave.multipliers?.damage ?? 1} onChange={(event) => updateMultiplier(waveIndex, 'damage', Number(event.target.value))} /></label>
            </div>
            {wave.groups.map((group, groupIndex) => (
              <div className="wave-group" key={groupIndex}>
                <select aria-label={`Wave ${waveIndex + 1} group ${groupIndex + 1} enemy`} value={group.enemy} onChange={(event) => updateGroup(waveIndex, groupIndex, { enemy: event.target.value as EnemyKind })}>
                  {ENEMY_KINDS.map((enemy) => <option key={enemy} value={enemy}>{enemy}</option>)}
                </select>
                <input aria-label={`Wave ${waveIndex + 1} group ${groupIndex + 1} count`} title="Count" type="number" min="1" max="5000" value={group.count} onChange={(event) => updateGroup(waveIndex, groupIndex, { count: Number(event.target.value) })} />
                <input aria-label={`Wave ${waveIndex + 1} group ${groupIndex + 1} interval`} title="Interval" type="number" min="0.05" max="30" step="0.05" value={group.interval} onChange={(event) => updateGroup(waveIndex, groupIndex, { interval: Number(event.target.value) })} />
                <input aria-label={`Wave ${waveIndex + 1} group ${groupIndex + 1} delay`} title="Delay" type="number" min="0" max="120" step="0.1" value={group.startDelay ?? 0} onChange={(event) => updateGroup(waveIndex, groupIndex, { startDelay: Number(event.target.value) })} />
                <select aria-label={`Wave ${waveIndex + 1} group ${groupIndex + 1} lane`} value={group.lane ?? 'auto'} onChange={(event) => updateGroup(waveIndex, groupIndex, { lane: event.target.value === 'auto' ? undefined : Number(event.target.value) })}>
                  <option value="auto">ALL</option>
                  {Array.from({ length: laneCount }, (_, index) => <option key={index} value={index}>L{index + 1}</option>)}
                </select>
                <button aria-label={`Remove wave ${waveIndex + 1} group ${groupIndex + 1}`} disabled={wave.groups.length <= 1} onClick={() => updateWave(waveIndex, (current) => ({ ...current, groups: current.groups.filter((_, index) => index !== groupIndex) }))}>×</button>
              </div>
            ))}
            <button className="wave-add" disabled={wave.groups.length >= 16} onClick={() => updateWave(waveIndex, (current) => ({ ...current, groups: [...current.groups, { ...NEW_GROUP }] }))}>+ GROUP</button>
          </section>
        ))}
        <div className="wave-editor-actions">
          <button className="secondary-button" disabled={waves.length >= 30} onClick={() => onChange([...waves.map(cloneWave), newWave()])}>+ WAVE</button>
          <button className="secondary-button" onClick={() => onChange([])}>USE STANDARD</button>
        </div>
      </>}
    </details>
  )
}

function newWave(): WaveDefinition {
  return { groups: [{ ...NEW_GROUP }], intermission: 1.4 }
}

function cloneWave(wave: WaveDefinition): WaveDefinition {
  return { ...wave, groups: wave.groups.map((group) => ({ ...group })) }
}
