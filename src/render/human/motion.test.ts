import { describe, expect, it } from 'vitest'
import { addGuard, bareWorld } from '../../game/hazards/testWorld'
import { actionIndex } from '../../game/toolDefs'
import { captiveNeck, draggedCollar } from './acts'
import { guardMotion, playerMotion } from './motion'
import { createWorld } from '../../game/world'

const FLOOR = 22
const feetOf = (body: { x: number; y: number; w: number; h: number }) => ({ x: body.x + body.w / 2, y: body.y + body.h })

function world() {
  const made = bareWorld()
  Object.assign(made.player, { x: 10, y: FLOOR - 1.7, onGround: true, facing: 1 })
  return made
}

describe('playerMotion', () => {
  it('hangs the player on the grapple line, reaching toward the corner it bends round', () => {
    const w = world()
    Object.assign(w.grapple, { phase: 'attached', hanging: true, hook: { x: 14, y: 10 }, bend: { x: 12, y: 15 }, reeling: 1 })
    const { motion } = playerMotion(w, { x: 20, y: 18 })
    expect(motion.act).toEqual({ kind: 'hang', line: { x: 12, y: 15 }, reel: 1 })
    expect(motion.onGround).toBe(false)
  })

  it('shows a punch or kick for the moment after it is thrown, then lets go of it', () => {
    const w = world()
    w.clock = 5
    w.melee.strike = { kind: 'kick', at: 4.9 }
    expect(playerMotion(w, { x: 20, y: 18 }).motion.act).toEqual({ kind: 'kick', t: expect.closeTo(0.1, 5) })
    w.melee.strike = { kind: 'punch', at: 4 }
    expect(playerMotion(w, { x: 20, y: 18 }).motion.act).toBeUndefined()
  })

  it('wraps the off arm round the neck of the guard held as a shield, and poses him as the captive', () => {
    const w = world()
    const guard = addGuard(w, 10.9, FLOOR, 1)
    w.melee.shield = guard
    expect(playerMotion(w, { x: 20, y: 18 }).motion.act).toEqual({ kind: 'hostage', neck: captiveNeck(feetOf(guard), 1) })
    expect(guardMotion(w, guard, 'pistol').motion.act).toEqual({ kind: 'captive' })
  })

  it('follows a thrown frag through with the arm, and holds the frag model, not a flashbang', () => {
    const w = world()
    w.player.tool = actionIndex('frag')
    w.player.cooldown = 0.5
    const posed = playerMotion(w, { x: 20, y: 18 })
    expect(posed.held).toBe('frag')
    expect(posed.motion.act?.kind).toBe('throw')
  })
})

describe('guardMotion', () => {
  it('drops the weapon and raises the hands when he surrenders; a tied man kneels whatever else is going on', () => {
    const w = world()
    const guard = addGuard(w, 14, FLOOR, -1)
    Object.assign(guard, { mode: 'surrendered', droppedWeapon: { x: 13, y: FLOOR } })
    expect(guardMotion(w, guard, 'rifle')).toMatchObject({ held: null, motion: { act: { kind: 'surrender' } } })
    Object.assign(guard, { restrained: true, blindSeconds: 3, blindReaction: 'wild' })
    expect(guardMotion(w, guard, 'rifle').motion.act).toEqual({ kind: 'restrained' })
  })

  it('pairs the man dragging a casualty with the casualty, hands on his collar', () => {
    const w = world()
    const rescuer = addGuard(w, 14, FLOOR, -1)
    const casualty = addGuard(w, 15, FLOOR, -1)
    casualty.draggedBy = 0
    expect(guardMotion(w, casualty, 'pistol').motion.act).toEqual({ kind: 'dragged', byX: feetOf(rescuer).x })
    expect(guardMotion(w, rescuer, 'pistol').motion.act).toEqual({ kind: 'dragging', at: draggedCollar(feetOf(casualty), feetOf(rescuer).x) })
  })

  it('crouches a shield column: the shield man carries it, the next puts a hand on him', () => {
    const w = world()
    const lead = addGuard(w, 14, FLOOR, 1)
    const next = addGuard(w, 13.1, FLOOR, 1)
    Object.assign(lead, { shield: true, stackLeader: 0, stackSlot: 0 })
    Object.assign(next, { stackLeader: 0, stackSlot: 1 })
    expect(guardMotion(w, lead, 'pistol').motion).toMatchObject({ mode: 'crouch', act: { kind: 'shield' } })
    expect(guardMotion(w, next, 'rifle').motion.act?.kind).toBe('stack')
  })

  it('aims along the direction the game gives, straight down a hole included', () => {
    const w = world()
    const guard = addGuard(w, 14, FLOOR, 1)
    Object.assign(guard, { state: 'alert', aim: { x: 0, y: 1 } })
    expect(guardMotion(w, guard, 'rifle').motion.aim).toBeCloseTo(Math.PI / 2)
  })

  it('runs a reload and a dive from start to finish', () => {
    const w = world()
    const guard = addGuard(w, 14, FLOOR, 1)
    guard.reloadSeconds = 2.2
    expect(guardMotion(w, guard, 'rifle').motion.act).toEqual({ kind: 'reload', t: expect.closeTo(0, 3) })
    guard.diveSeconds = 0.01
    expect(guardMotion(w, guard, 'rifle').motion.act).toEqual({ kind: 'dive', t: expect.closeTo(0.98, 1) })
  })
})

describe('guards at ease', () => {
  it('a calm guard on the phone holds a hand to his face; once the moment is over he just stands', () => {
    const w = createWorld(1)
    const guard = w.guards[0]
    const person = w.people!.byGuard.get(guard)!
    person.act = { name: 'phone', until: w.clock + 5, with: null }
    expect(guardMotion(w, guard, 'pistol').motion.act).toEqual({ kind: 'radio' })
    w.clock += 6
    expect(guardMotion(w, guard, 'pistol').motion.act).toBeUndefined()
  })
})
