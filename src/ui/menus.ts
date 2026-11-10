import type { GameAudio } from '../audio'
import type { World } from '../game/world'
import { currentSeed, currentSettings, randomSeed } from './address'
import { controlsModal } from './controlsModal'
import { applyGameplay } from './gameplay'
import { helpModal } from './helpModal'
import { createLayerStack } from './layers'
import './menu.css'
import { pauseMenu } from './pauseMenu'
import { dossier } from '../game/people/dossier'
import { tonightBlock } from './briefing'
import { h } from './dom'
import { pastHeistsButton, pastHeistsModal } from './debrief'
import { dossierModal } from './dossier'
import { settingsModal } from './settingsModal'

/** What the menus need from the game loop. */
export type MenuHost = {
  audio: GameAudio
  site: string
  /** Starts a fresh heist on this seed, in place. */
  newHeist(seed: number): void
  /** The heist in progress, for the pause menu's "Tonight" lines and the dossier of guards met so far. */
  world(): World
}

export type Menus = {
  /** True while any menu is open: the game loop must not step the heist. */
  paused(): boolean
  /** Applies the gameplay settings after each step. */
  afterStep(world: World): void
}

type ModalName = 'controls' | 'help' | 'settings' | 'past' | 'dossier'

/**
 * The pause menu and the controls, help and settings screens, drawn as page elements over the game.
 * While one is open the game hears no keys: they stop here, before the input adapter on `window`.
 */
export function createMenus(host: MenuHost): Menus {
  let settings = currentSettings()
  // What the settings screen last showed, including choices not applied yet, so reopening it does not forget them.
  let chosen = settings
  let paused = false
  const updateVolume = () => host.audio.setVolume(paused || settings.muted ? 0 : settings.volume)
  const stack = createLayerStack((open) => {
    paused = open
    updateVolume()
  })
  updateVolume()

  function startHeist(seed: number): void {
    stack.clear()
    host.newHeist(seed)
  }

  function openModal(name: ModalName): void {
    if (stack.top() === name) return
    if (name === 'controls') stack.push(name, controlsModal())
    if (name === 'help') stack.push(name, helpModal())
    if (name === 'past') stack.push(name, pastHeistsModal())
    if (name === 'dossier') stack.push(name, dossierModal(dossier(host.world())))
    if (name === 'settings') stack.push(name, settingsModal(settings, chosen, {
      live: (running) => {
        settings = running
        updateVolume()
      },
      chosen: (draft) => {
        chosen = draft
      },
      playSeed: startHeist,
    }))
  }

  function openPause(): void {
    const pause = pauseMenu(currentSeed(), host.site, {
      resume: () => stack.clear(),
      controls: () => openModal('controls'),
      help: () => openModal('help'),
      settings: () => openModal('settings'),
      sameSeed: () => startHeist(currentSeed()),
      newSeed: () => startHeist(randomSeed()),
    })
    const rule = pause.querySelector('.sg-rule')
    rule?.before(pastHeistsButton(() => openModal('past')))
    rule?.before(h('button', { class: 'sg-item', attrs: { type: 'button' }, on: { click: () => openModal('dossier') } }, h('span', { text: 'Dossier' })))
    const tonight = tonightBlock(host.world())
    if (tonight) pause.querySelector('.sg-items')?.after(tonight)
    stack.push('pause', pause)
  }

  // Bubble phase on `document`: the menus' own handlers (Tab trapping, Enter on buttons) run first,
  // and stopping the event here keeps it from the game's input adapter, which listens on `window`.
  document.addEventListener('keydown', (event) => {
    const top = stack.top()
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey
    if (!top) {
      if (event.code === 'Escape' || (event.code === 'KeyP' && plain)) openPause()
      else if (event.code === 'KeyH' && plain) openModal('help')
      else if ((event.code === 'KeyK' && plain) || event.code === 'F1') openModal('controls')
      if (event.code === 'F1') event.preventDefault()
      // The opening key still reaches the game, which ignores it but uses a first key press to start sound.
      return
    }
    event.stopPropagation()
    if (event.code === 'Escape') {
      event.preventDefault()
      stack.pop()
      return
    }
    if (event.target instanceof HTMLInputElement && event.target.type === 'text') return
    if (event.code === 'KeyP' && top === 'pause') stack.clear()
    else if (event.code === 'KeyH' && plain) openModal('help')
    else if ((event.code === 'KeyK' && plain) || event.code === 'F1') {
      event.preventDefault()
      openModal('controls')
    }
  })

  return {
    paused: () => paused,
    afterStep: (world) => applyGameplay(world, settings),
  }
}
