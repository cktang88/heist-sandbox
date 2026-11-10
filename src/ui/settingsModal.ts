import { applyLook, currentSeed, reloadWith } from './address'
import { h, panel } from './dom'
import { CHOICE_LABELS, DEFAULT_SETTINGS, LOOKS, needsReload, parseSeed, QUALITIES, SITES, VIEWS, type Settings } from './settings'
import { saveSettings } from './store'

export type SettingsHooks = {
  /** Sound and gameplay settings apply at once; this hands the new values to the game. */
  live(settings: Settings): void
  /** Everything chosen so far, applied or not, so the screen opens on it next time. */
  chosen(settings: Settings): void
  playSeed(seed: number): void
}

type Option<T extends string> = { value: T; label: string }
const options = <T extends keyof typeof CHOICE_LABELS>(values: readonly T[]): Option<T>[] => values.map((value) => ({ value, label: CHOICE_LABELS[value] }))

function row(label: string, note: string, control: HTMLElement): HTMLElement {
  return h('div', { class: 'sg-row' }, h('div', { class: 'sg-label' }, h('span', { text: label }), note ? h('small', { text: note }) : null), control)
}

function section(title: string, ...rows: HTMLElement[]): HTMLElement {
  return h('fieldset', { class: 'sg-section' }, h('legend', { text: title }), ...rows)
}

/**
 * Settings. Sound and gameplay apply at once. Art style, quality, view and site are read when the page starts,
 * so they collect here and "Apply" reloads the page with the same seed.
 */
export function settingsModal(running: Settings, chosen: Settings, hooks: SettingsHooks): HTMLElement {
  let draft = { ...chosen }
  // What the running page uses: the start-up settings until a reload, apart from the live ones and a live look switch.
  let applied = { ...running }
  const refreshers: (() => void)[] = []
  const refresh = () => refreshers.forEach((update) => update())

  // Everything chosen is saved straight away, so the next visit starts with it even without "Apply".
  function change(patch: Partial<Settings>): void {
    draft = { ...draft, ...patch }
    saveSettings(draft)
    applied = { ...applied, volume: draft.volume, muted: draft.muted, autoSlowmo: draft.autoSlowmo, shake: draft.shake }
    hooks.live(applied)
    hooks.chosen(draft)
    refresh()
  }

  function segments<K extends 'look' | 'quality' | 'view' | 'site'>(key: K, choices: Option<Settings[K]>[]): HTMLElement {
    const buttons = choices.map((choice) => h('button', { class: 'sg-seg', text: choice.label, attrs: { type: 'button' }, on: { click: () => change({ [key]: choice.value }) } }))
    refreshers.push(() => buttons.forEach((button, index) => {
      const value = choices[index].value
      button.setAttribute('aria-pressed', String(draft[key] === value))
      button.classList.toggle('sg-pending', draft[key] === value && applied[key] !== value)
    }))
    return h('div', { class: 'sg-segs', attrs: { role: 'group' } }, ...buttons)
  }

  function toggle(key: 'muted' | 'autoSlowmo' | 'shake'): HTMLElement {
    const button = h('button', { class: 'sg-toggle', attrs: { type: 'button' }, on: { click: () => change({ [key]: !draft[key] }) } })
    refreshers.push(() => {
      button.setAttribute('aria-pressed', String(draft[key]))
      button.textContent = draft[key] ? 'ON' : 'OFF'
    })
    return button
  }

  const volume = h('input', { class: 'sg-range', attrs: { type: 'range', min: '0', max: '100', step: '5', 'aria-label': 'Master volume' } })
  volume.addEventListener('input', () => change({ volume: Number(volume.value) / 100 }))
  const volumeText = h('output', { class: 'sg-value' })
  refreshers.push(() => {
    volume.value = String(Math.round(draft.volume * 100))
    volumeText.textContent = `${Math.round(draft.volume * 100)}%`
  })

  const seed = h('input', { class: 'sg-input', attrs: { type: 'text', inputmode: 'numeric', value: String(currentSeed()), 'aria-label': 'Seed', maxlength: '9' } })
  const play = h('button', { class: 'sg-btn', text: 'Play', attrs: { type: 'button' }, on: { click: () => {
    const chosen = parseSeed(seed.value)
    if (chosen === null) seed.classList.add('sg-bad')
    else hooks.playSeed(chosen)
  } } })
  seed.addEventListener('input', () => seed.classList.toggle('sg-bad', parseSeed(seed.value) === null))
  seed.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Enter') play.click()
  })

  const apply = h('button', { class: 'sg-btn sg-primary', text: 'Apply and restart', attrs: { type: 'button' }, on: { click: () => {
    // The art style goes through its own switch, so a live one can replace the reload later.
    if (draft.look !== applied.look && !needsReload({ ...applied, look: draft.look }, draft)) {
      // A live switch (the 3D view) keeps the page: the look is now the running one, no longer pending.
      if (applyLook(draft.look)) {
        applied = { ...applied, look: draft.look }
        hooks.live(applied)
        refresh()
      }
    } else reloadWith(draft)
  } } })
  const reset = h('button', { class: 'sg-btn', text: 'Reset to defaults', attrs: { type: 'button' }, on: { click: () => change({ ...DEFAULT_SETTINGS }) } })
  refreshers.push(() => {
    apply.disabled = !needsReload(applied, draft)
  })

  const body = h('div', { class: 'sg-body sg-settings' },
    h('div', { class: 'sg-cols' },
      h('div', {},
        section('Display',
          row('Art style', '', segments('look', options(LOOKS))),
          row('Graphics quality', '', segments('quality', options(QUALITIES))),
          row('View', '2D needs no graphics card', segments('view', options(VIEWS))),
        ),
        section('Heist',
          row('Site', '', segments('site', options(SITES))),
          row('Seed', 'same seed, same heist', h('div', { class: 'sg-inline' }, seed, play)),
        ),
      ),
      h('div', {},
        section('Sound',
          row('Master volume', '', h('div', { class: 'sg-inline' }, volume, volumeText)),
          row('Mute', '', toggle('muted')),
        ),
        section('Gameplay',
          row('Auto slow motion', 'when spotted, near misses, kills. Shift focus stays', toggle('autoSlowmo')),
          row('Screen shake', '', toggle('shake')),
        ),
      ),
    ),
    h('div', { class: 'sg-actions' }, reset, h('span', { class: 'sg-note', text: 'Striped choices take effect after a restart (same seed).' }), apply),
  )
  refresh()
  return panel('Settings', '// SYS.CONFIG', body, true)
}
