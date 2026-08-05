import { DEFAULT_SETTINGS, type GameSettings } from '../game/settings'
import { ModalFrame } from './ModalFrame'

export function SettingsPanel({ settings, onChange, onClose }: {
  settings: GameSettings
  onChange: (settings: GameSettings) => void
  onClose: () => void
}) {
  const set = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => onChange({ ...settings, [key]: value })
  return (
    <ModalFrame label="Game settings" backdropClass="settings-backdrop" panelClass="settings-panel" onClose={onClose}>
        <header><div><p className="eyebrow">COMMAND OPTIONS</p><h2>SETTINGS</h2></div><button data-autofocus onClick={onClose} aria-label="Close settings">×</button></header>
        <div className="settings-fields">
          <Slider label="MASTER VOLUME" value={settings.masterVolume} onChange={(value) => set('masterVolume', value)} />
          <Slider label="EFFECTS VOLUME" value={settings.effectsVolume} onChange={(value) => set('effectsVolume', value)} />
          <Slider label="MUSIC VOLUME" value={settings.musicVolume} onChange={(value) => set('musicVolume', value)} />
          <Slider label="UI SCALE" value={settings.uiScale} min={0.85} max={1.25} onChange={(value) => set('uiScale', value)} />
          <Toggle label="REDUCED FLASHES" checked={settings.reducedFlashes} onChange={(value) => set('reducedFlashes', value)} />
          <Toggle label="SCREEN SHAKE" checked={settings.screenShake} onChange={(value) => set('screenShake', value)} />
          <label><span>CORPSE DENSITY</span><select value={settings.corpseDensity} onChange={(event) => set('corpseDensity', event.target.value as GameSettings['corpseDensity'])}>
            <option value="off">OFF</option><option value="low">LOW</option><option value="high">HIGH</option>
          </select></label>
          <Toggle label="PAUSE WHEN FOCUS IS LOST" checked={settings.pauseOnBlur} onChange={(value) => set('pauseOnBlur', value)} />
        </div>
        <footer><button className="secondary-button" onClick={() => onChange(DEFAULT_SETTINGS)}>RESET</button><button className="primary-button" onClick={onClose}>DONE</button></footer>
    </ModalFrame>
  )
}

function Slider({ label, value, onChange, min = 0, max = 1 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  return <label><span>{label}<b>{Math.round(value * 100)}%</b></span><input type="range" min={min} max={max} step="0.05" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="settings-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>
}
