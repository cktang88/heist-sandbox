import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { BattleControls } from './components/BattleControls'
import { BattleStatsPanel } from './components/BattleStatsPanel'
import { BriefingPanel } from './components/BriefingPanel'
import { DeploymentPanel } from './components/DeploymentPanel'
import { GameScene, type BattleEndReason, type StressCommand } from './components/GameScene'
import { HelpPanel } from './components/HelpPanel'
import { MapEditor } from './components/MapEditor'
import { ResultsReport } from './components/ResultsReport'
import { SettingsPanel } from './components/SettingsPanel'
import { Status } from './components/Status'
import { TuningPanel } from './components/TuningPanel'
import { UpgradePanel } from './components/UpgradePanel'
import { hasNewReadyCooldown, playSound, setBattleMusic } from './game/audio'
import { ACTIVE_POWER_OPTIONS, DEFAULT_TUNING, getBuildCost, isOffensiveTowerKind, isTowerKind, TOWER_KINDS } from './game/config'
import { applyCommanderDoctrine, canStartWithDeployment, DEFAULT_LOADOUT, getRunLoadoutLimits, getSetupBuildTools, isCommanderDoctrineUnlocked, loadoutsEqual, MAX_LOADOUT_POWERS, MAX_LOADOUT_TOWERS, normalizeLoadout, normalizeUnlockedCommanderDoctrine, resolveRunLoadout, toggleLoadoutPower, toggleLoadoutTower, type Loadout } from './game/loadout'
import { keyboardAction } from './game/input'
import { layoutIdForLevel, loadDefenseLayout, restoreLayout, storeDefenseLayout } from './game/layoutStore'
import { createCustomMap, deleteCustomMap, loadAvailableMaps, loadMap, storeMap } from './game/mapStore'
import { DEFAULT_MAP, findBuiltInMap } from './game/maps'
import { isValidPlacement } from './game/placement'
import { consumePowerCharge, hasPowerCharge, type PowerChargeState } from './game/powerCharges'
import { beginPlacementMove, cancelPlacementMove, placeMovedPlacement, removeSetupPlacement, rotateWallPlacement, setPlacementTargeting } from './game/setupEditing'
import { CHALLENGES, createInitialSnapshot, findChallenge, findMission, isMissionUnlocked, missionForMap, nextMissionId, runForChallenge, runForMap } from './game/runs'
import { createBattleSessionStart, createRunResult, keepPermanentPlacements } from './game/runSession'
import { calculateRunReward, loadSave, recordRun, storeSave } from './game/save'
import { loadSettings, storeSettings } from './game/settings'
import { loadTuning } from './game/tuningStore'
import { ALL_UPGRADES, deriveGameRules, getNewlyAffordableUpgradeNames, isBuildToolUnlocked, isPowerUnlocked, type UpgradeRanks } from './game/upgrades'
import type { ActivePowerKind, BattleSnapshot, BuildTool, CombatPower, DifficultyTier, GameMode, GamePhase, MapDefinition, Placement, Point, PowerCommand, TargetingRule, TowerKind, TowerVariantId } from './game/types'
import { isTowerVariantSelectionsEqual, normalizeTowerVariantSelections, selectTowerVariant, type TowerVariantSelections } from './game/variantSelection'
import { deriveWallRotation } from './game/wall'
import { aimRotation, defaultTowerRotation } from './game/towerFacing'
import { advanceWallRecharge } from './game/wallRecharge'

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('briefing')
  const [save, setSave] = useState(loadSave)
  const [difficulty, setDifficulty] = useState<DifficultyTier>(save.selectedDifficulty)
  const [initialMap] = useState(loadMap)
  const [mode, setMode] = useState<GameMode>(() => findBuiltInMap(initialMap.id) ? 'campaign' : 'sandbox')
  const [challengeId, setChallengeId] = useState(CHALLENGES[0].id)
  const [selectedTool, setSelectedTool] = useState<BuildTool>('gunner')
  const [placements, setPlacements] = useState<Placement[]>([])
  const [selectedPlacementId, setSelectedPlacementId] = useState<number | null>(null)
  const [movingPlacement, setMovingPlacement] = useState<Placement | null>(null)
  const [map, setMap] = useState<MapDefinition>(() => {
    const mission = missionForMap(initialMap.id)
    return !mission || isMissionUnlocked(save.completedMissionIds, mission.id) ? initialMap : DEFAULT_MAP
  })
  const [snapshot, setSnapshot] = useState<BattleSnapshot>(() => createInitialSnapshot(runForMap(findBuiltInMap(initialMap.id) ? 'campaign' : 'sandbox', map, difficulty)))
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState<1 | 2>(1)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMap, setEditorMap] = useState<MapDefinition>(map)
  const [tuning, setTuning] = useState(loadTuning)
  const [tuningOpen, setTuningOpen] = useState(false)
  const [wallCharges, setWallCharges] = useState(2)
  const [wallCooldown, setWallCooldown] = useState(0)
  const [selectedPower, setSelectedPower] = useState<CombatPower | null>(null)
  const [powerCommand, setPowerCommand] = useState<PowerCommand | null>(null)
  const [stressCommand, setStressCommand] = useState<StressCommand | null>(null)
  const [devInvulnerable, setDevInvulnerable] = useState(false)
  const [powerCharges, setPowerCharges] = useState<PowerChargeState>({
    strafe: 1, barrage: null, cryoBeam: null, nuke: 1, orbitalLaser: null, repair: 1,
  })
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [availableMaps, setAvailableMaps] = useState(loadAvailableMaps)
  const [devUnlockAll, setDevUnlockAll] = useState(false)
  const [rankedRun, setRankedRun] = useState(true)
  const [settings, setSettings] = useState(loadSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [lastMedalsEarned, setLastMedalsEarned] = useState(0)
  const [lastDifficultyBonus, setLastDifficultyBonus] = useState(0)
  const [battleStatsOpen, setBattleStatsOpen] = useState(false)
  const [loadout, setLoadout] = useState<Loadout>(() => ({ ...DEFAULT_LOADOUT, doctrine: save.selectedDoctrine }))
  const [helpOpen, setHelpOpen] = useState(() => save.totalRuns === 0)
  const [variantSelections, setVariantSelections] = useState<TowerVariantSelections>({})
  const [setupCancelRevision, setSetupCancelRevision] = useState(0)
  const [surrenderRevision, setSurrenderRevision] = useState(0)
  const [lastBattleSurrendered, setLastBattleSurrendered] = useState(false)
  const layoutReadyId = useRef<string | null>(null)
  const run = useMemo(() => mode === 'challenge' ? runForChallenge(challengeId) : runForMap(mode, map, difficulty), [mode, map, challengeId, difficulty])

  const variantRanks = useMemo<UpgradeRanks>(() => devUnlockAll
    ? Object.fromEntries(ALL_UPGRADES.map((upgrade) => [upgrade.id, Math.max(1, upgrade.rankCosts.length)])) as UpgradeRanks
    : save.upgrades, [devUnlockAll, save.upgrades])
  const selectedDoctrine = normalizeUnlockedCommanderDoctrine(loadout.doctrine, variantRanks)
  const gameRules = useMemo(() => applyCommanderDoctrine(deriveGameRules(tuning, save.upgrades), selectedDoctrine), [tuning, save.upgrades, selectedDoctrine])
  const effectiveTuning = gameRules.tuning

  useEffect(() => {
    if (devUnlockAll || save.selectedDoctrine === selectedDoctrine) return
    const next = { ...save, selectedDoctrine }
    storeSave(next)
    setSave(next)
  }, [devUnlockAll, save, selectedDoctrine])
  const spent = useMemo(
    () => placements.reduce((sum, item) => sum + getBuildCost(item.kind, effectiveTuning), 0),
    [placements, effectiveTuning],
  )
  const remaining = effectiveTuning.budget - spent
  const hasOffensiveTower = placements.some((item) => isTowerKind(item.kind) && isOffensiveTowerKind(item.kind, effectiveTuning))
  const canStart = !movingPlacement && remaining >= 0 && canStartWithDeployment(hasOffensiveTower, run.mode === 'challenge' ? run.modifiers : undefined)
  const selectedPlacement = placements.find((placement) => placement.id === selectedPlacementId)
  const setupIsRanked = run.mode !== 'sandbox' && !devUnlockAll && JSON.stringify(tuning) === JSON.stringify(DEFAULT_TUNING)
  const availableTowers = TOWER_KINDS.filter((tower) => devUnlockAll || isBuildToolUnlocked(save.upgrades, tower))
  const availablePowers: CombatPower[] = [
    ...ACTIVE_POWER_OPTIONS.filter((power) => devUnlockAll || isPowerUnlocked(save.upgrades, power.kind)).map((power) => power.kind),
    ...(devUnlockAll || isBuildToolUnlocked(save.upgrades, 'wall') ? ['wall' as const] : []),
  ]
  const baseLoadoutLimits = { towerSlots: Math.min(MAX_LOADOUT_TOWERS, gameRules.setup.towerSlots), powerSlots: Math.min(MAX_LOADOUT_POWERS, gameRules.setup.powerSlots) }
  const loadoutLimits = getRunLoadoutLimits(baseLoadoutLimits, run.mode === 'challenge' ? run.modifiers : undefined)
  const { towerSlots: towerSlotLimit, powerSlots: powerSlotLimit } = loadoutLimits
  const normalizedLoadout = useMemo(
    () => ({ ...normalizeLoadout(loadout, availableTowers, availablePowers, loadoutLimits), doctrine: selectedDoctrine }),
    [loadout, availableTowers.join('|'), availablePowers.join('|'), towerSlotLimit, powerSlotLimit, selectedDoctrine],
  )
  const runLoadout = resolveRunLoadout(normalizedLoadout, run.mode === 'challenge' ? run.modifiers : undefined)
  const buildTools = runLoadout.towers
  const activePowers = ACTIVE_POWER_OPTIONS.filter((power) => runLoadout.powers.includes(power.kind))
  const wallPowerAvailable = runLoadout.powers.includes('wall')
  const startingWallAvailable = devUnlockAll || isBuildToolUnlocked(save.upgrades, 'wall') || (run.mode === 'challenge' && Boolean(run.modifiers.allowedTools?.includes('wall')))
  const setupBuildTools: BuildTool[] = getSetupBuildTools(runLoadout, startingWallAvailable)
  const fixedArsenal = run.mode === 'challenge' && Boolean(run.modifiers.allowedTools || run.modifiers.allowedPowers)
  const powersDisabled = run.mode === 'challenge' && Boolean(run.modifiers.noPowers)
  const briefingTowers = fixedArsenal ? runLoadout.towers : availableTowers
  const briefingPowers = fixedArsenal ? runLoadout.powers : availablePowers
  const activeSpeed = run.mode === 'challenge' ? run.modifiers.forcedSpeed ?? speed : speed
  const layoutId = layoutIdForLevel(map.id, run.mode === 'challenge' ? run.challengeId : undefined)
  const savedDefense = useCallback(() => {
    const saved = loadDefenseLayout(layoutId)
    const levelLoadout = normalizeLoadout(saved.loadout
      ? { ...loadout, towers: saved.loadout.towers, powers: saved.loadout.powers }
      : loadout, availableTowers, availablePowers, loadoutLimits)
    const levelRunLoadout = resolveRunLoadout(levelLoadout, run.mode === 'challenge' ? run.modifiers : undefined)
    const levelSetupTools = getSetupBuildTools(levelRunLoadout, startingWallAvailable)
    const variants = normalizeTowerVariantSelections(saved.variants, TOWER_KINDS, variantRanks)
    const restored = restoreLayout(saved.placements, map, levelSetupTools, effectiveTuning)
      .map((placement) => isTowerKind(placement.kind)
        ? { ...placement, variantId: variants[placement.kind] }
        : placement)
    return { placements: restored, variants, loadout: levelLoadout }
  }, [layoutId, map, loadout, availableTowers.join('|'), availablePowers.join('|'), towerSlotLimit, powerSlotLimit, run, startingWallAvailable, effectiveTuning, variantRanks])
  const savedDeployment = useCallback(() => savedDefense().placements, [savedDefense])

  useEffect(() => {
    layoutReadyId.current = null
    const saved = savedDefense()
    setPlacements(saved.placements)
    setVariantSelections(saved.variants)
    setLoadout(saved.loadout)
    setSelectedPlacementId(null)
    setMovingPlacement(null)
  }, [layoutId, map, mode])

  useEffect(() => {
    if (phase !== 'setup') return
    if (layoutReadyId.current !== layoutId) {
      layoutReadyId.current = layoutId
      return
    }
    storeDefenseLayout(layoutId, {
      placements, variants: variantSelections,
      loadout: { towers: [...normalizedLoadout.towers], powers: [...normalizedLoadout.powers] },
    })
  }, [layoutId, phase, placements, variantSelections, normalizedLoadout])

  useEffect(() => {
    const normalized = normalizeTowerVariantSelections(variantSelections, TOWER_KINDS, variantRanks)
    if (!isTowerVariantSelectionsEqual(variantSelections, normalized)) setVariantSelections(normalized)
  }, [variantRanks, variantSelections])

  useEffect(() => {
    setPlacements((items) => items.map((placement) => isTowerKind(placement.kind)
      ? { ...placement, variantId: variantSelections[placement.kind] }
      : placement))
  }, [variantSelections])

  useEffect(() => {
    if (!loadoutsEqual(loadout, normalizedLoadout)) setLoadout(normalizedLoadout)
  }, [loadout, normalizedLoadout])

  useEffect(() => {
    if (!setupBuildTools.includes(selectedTool)) setSelectedTool(setupBuildTools[0] ?? 'gunner')
    if (selectedPower && selectedPower !== 'wall' && !activePowers.some((power) => power.kind === selectedPower)) setSelectedPower(null)
    if (selectedPower === 'wall' && !wallPowerAvailable) setSelectedPower(null)
    setPlacements((items) => items.filter((item) => item.temporary || setupBuildTools.includes(item.kind)))
  }, [setupBuildTools.join('|'), activePowers.map((power) => power.kind).join('|'), wallPowerAvailable])

  useEffect(() => {
    if (phase !== 'setup') return
    setPlacements((items) => restoreLayout(items, map, setupBuildTools, effectiveTuning))
  }, [map, phase, setupBuildTools.join('|'), effectiveTuning])

  useEffect(() => {
    if (phase !== 'battle' || paused || wallCooldown <= 0) return
    const timer = window.setInterval(() => setWallCooldown((current) => advanceWallRecharge(current, 0.1, activeSpeed, false)), 100)
    return () => window.clearInterval(timer)
  }, [activeSpeed, paused, phase, wallCooldown <= 0])

  const updateSave = useCallback((next: typeof save) => {
    const persisted = devUnlockAll ? next : { ...next, selectedDoctrine: normalizeUnlockedCommanderDoctrine(next.selectedDoctrine, next.upgrades) }
    storeSave(persisted)
    setSave(persisted)
    if (!devUnlockAll) {
      setLoadout((current) => ({ ...current, doctrine: normalizeUnlockedCommanderDoctrine(current.doctrine, persisted.upgrades) }))
      setSelectedTool((tool) => isBuildToolUnlocked(persisted.upgrades, tool) ? tool : 'gunner')
      setSelectedPower((power) => power && power !== 'wall'
        ? isPowerUnlocked(persisted.upgrades, power) ? power : null
        : power === 'wall' && !isBuildToolUnlocked(persisted.upgrades, 'wall') ? null : power)
      const wallUnlocked = isBuildToolUnlocked(persisted.upgrades, 'wall')
      setPlacements((items) => items.filter((item) => item.temporary || (item.kind === 'wall' ? wallUnlocked : buildTools.includes(item.kind))))
    }
  }, [buildTools, devUnlockAll])

  const selectMap = (nextMap: MapDefinition, nextMode = mode, nextChallengeId = challengeId) => {
    storeMap(nextMap)
    setMap(nextMap)
    setPlacements([])
    setSelectedPlacementId(null)
    setMovingPlacement(null)
    setDevInvulnerable(false)
    setStressCommand(null)
    const nextRun = nextMode === 'challenge' ? runForChallenge(nextChallengeId) : runForMap(nextMode, nextMap, difficulty)
    setSnapshot(createInitialSnapshot(nextRun))
  }

  const selectDifficulty = (nextDifficulty: DifficultyTier) => {
    setDifficulty(nextDifficulty)
    const nextSave = { ...save, selectedDifficulty: nextDifficulty }
    storeSave(nextSave)
    setSave(nextSave)
    if (mode === 'campaign' || mode === 'endless') setSnapshot(createInitialSnapshot(runForMap(mode, map, nextDifficulty)))
  }

  const updateLevelLoadout = (nextLoadout: Loadout) => {
    const normalized = normalizeLoadout(nextLoadout, availableTowers, availablePowers, loadoutLimits)
    const resolved = resolveRunLoadout(normalized, run.mode === 'challenge' ? run.modifiers : undefined)
    const allowedTools = new Set(getSetupBuildTools(resolved, startingWallAvailable))
    const nextPlacements = placements.filter((placement) => allowedTools.has(placement.kind))
    setLoadout(normalized)
    setPlacements(nextPlacements)
    storeDefenseLayout(layoutId, {
      placements: nextPlacements,
      variants: variantSelections,
      loadout: { towers: [...normalized.towers], powers: [...normalized.powers] },
    })
  }

  const selectMode = (nextMode: GameMode) => {
    if (nextMode === 'challenge') {
      const challenge = findChallenge(challengeId) ?? CHALLENGES[0]
      const challengeMap = findBuiltInMap(challenge.mapId) ?? DEFAULT_MAP
      setMode('challenge')
      selectMap(challengeMap, 'challenge', challenge.id)
      return
    }
    if (nextMode === 'sandbox') {
      setMode('sandbox')
      selectMap(map, 'sandbox')
      return
    }
    const mission = missionForMap(map.id)
    const nextMap = mission && isMissionUnlocked(save.completedMissionIds, mission.id) ? map : DEFAULT_MAP
    setMode(nextMode)
    selectMap(nextMap, nextMode)
  }

  const selectChallenge = (nextChallengeId: string) => {
    const challenge = findChallenge(nextChallengeId)
    if (!challenge) return
    const challengeMap = findBuiltInMap(challenge.mapId) ?? DEFAULT_MAP
    setChallengeId(challenge.id)
    setMode('challenge')
    selectMap(challengeMap, 'challenge', challenge.id)
  }

  const refreshMapLibrary = () => setAvailableMaps(loadAvailableMaps())

  const openMapEditor = (source: MapDefinition) => {
    const draft = findBuiltInMap(source.id)
      ? createCustomMap(source, `${source.name} Custom`, availableMaps)
      : source
    setEditorMap(draft)
    setEditorOpen(true)
  }

  const createMap = () => {
    setEditorMap(createCustomMap(DEFAULT_MAP, 'Untitled Front', availableMaps))
    setEditorOpen(true)
  }

  const duplicateMap = () => {
    const duplicate = createCustomMap(map, `${map.name} Copy`, availableMaps)
    storeMap(duplicate)
    setAvailableMaps(loadAvailableMaps())
    setMode('sandbox')
    selectMap(duplicate, 'sandbox')
  }

  const renameMap = (name: string) => {
    if (findBuiltInMap(map.id) || !name.trim()) return
    const renamed = { ...map, name: name.trim() }
    storeMap(renamed)
    setMap(renamed)
    refreshMapLibrary()
  }

  const removeMap = () => {
    if (findBuiltInMap(map.id)) return
    const fallback = deleteCustomMap(map.id)
    refreshMapLibrary()
    selectMap(fallback, 'sandbox')
  }

  const startBattle = useCallback(() => {
    if (!canStart) return
    const start = createBattleSessionStart(run, gameRules)
    playSound('start', settings)
    setSnapshot(start.snapshot)
    setRankedRun(setupIsRanked)
    setPaused(false)
    setWallCharges(start.wallCharges)
    setWallCooldown(start.wallCooldown)
    setSelectedPower(null)
    setPowerCommand(null)
    setStressCommand(null)
    setDevInvulnerable(false)
    setPowerCharges(start.powerCharges)
    setLastMedalsEarned(0)
    setLastDifficultyBonus(0)
    setLastBattleSurrendered(false)
    setPhase('battle')
  }, [canStart, gameRules, run, settings, setupIsRanked])

  const togglePause = useCallback(() => {
    if (phase === 'battle') {
      playSound('pause', settings)
      setPaused((value) => !value)
    }
  }, [phase, settings])

  const cancelSetupEdit = useCallback(() => {
    setPlacements((current) => cancelPlacementMove(current, movingPlacement))
    setMovingPlacement(null)
    setSelectedPlacementId(null)
    setSetupCancelRevision((revision) => revision + 1)
  }, [movingPlacement])

  const sellSelectedPlacement = useCallback(() => {
    if (!selectedPlacement) return
    setPlacements((current) => removeSetupPlacement(current, selectedPlacement.id))
    setSelectedPlacementId(null)
  }, [selectedPlacement])

  const moveSelectedPlacement = useCallback(() => {
    if (!selectedPlacement) return
    const move = beginPlacementMove(placements, selectedPlacement.id)
    if (!move) return
    const held = move.held.kind === 'wall' && move.held.rotation === undefined
      ? { ...move.held, rotation: deriveWallRotation(map, move.held) }
      : move.held
    setPlacements(move.placements)
    setMovingPlacement(held)
    setSelectedPlacementId(null)
  }, [map, placements, selectedPlacement])

  const rotateSetupWall = useCallback(() => {
    if (movingPlacement?.kind === 'wall') {
      setMovingPlacement((current) => current ? rotateWallPlacement(current) : current)
      return
    }
    if (!selectedPlacement || selectedPlacement.kind !== 'wall') return
    setPlacements((current) => current.map((placement) => placement.id === selectedPlacement.id ? rotateWallPlacement(placement) : placement))
  }, [movingPlacement, selectedPlacement])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = keyboardAction(event.key, event.code)
      if (!action || event.repeat) return
      if (helpOpen) {
        if (action.kind === 'cancel') setHelpOpen(false)
        return
      }
      if (action.kind === 'tuning') {
        setTuningOpen((value) => !value)
        if (phase === 'battle') setPaused(true)
        return
      }
      if (action.kind === 'cancel') {
        setSelectedPower(null)
        setBattleStatsOpen(false)
        if (settingsOpen) setSettingsOpen(false)
        else if (tuningOpen) setTuningOpen(false)
        else if (upgradeOpen) setUpgradeOpen(false)
        else if (phase === 'setup') cancelSetupEdit()
        return
      }
      if (tuningOpen || settingsOpen || upgradeOpen) return
      if (phase === 'setup' && action.kind === 'delete') {
        event.preventDefault()
        sellSelectedPlacement()
        return
      }
      if (phase === 'setup' && action.kind === 'rotate') {
        rotateSetupWall()
        return
      }
      if (action.kind === 'primary') {
        event.preventDefault()
        if (phase === 'setup') startBattle()
        if (phase === 'battle') togglePause()
      }
      if (phase !== 'battle') return
      if (action.kind === 'statistics') {
        event.preventDefault()
        setBattleStatsOpen((value) => !value)
      }
      if (action.kind === 'speed' && !(run.mode === 'challenge' && run.modifiers.forcedSpeed)) setSpeed(action.speed)
      if (action.kind === 'power') setSelectedPower(runLoadout.powers[action.index] ?? null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cancelSetupEdit, helpOpen, phase, rotateSetupWall, run, runLoadout.powers, sellSelectedPlacement, settingsOpen, startBattle, togglePause, tuningOpen, upgradeOpen])

  useEffect(() => {
    if (!settings.pauseOnBlur) return
    const pauseOnBlur = () => { if (phase === 'battle') setPaused(true) }
    window.addEventListener('blur', pauseOnBlur)
    return () => window.removeEventListener('blur', pauseOnBlur)
  }, [phase, settings.pauseOnBlur])

  useEffect(() => {
    setBattleMusic(phase === 'battle' && !paused, settings)
  }, [phase, paused, settings.masterVolume, settings.musicVolume])

  useEffect(() => () => setBattleMusic(false, settings), [])

  const updateSettings = (next: typeof settings) => {
    setSettings(next)
    storeSettings(next)
  }

  const updateSnapshot = useCallback((next: BattleSnapshot) => {
    setSnapshot((current) => {
      if (hasNewReadyCooldown(current.powerCooldowns, next.powerCooldowns)) playSound('ready', settings)
      return next
    })
  }, [settings])

  const issuePower = (power: ActivePowerKind, point: Point, lineEnd?: Point) => {
    if (phase !== 'battle' || paused || snapshot.powerCooldowns[power] > 0) return false
    if (!devUnlockAll && !activePowers.some((option) => option.kind === power)) return false
    if (!hasPowerCharge(powerCharges, power)) return false
    setPowerCommand({ id: Date.now(), kind: power, point, lineEnd })
    playSound('power', settings)
    setPowerCharges((current) => consumePowerCharge(current, power))
    return true
  }

  const place = (point: Point, lineEnd?: Point) => {
    if (phase === 'battle') {
      if (paused) return
      if (selectedPower === 'wall') {
        if (!wallPowerAvailable) return
        if (wallCharges <= 0 || wallCooldown > 0 || !isValidPlacement(point, 'wall', placements, map)) return
        setPlacements((current) => [...current, {
          ...point, id: Date.now() + current.length, kind: 'wall', temporary: true,
          rotation: deriveWallRotation(map, point),
        }])
        playSound('place', settings)
        setWallCharges((charges) => charges - 1)
        setWallCooldown(gameRules.wall.rechargeSeconds)
        setSelectedPower(null)
      }
      if (selectedPower && selectedPower !== 'wall' && snapshot.powerCooldowns[selectedPower] <= 0) {
        if (issuePower(selectedPower, point, lineEnd)) setSelectedPower(null)
      }
      return
    }
    if (phase !== 'setup') return
    if (movingPlacement) {
      if (!isValidPlacement(point, movingPlacement.kind, placements, map)) return
      const moved = movingPlacement.kind === 'wall' ? movingPlacement : {
        ...movingPlacement,
        rotation: lineEnd ? aimRotation(point, lineEnd, movingPlacement.rotation) : movingPlacement.rotation ?? defaultTowerRotation(map, point),
      }
      setPlacements((current) => placeMovedPlacement(current, moved, point))
      setSelectedPlacementId(movingPlacement.id)
      setMovingPlacement(null)
      playSound('place', settings)
      return
    }
    if (!isValidPlacement(point, selectedTool, placements, map)) return
    if (!setupBuildTools.includes(selectedTool)) return
    const cost = getBuildCost(selectedTool, effectiveTuning)
    if (cost > remaining) return
    setPlacements((current) => [...current, {
      ...point, id: Date.now() + current.length, kind: selectedTool,
      targetingRule: selectedTool === 'wall' ? undefined : 'closest',
      rotation: selectedTool === 'wall' ? deriveWallRotation(map, point) : lineEnd ? aimRotation(point, lineEnd) : defaultTowerRotation(map, point),
      variantId: isTowerKind(selectedTool) ? variantSelections[selectedTool] : undefined,
    }])
    playSound('place', settings)
  }

  const finishBattle = useCallback((won: boolean, finalSnapshot: BattleSnapshot, reason: BattleEndReason = 'resolved') => {
    setPlacements(keepPermanentPlacements)
    setSelectedPower(null)
    setSnapshot(finalSnapshot)
    setPhase(won ? 'victory' : 'defeat')
    setLastBattleSurrendered(reason === 'surrendered')
    playSound(won ? 'victory' : 'defeat', settings)
    setPaused(false)
    if (!rankedRun) {
      setLastMedalsEarned(0)
      setLastDifficultyBonus(0)
      return
    }
    const result = createRunResult(run, finalSnapshot, won, reason === 'surrendered')
    const reward = calculateRunReward(save, result)
    const next = recordRun(save, result)
    setLastMedalsEarned(next.medals - save.medals)
    setLastDifficultyBonus(reward.difficultyBonus)
    storeSave(next)
    setSave(next)
  }, [rankedRun, run, save, settings])

  const returnToSetup = () => {
    setPlacements(savedDeployment())
    setSnapshot(createInitialSnapshot(run, gameRules.setup.fortressShield))
    setPaused(false)
    setDevInvulnerable(false)
    setStressCommand(null)
    setPhase('setup')
  }

  const continueCampaign = () => {
    const nextId = nextMissionId(save.completedMissionIds)
    const nextMission = nextId ? findMission(nextId) : undefined
    const nextMap = nextMission ? findBuiltInMap(nextMission.mapId) : undefined
    if (nextMap) selectMap(nextMap, 'campaign')
    setPhase('briefing')
  }

  if (editorOpen) {
    return (
      <MapEditor
        initialMap={editorMap}
        onCancel={() => setEditorOpen(false)}
        onSave={(nextMap) => {
          storeMap(nextMap)
          setMap(nextMap)
          refreshMapLibrary()
          setPlacements([])
          setMode('sandbox')
          setSnapshot(createInitialSnapshot(runForMap('sandbox', nextMap)))
          setPhase('setup')
          setEditorOpen(false)
        }}
      />
    )
  }

  return (
    <main
      className={`game-shell ${settings.reducedFlashes ? 'reduced-flashes' : ''}`}
      style={{ '--ui-scale': settings.uiScale } as CSSProperties}
      onContextMenu={(event) => {
        event.preventDefault()
        setSelectedPower(null)
        if (phase === 'setup') cancelSetupEdit()
      }}
    >
      <section className="game-stage" aria-label="Battlefield">
        <GameScene
          key={phase === 'battle' ? `battle-${save.totalRuns}` : 'planning'}
          placements={placements}
          selectedPlacementId={selectedPlacementId}
          movingPlacement={movingPlacement}
          map={map}
          run={run}
          rules={gameRules}
          reducedFlashes={settings.reducedFlashes}
          screenShake={settings.screenShake}
          settings={settings}
          phase={phase === 'briefing' ? 'setup' : phase}
          selectedTool={selectedTool}
          setupCancelRevision={setupCancelRevision}
          selectedVariantId={isTowerKind(selectedTool) ? variantSelections[selectedTool] : undefined}
          selectedPower={selectedPower}
          powerCommand={powerCommand}
          stressCommand={stressCommand}
          invulnerable={devInvulnerable}
          paused={paused}
          speed={activeSpeed}
          surrenderRevision={surrenderRevision}
          onPlace={place}
          onSelectPlacement={(id) => {
            if (phase !== 'setup' || movingPlacement) return
            setPlacements((current) => current.map((placement) => placement.id === id && placement.kind === 'wall' && placement.rotation === undefined
              ? { ...placement, rotation: deriveWallRotation(map, placement) }
              : placement))
            setSelectedPlacementId(id)
          }}
          onCancelSetupEdit={cancelSetupEdit}
          onCancelPowerTarget={() => setSelectedPower(null)}
          onSnapshot={updateSnapshot}
          onBattleEnd={finishBattle}
          onWallRemoved={(id) => setPlacements((items) => items.filter((item) => item.id !== id))}
        />

        <header className="topbar">
          <div className="brand-mark"><span>ORCFALL</span><strong>COMMAND</strong></div>
          <div className="status-strip">
            <Status label="Fortress" value={`${snapshot.baseHealth}%`} danger={snapshot.baseHealth <= 30} />
            {(phase === 'battle' || phase === 'victory' || phase === 'defeat' ? snapshot.fortressShield : gameRules.setup.fortressShield) > 0 && (
              <Status label="Shield" value={String(phase === 'battle' || phase === 'victory' || phase === 'defeat' ? snapshot.fortressShield : gameRules.setup.fortressShield)} />
            )}
            <Status label="Wave" value={`${snapshot.wave}/${snapshot.totalWaves ?? '∞'}${snapshot.bossWave ? ' · BOSS' : ''}`} />
            {snapshot.waveRewardMultiplier !== 1 && <Status label="Wave Reward" value={`${snapshot.waveRewardMultiplier.toFixed(2)}×`} />}
            <Status label="Horde" value={`${snapshot.enemiesAlive} active`} />
            {snapshot.secondaryObjectiveHealth !== null && <Status label="Supply Cache" value={`${snapshot.secondaryObjectiveHealth}/${snapshot.secondaryObjectiveMaxHealth}`} danger={snapshot.secondaryObjectiveHealth <= 0} />}
            <Status label="Medals" value={String(save.medals)} />
          </div>
          {phase === 'setup' && <button className="icon-button forge-button" onClick={() => openMapEditor(map)}>MAP FORGE</button>}
          {phase === 'setup' && <button className="icon-button" onClick={() => setPhase('briefing')}>CHANGE MAP</button>}
          {phase === 'setup' && <button className="icon-button armory-button" onClick={() => setUpgradeOpen(true)}>ARMORY</button>}
          {(phase === 'setup' || phase === 'battle') && <button className="icon-button tune-button" onClick={() => { setTuningOpen(true); if (phase === 'battle') setPaused(true) }}>TUNE</button>}
          {phase !== 'briefing' && phase !== 'victory' && phase !== 'defeat' && <button className="icon-button" onClick={() => { setSettingsOpen(true); if (phase === 'battle') setPaused(true) }}>SETTINGS</button>}
          <button className="icon-button" onClick={() => { setHelpOpen(true); if (phase === 'battle') setPaused(true) }}>HELP</button>
          <button className="icon-button" onClick={() => setPaused((value) => !value)} disabled={phase !== 'battle' || tuningOpen || settingsOpen || helpOpen}>
            {paused ? 'RESUME' : 'PAUSE'}
          </button>
        </header>

        {phase === 'briefing' && <BriefingPanel
          mode={mode}
          difficulty={difficulty}
          challengeId={challengeId}
          map={map}
          availableMaps={availableMaps}
          completedMissionIds={save.completedMissionIds}
          completedChallengeIds={save.completedChallengeIds}
          fixedArsenal={fixedArsenal}
          powersDisabled={powersDisabled}
          emptyDeploymentAllowed={run.mode === 'challenge' && Boolean(run.modifiers.allowEmptyDeployment)}
          selectedLoadout={normalizedLoadout}
          resolvedLoadout={runLoadout}
          towerOptions={briefingTowers}
          powerOptions={briefingPowers}
          towerSlotLimit={towerSlotLimit}
          powerSlotLimit={powerSlotLimit}
          variantSelections={variantSelections}
          upgradeRanks={variantRanks}
          onSelectMode={selectMode}
          onSelectDifficulty={selectDifficulty}
          onSelectChallenge={selectChallenge}
          onSelectMap={(choice) => selectMap(choice, mode)}
          onToggleTower={(tower) => updateLevelLoadout(toggleLoadoutTower(loadout, tower, availableTowers, availablePowers, loadoutLimits))}
          onTogglePower={(power) => updateLevelLoadout(toggleLoadoutPower(loadout, power, availableTowers, availablePowers, loadoutLimits))}
          onSelectTowerVariant={(tower: TowerKind, variantId: TowerVariantId | undefined) => {
            const nextVariants = selectTowerVariant(variantSelections, tower, variantId, variantRanks)
            const nextPlacements = placements.map((placement) => placement.kind === tower
              ? { ...placement, variantId: nextVariants[tower] }
              : placement)
            setVariantSelections(nextVariants)
            setPlacements(nextPlacements)
            storeDefenseLayout(layoutId, {
              placements: nextPlacements,
              variants: nextVariants,
              loadout: { towers: [...normalizedLoadout.towers], powers: [...normalizedLoadout.powers] },
            })
          }}
          onSelectDoctrine={(doctrine) => {
            const nextDoctrine = doctrine && isCommanderDoctrineUnlocked(variantRanks, doctrine) ? doctrine : null
            setLoadout((current) => ({ ...current, doctrine: nextDoctrine }))
            const persistedDoctrine = nextDoctrine && isCommanderDoctrineUnlocked(save.upgrades, nextDoctrine) ? nextDoctrine : null
            const nextSave = { ...save, selectedDoctrine: persistedDoctrine }
            storeSave(nextSave)
            setSave(nextSave)
          }}
          onNewMap={createMap}
          onDuplicateMap={duplicateMap}
          onRenameMap={renameMap}
          onDeleteMap={removeMap}
          onEditMap={() => openMapEditor(map)}
          onOpenMap={() => setPhase('setup')}
          onOpenArmory={() => setUpgradeOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
        />}

        {phase === 'setup' && <DeploymentPanel
          remaining={remaining}
          tuning={effectiveTuning}
          tools={setupBuildTools}
          selectedTool={selectedTool}
          placementCount={placements.length}
          selectedPlacement={selectedPlacement}
          movingPlacement={movingPlacement}
          canStart={canStart}
          ranked={setupIsRanked}
          onSelectTool={(tool) => { cancelSetupEdit(); setSelectedTool(tool) }}
          onSellSelected={sellSelectedPlacement}
          onMoveSelected={moveSelectedPlacement}
          onTargetingRule={(rule: TargetingRule) => {
            if (!selectedPlacement) return
            setPlacements((current) => setPlacementTargeting(current, selectedPlacement.id, rule))
          }}
          onUndo={() => {
            if (movingPlacement) cancelSetupEdit()
            else setPlacements((items) => items.slice(0, -1))
            setSelectedPlacementId(null)
          }}
          onClear={() => { setPlacements([]); setMovingPlacement(null); setSelectedPlacementId(null) }}
          onStart={startBattle}
        />}

        {phase === 'battle' && <BattleControls
          speed={activeSpeed}
          speedLocked={run.mode === 'challenge' && Boolean(run.modifiers.forcedSpeed)}
          snapshot={snapshot}
          powers={activePowers}
          selectedPower={selectedPower}
          powerCharges={powerCharges}
          wallAvailable={wallPowerAvailable}
          wallCharges={wallCharges}
          wallCooldown={wallCooldown}
          paused={paused}
          pauseDisabled={tuningOpen}
          onSpeed={setSpeed}
          onPower={(power) => {
            if (power === 'repair') {
              const fortress = map.paths[0].at(-1) ?? { x: 0, z: 0 }
              issuePower('repair', fortress)
              return
            }
            setSelectedPower((value) => value === power ? null : power)
          }}
          onWall={() => setSelectedPower((value) => value === 'wall' ? null : 'wall')}
          onPause={togglePause}
          onSurrender={() => setSurrenderRevision((revision) => revision + 1)}
        />}
        {phase === 'battle' && battleStatsOpen && <BattleStatsPanel snapshot={snapshot} onClose={() => setBattleStatsOpen(false)} />}

        {(phase === 'victory' || phase === 'defeat') && <ResultsReport
          phase={phase}
          ranked={rankedRun}
          run={run}
          snapshot={snapshot}
          save={save}
          medalsEarned={lastMedalsEarned}
          difficultyBonus={lastDifficultyBonus}
          newlyAffordableResearch={rankedRun ? getNewlyAffordableUpgradeNames(save.upgrades, Math.max(0, save.medals - lastMedalsEarned), save.medals) : []}
          surrendered={lastBattleSurrendered}
          primaryLabel={run.mode === 'campaign' && phase === 'victory' ? 'CONTINUE CAMPAIGN' : run.mode === 'challenge' ? 'RETURN TO CHALLENGES' : 'RETURN TO DEPLOYMENT'}
          onPrimary={run.mode === 'campaign' && phase === 'victory' ? continueCampaign : run.mode === 'challenge' ? () => {
            setPlacements(savedDeployment())
            setPhase('briefing')
          } : returnToSetup}
          onArmory={() => setUpgradeOpen(true)}
          onSettings={() => setSettingsOpen(true)}
        />}
        {tuningOpen && (
          <TuningPanel
            tuning={tuning}
            devUnlockAll={devUnlockAll}
            stressAvailable={phase === 'battle'}
            invulnerable={devInvulnerable}
            onSpawnStress={(count, streamed = false) => {
              if (phase !== 'battle') return
              setRankedRun(false)
              setStressCommand((current) => ({
                id: (current?.id ?? 0) + 1,
                count,
                streamRate: streamed ? 900 : undefined,
                liveCap: streamed ? 5000 : undefined,
              }))
              setTuningOpen(false)
              setPaused(false)
            }}
            onSpawnEnemy={(kind) => {
              if (phase !== 'battle') return
              setRankedRun(false)
              setStressCommand((current) => ({ id: (current?.id ?? 0) + 1, count: 1, kind }))
              setTuningOpen(false)
              setPaused(false)
            }}
            onToggleInvulnerable={() => {
              if (phase !== 'battle') return
              setRankedRun(false)
              setDevInvulnerable((current) => !current)
            }}
            onResetRuntimeCheats={() => {
              setDevInvulnerable(false)
              setStressCommand((current) => ({ id: (current?.id ?? 0) + 1, count: 0 }))
            }}
            onToggleDevUnlockAll={() => {
              setDevUnlockAll((current) => {
                if (!current && phase === 'battle') setRankedRun(false)
                if (!current) {
                  setLoadout((current) => ({ ...current, towers: TOWER_KINDS.slice(0, towerSlotLimit), powers: ACTIVE_POWER_OPTIONS.slice(0, powerSlotLimit).map((power) => power.kind) }))
                }
                if (current) {
                  setSelectedTool('gunner')
                  setSelectedPower(null)
                  setPlacements((items) => items.filter((item) => isBuildToolUnlocked(save.upgrades, item.kind)))
                }
                return !current
              })
            }}
            onChange={setTuning}
            onClose={() => setTuningOpen(false)}
            onQuickRestart={() => {
              setPlacements(savedDeployment())
              setSnapshot(createInitialSnapshot(run))
              setPaused(false)
              setSelectedPower(null)
              setDevInvulnerable(false)
              setStressCommand(null)
              setPhase('setup')
              setTuningOpen(false)
            }}
          />
        )}
        {upgradeOpen && (
          <UpgradePanel
            save={save}
            tuning={tuning}
            onSave={updateSave}
            onClose={() => setUpgradeOpen(false)}
          />
        )}
        {settingsOpen && <SettingsPanel settings={settings} onChange={updateSettings} onClose={() => setSettingsOpen(false)} />}
        {helpOpen && <HelpPanel phase={phase} loadout={runLoadout} onClose={() => setHelpOpen(false)} />}
      </section>
    </main>
  )
}
