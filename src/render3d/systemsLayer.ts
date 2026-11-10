import { AdditiveBlending, Group, NormalBlending, ShaderMaterial } from 'three'
import { eachLiveTile, eachPuddle, eachStream, fallingFittings, wireViews } from '../game/systems/views'
import { cellSeed, createQuadPool, put4, type QuadPool } from './hazardfx/quads'
import { DRAW_DISTANCE, type Frame, type LayerFactory } from './layer'

/**
 * The couplings made visible: standing water and fuel as sheets across the front of the room (rising up people's legs
 * as it deepens), streams pouring from burst pipes and off floor edges, live cables, crackling arcs over electrified
 * water, and fittings on their way down. Two instanced pools, one draw each; nothing is created per frame and no
 * lights are added.
 */
const MAX_PANELS = 1400
const MAX_ARCS = 160
const REACH_X = DRAW_DISTANCE * 0.8
const REACH_Y = DRAW_DISTANCE * 0.55
/** In front of the people, so wading water covers their legs. */
const SHEET_Z = 0.42
const STREAM_Z = 0.1
const MIN_SHEET = 0.07

/** The scene is lit in high range and exposed down afterwards: plain unlit colours need lifting to read as bright. */
const LIQUID_GAIN = 2.4

const KIND = { water: 0, fuel: 1, waterStream: 2, fuelStream: 3, cable: 4, fitting: 5 } as const

const panelMaterial = () => new ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uGain: { value: LIQUID_GAIN } },
  vertexShader: /* glsl */ `
    attribute vec4 aRect;
    attribute vec4 aLook;
    varying vec2 vUv;
    varying vec4 vLook;
    varying vec2 vSize;
    void main() {
      vec3 p = vec3(aRect.xy + position.xy * aRect.zw, aLook.w);
      vUv = uv;
      vLook = aLook;
      vSize = aRect.zw;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uGain;
    varying vec2 vUv;
    varying vec4 vLook;
    varying vec2 vSize;
    void main() {
      float kind = vLook.x;
      float seed = vLook.y;
      vec4 colour;
      if (kind < 1.5) {
        // A sheet of water or fuel: a bright moving rim on top, clearer below, and a slow shimmer.
        float fromTop = (1.0 - vUv.y) * vSize.y;
        float rim = 1.0 - smoothstep(0.0, 0.05, fromTop);
        float ripple = 0.5 + 0.5 * sin(vUv.x * 9.0 + uTime * 2.3 + seed * 20.0);
        vec3 body = kind < 0.5 ? vec3(0.22, 0.42, 0.55) : vec3(0.16, 0.12, 0.09);
        vec3 sheen = kind < 0.5 ? vec3(0.75, 0.9, 1.0) : vec3(0.7 + 0.3 * sin(vUv.x * 7.0 + uTime), 0.5, 0.8);
        colour = vec4(mix(body, sheen, rim * (0.6 + 0.4 * ripple)) * uGain, mix(0.45, 0.85, rim) * vLook.z);
      } else if (kind < 3.5) {
        // A pouring stream: streaks running down.
        float streak = fract(vUv.y * 5.0 + uTime * 3.5 + seed * 7.0);
        float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
        vec3 tint = kind < 2.5 ? vec3(0.7, 0.85, 1.0) : vec3(0.35, 0.28, 0.2);
        colour = vec4(tint * uGain * (0.8 + 0.6 * streak), (0.3 + 0.45 * smoothstep(0.3, 1.0, streak)) * edge * vLook.z);
      } else if (kind < 4.5) {
        colour = vec4(0.08, 0.08, 0.09, vLook.z);
      } else {
        float border = step(0.08, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
        vec3 tint = seed > 0.5 ? vec3(0.85, 0.7, 0.35) : vec3(0.32, 0.33, 0.35);
        colour = vec4(tint * (0.6 + 0.4 * border), vLook.z);
      }
      gl_FragColor = colour;
    }`,
  blending: NormalBlending,
  transparent: true,
  depthWrite: false,
})

const arcMaterial = () => new ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    attribute vec4 aPos;
    attribute vec2 aSize;
    varying vec2 vUv;
    varying float vSeed;
    void main() {
      vec3 p = aPos.xyz;
      p.xy += position.xy * aSize;
      vUv = uv;
      vSeed = aPos.w;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    varying float vSeed;
    float hash(float n) { return fract(sin(n) * 43758.5453); }
    void main() {
      // A jagged bolt that jumps to a new shape many times a second, and blinks out now and then.
      float frame = floor(uTime * 18.0 + vSeed * 50.0);
      float on = step(0.35, hash(frame + vSeed * 13.0));
      float bend = (hash(frame + floor(vUv.x * 6.0)) - 0.5) * 0.5;
      float line = 1.0 - smoothstep(0.04, 0.16, abs(vUv.y - 0.5 - bend * sin(vUv.x * 3.14159)));
      float glow = (1.0 - smoothstep(0.0, 0.5, abs(vUv.y - 0.5))) * 0.45;
      gl_FragColor = vec4(vec3(2.2, 2.8, 3.6) * (line + glow) * on, 1.0);
    }`,
  blending: AdditiveBlending,
  transparent: true,
  depthWrite: false,
})

function near(frame: Frame, x: number, y: number): boolean {
  return Math.abs(x - frame.view.x) < REACH_X && Math.abs(y - frame.view.y) < REACH_Y
}

/** Fills the panel pool: one rectangle per call, given in game tiles (y down) and turned into 3D (y up) here. */
function panelWriter(pool: QuadPool): { count: number; add(x: number, top: number, w: number, h: number, kind: number, seed: number, alpha: number, z: number): void } {
  const writer = {
    count: 0,
    add(x: number, top: number, w: number, h: number, kind: number, seed: number, alpha: number, z: number) {
      if (writer.count >= pool.cap) return
      put4(pool.data.aRect, writer.count, x + w / 2, -(top + h / 2), w, h)
      put4(pool.data.aLook, writer.count, kind, seed, alpha, z)
      writer.count += 1
    },
  }
  return writer
}

export const createSystemsLayer: LayerFactory = () => {
  const group = new Group()
  const panels = createQuadPool(MAX_PANELS, { aRect: 4, aLook: 4 }, panelMaterial())
  const arcs = createQuadPool(MAX_ARCS, { aPos: 4, aSize: 2 }, arcMaterial())
  panels.mesh.renderOrder = 2
  arcs.mesh.renderOrder = 4
  group.add(panels.mesh, arcs.mesh)
  const writer = panelWriter(panels)

  return {
    group,
    update(world, frame) {
      const time = world.clock
      writer.count = 0
      eachPuddle(world, (x, y, depth, kind) => {
        if (!near(frame, x, y)) return
        const h = Math.max(MIN_SHEET, Math.min(5, depth))
        writer.add(x, y + 1 - h, 1, h, kind === 'water' ? KIND.water : KIND.fuel, cellSeed(x, y), Math.min(1, 0.5 + depth * 2), SHEET_Z)
      })
      eachStream(world, (fall) => {
        if (!near(frame, fall.x, fall.top)) return
        const w = Math.min(0.9, 0.2 + fall.amount * 1.5)
        writer.add(fall.x + 0.5 - w / 2, fall.top + 0.5, w, Math.max(0.5, fall.bottom - fall.top + 0.5), fall.kind === 'water' ? KIND.waterStream : KIND.fuelStream, cellSeed(fall.x, fall.top), 1, STREAM_Z)
      })
      const wires = wireViews(world)
      for (const wire of wires) {
        if (near(frame, wire.x, wire.top)) writer.add(wire.x - 0.03, wire.top, 0.06, wire.bottom - wire.top - 0.1, KIND.cable, 0, 1, STREAM_Z)
      }
      for (const item of fallingFittings(world)) {
        if (near(frame, item.x, item.y)) writer.add(item.x, item.y, item.w, item.h, KIND.fitting, item.lamp ? 1 : 0, 1, -0.6)
      }
      panels.commit(writer.count)

      let arcCount = 0
      const addArc = (x: number, y: number, w: number, h: number, seed: number) => {
        if (arcCount >= arcs.cap) return
        put4(arcs.data.aPos, arcCount, x, -y, SHEET_Z + 0.02, seed)
        arcs.data.aSize[arcCount * 2] = w
        arcs.data.aSize[arcCount * 2 + 1] = h
        arcCount += 1
      }
      eachLiveTile(world, (x, y) => {
        if (near(frame, x, y)) addArc(x + 0.5, y + 0.8, 1.4, 0.7, cellSeed(x, y))
      })
      for (const wire of wires) {
        if (wire.live && near(frame, wire.x, wire.bottom)) addArc(wire.x, wire.bottom - 0.15, 0.6, 0.5, cellSeed(wire.x * 3, wire.top))
      }
      arcs.commit(arcCount)
      ;(panels.mesh.material as ShaderMaterial).uniforms.uTime.value = time
      ;(arcs.mesh.material as ShaderMaterial).uniforms.uTime.value = time
    },
  }
}
