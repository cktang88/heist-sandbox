#!/usr/bin/env node
/**
 * Writes light copies of the library models the props use, for a side view where a prop is 10 to 80 pixels tall:
 * - triangles cut to a budget that follows the model's size (meshoptimizer's simplifier, which keeps UV seams closed),
 * - colour textures kept (256 px for small models, 512 px otherwise); normal maps dropped (a prop's surface detail is
 *   finer than a pixel here) and roughness/metalness/occlusion maps replaced by their average value,
 * - surfaces drawn one-sided unless they are cut-outs (leaves, grilles): the camera only ever sees a prop's outside,
 *   and one-sided, map-only materials share a handful of shader programs instead of one per combination,
 * - glass, clear coat and specular extensions replaced by plain see-through or plain surfaces, so every prop is an
 *   ordinary standard material (no extra transmission pass, far fewer shader variants).
 * Output: one self-contained .glb per model in public/models/lite/ or public/models2/lite/, and
 * src/render3d/liteModels.ts listing which models have a light copy.
 *
 * Usage: node scripts/liteModels.mjs   (needs ImageMagick's `convert`; meshoptimizer comes with three's types)
 * The models used are found by reading the prop sources for `scanned(…, 'id'` and `library(…, 'id'` calls and the
 * library choices in props/library.ts.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MeshoptSimplifier } from 'meshoptimizer'
import { MODELS } from '../src/render3d/assetManifest.ts'
import { EXTRA_MODELS } from '../src/render3d/assetManifestExtra.ts'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const PUBLIC = path.join(ROOT, 'public')
/** Triangles per metre of the model's largest side, and the floor and ceiling of the budget. */
const TRIANGLES_PER_METRE = 400
const MIN_TRIANGLES = 120
const MAX_TRIANGLES = 1500
/** Largest shape error allowed, in metres: under a pixel at the default zoom (a metre is about 35 pixels). */
const MAX_ERROR = 0.02
/** Pieces this small (a slat, a knob) are left alone: cutting them further would break them, not save anything. */
const KEEP_BELOW = 100
/** Models smaller than this (largest side, metres) get small colour maps. */
const SMALL = 0.9

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }
const ARRAYS = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }

function usedIds() {
  const dir = path.join(ROOT, 'src/render3d')
  const ids = new Set()
  for (const file of fs.readdirSync(dir, { recursive: true })) {
    if (!String(file).endsWith('.ts')) continue
    const text = fs.readFileSync(path.join(dir, String(file)), 'utf8')
    for (const match of text.matchAll(/(?:scan|scanned|library)\(\w+, '([^']+)'/g)) ids.add(match[1])
    if (String(file).endsWith('library.ts')) for (const list of text.matchAll(/models: \[([^\]]*)\]/g)) for (const id of list[1].matchAll(/'([^']+)'/g)) ids.add(id[1])
  }
  ids.delete('built')
  return ids
}

function readModel(file) {
  const data = fs.readFileSync(file)
  if (data.readUInt32LE(0) === 0x46546c67) {
    const jsonLength = data.readUInt32LE(12)
    return { json: JSON.parse(data.subarray(20, 20 + jsonLength).toString()), buffers: [data.subarray(28 + jsonLength)], dir: path.dirname(file) }
  }
  const json = JSON.parse(data.toString())
  return { json, buffers: (json.buffers ?? []).map((buffer) => fs.readFileSync(path.join(path.dirname(file), decodeURIComponent(buffer.uri)))), dir: path.dirname(file) }
}

function readAccessor(model, index) {
  const accessor = model.json.accessors[index]
  const view = model.json.bufferViews[accessor.bufferView]
  const Type = ARRAYS[accessor.componentType]
  const size = COMPONENTS[accessor.type]
  const buffer = model.buffers[view.buffer ?? 0]
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  const stride = view.byteStride ?? size * Type.BYTES_PER_ELEMENT
  const out = new Type(accessor.count * size)
  const bytes = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const read = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[accessor.componentType]
  for (let i = 0; i < accessor.count; i += 1) for (let c = 0; c < size; c += 1) out[i * size + c] = bytes[read](offset + i * stride + c * Type.BYTES_PER_ELEMENT, true)
  return { accessor, data: out, size }
}

function imageBytes(model, image) {
  if (image.uri) return fs.readFileSync(path.join(model.dir, decodeURIComponent(image.uri)))
  const view = model.json.bufferViews[image.bufferView]
  const buffer = model.buffers[view.buffer ?? 0]
  return buffer.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
}

function mimeOf(image, bytes) {
  if (image.mimeType) return image.mimeType
  if (bytes[0] === 0x89) return 'image/png'
  if (bytes[0] === 0xff) return 'image/jpeg'
  return 'image/webp'
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lite-'))
function convert(bytes, mime, args) {
  const ext = mime.split('/')[1]
  const from = path.join(scratch, `in.${ext}`)
  fs.writeFileSync(from, bytes)
  return execFileSync('convert', [from, ...args, `${ext}:-`], { maxBuffer: 1 << 28 })
}
function resized(bytes, mime, size) {
  return convert(bytes, mime, ['-resize', `${size}x${size}>`, '-quality', '85'])
}
function average(bytes, mime) {
  const text = execFileSync('convert', [writeTemp(bytes, mime), '-resize', '1x1!', '-format', '%[fx:r] %[fx:g] %[fx:b]', 'info:']).toString()
  return text.split(' ').map(Number)
}
function writeTemp(bytes, mime) {
  const file = path.join(scratch, `avg.${mime.split('/')[1]}`)
  fs.writeFileSync(file, bytes)
  return file
}

function sourceOf(model, textureIndex) {
  const texture = model.json.textures[textureIndex]
  return texture.extensions?.EXT_texture_webp?.source ?? texture.source
}

function extentOf(positions) {
  let extent = 0
  for (let c = 0; c < 3; c += 1) {
    let low = Infinity
    let high = -Infinity
    for (let i = c; i < positions.length; i += 3) {
      low = Math.min(low, positions[i])
      high = Math.max(high, positions[i])
    }
    extent = Math.max(extent, high - low)
  }
  return Math.max(extent, 1e-6)
}

/** Simplifies one primitive; returns its attributes compacted to the vertices still used, and the new indices. */
function simplifyPrimitive(model, primitive, target) {
  const position = readAccessor(model, primitive.attributes.POSITION)
  const count = position.accessor.count
  let indices = primitive.indices !== undefined ? Uint32Array.from(readAccessor(model, primitive.indices).data) : Uint32Array.from({ length: count }, (_, i) => i)
  const positions = position.data instanceof Float32Array ? position.data : Float32Array.from(position.data)
  const wanted = Math.max(3, Math.floor(target) * 3)
  if (indices.length / 3 > Math.max(target, KEEP_BELOW)) {
    // Each pass is coarser than the last and runs only while the result is still well over budget: first an ordinary
    // pass, then one allowed to cross UV seams, then a sloppy one for triangle soups that have no shared edges at all.
    const passes = [
      () => MeshoptSimplifier.simplify(indices, positions, 3, wanted, MAX_ERROR, ['ErrorAbsolute', 'Prune']),
      () => MeshoptSimplifier.simplify(indices, positions, 3, wanted, MAX_ERROR * 2, ['ErrorAbsolute', 'Prune', 'Permissive']),
      () => MeshoptSimplifier.simplifySloppy(indices, positions, 3, null, wanted, (MAX_ERROR * 2) / extentOf(positions)),
    ]
    for (const pass of passes) {
      const [simplified] = pass()
      // A pass that overshoots far below the budget has thrown away whole parts: keep the previous result.
      if (simplified.length / 3 >= target * 0.5 && simplified.length < indices.length) indices = simplified
      if (indices.length / 3 <= target * 1.5) break
    }
  }
  const remap = new Int32Array(count).fill(-1)
  let used = 0
  for (const index of indices) if (remap[index] < 0) remap[index] = used++
  const attributes = {}
  for (const [name, accessorIndex] of Object.entries(primitive.attributes)) {
    const { accessor, data, size } = readAccessor(model, accessorIndex)
    const out = new data.constructor(used * size)
    for (let i = 0; i < count; i += 1) if (remap[i] >= 0) for (let c = 0; c < size; c += 1) out[remap[i] * size + c] = data[i * size + c]
    attributes[name] = { accessor, data: out }
  }
  return { attributes, indices: indices.map((index) => remap[index]), vertices: used }
}

class GlbWriter {
  chunks = []
  length = 0
  json
  constructor(json) {
    this.json = json
    json.bufferViews = []
    json.accessors = []
    json.buffers = [{ byteLength: 0 }]
  }
  view(bytes, target) {
    const pad = (4 - (this.length % 4)) % 4
    if (pad) this.push(new Uint8Array(pad))
    const view = { buffer: 0, byteOffset: this.length, byteLength: bytes.byteLength }
    if (target) view.target = target
    this.push(bytes)
    this.json.bufferViews.push(view)
    return this.json.bufferViews.length - 1
  }
  push(bytes) {
    const array = new Uint8Array(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength)
    this.chunks.push(Buffer.from(array))
    this.length += array.byteLength
  }
  accessor(source, data, count, target) {
    const accessor = { bufferView: this.view(data, target), componentType: source.componentType, count, type: source.type }
    if (source.normalized) accessor.normalized = true
    if (source.type !== 'SCALAR' && data instanceof Float32Array && source.min) {
      const size = COMPONENTS[source.type]
      accessor.min = Array.from({ length: size }, (_, c) => Math.min(...Array.from({ length: count }, (_, i) => data[i * size + c])))
      accessor.max = Array.from({ length: size }, (_, c) => Math.max(...Array.from({ length: count }, (_, i) => data[i * size + c])))
    }
    this.json.accessors.push(accessor)
    return this.json.accessors.length - 1
  }
  write(file) {
    const pad = (4 - (this.length % 4)) % 4
    if (pad) this.push(new Uint8Array(pad))
    this.json.buffers[0].byteLength = this.length
    let text = Buffer.from(JSON.stringify(this.json))
    text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)])
    const bin = Buffer.concat(this.chunks)
    const header = Buffer.alloc(12)
    header.writeUInt32LE(0x46546c67, 0)
    header.writeUInt32LE(2, 4)
    header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8)
    const chunk = (type, body) => { const head = Buffer.alloc(8); head.writeUInt32LE(body.length, 0); head.writeUInt32LE(type, 4); return Buffer.concat([head, body]) }
    fs.writeFileSync(file, Buffer.concat([header, chunk(0x4e4f534a, text), chunk(0x004e4942, bin)]))
  }
}

/** Glass, clear coat and specular tints become plain standard surfaces; glass turns into simple see-through. */
function plainMaterial(material, model) {
  const ext = material.extensions ?? {}
  const pbr = (material.pbrMetallicRoughness ??= {})
  if (ext.KHR_materials_transmission) {
    material.alphaMode = 'BLEND'
    const [r, g, b] = pbr.baseColorFactor ?? [1, 1, 1, 1]
    pbr.baseColorFactor = [r, g, b, 0.35]
  }
  delete material.extensions
  for (const [slot, holder] of [['metallicRoughnessTexture', pbr], ['occlusionTexture', material]]) {
    const info = holder[slot]
    if (!info) continue
    if (slot === 'metallicRoughnessTexture') {
      const source = sourceOf(model, info.index)
      const bytes = imageBytes(model, model.json.images[source])
      const [, g, b] = average(bytes, mimeOf(model.json.images[source], bytes))
      pbr.roughnessFactor = (pbr.roughnessFactor ?? 1) * g
      pbr.metallicFactor = (pbr.metallicFactor ?? 1) * b
    }
    delete holder[slot]
  }
  delete material.normalTexture
  if (material.alphaMode !== 'MASK') delete material.doubleSided
}

function textureSlots(material) {
  const pbr = material.pbrMetallicRoughness ?? {}
  return [[pbr, 'baseColorTexture'], [material, 'emissiveTexture']].filter(([holder, slot]) => holder[slot])
}

function liteModel(url, size, out) {
  const model = readModel(path.join(PUBLIC, url))
  const json = model.json
  const largest = Math.max(...size)
  const budget = Math.min(MAX_TRIANGLES, Math.max(MIN_TRIANGLES, largest * TRIANGLES_PER_METRE))
  const meshes = json.meshes ?? []
  // Each primitive gets a share of the budget in proportion to its triangles, counted once per use in the scene.
  const uses = new Map()
  for (const node of json.nodes ?? []) if (node.mesh !== undefined) uses.set(node.mesh, (uses.get(node.mesh) ?? 0) + 1)
  const triangles = (primitive) => json.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3
  const total = meshes.reduce((sum, mesh, i) => sum + (uses.get(i) ?? 0) * mesh.primitives.reduce((s, p) => s + triangles(p), 0), 0)
  const share = Math.min(1, budget / Math.max(1, total))
  for (const material of json.materials ?? []) plainMaterial(material, model)

  // Images: re-encode only those still used, at the size the model's size calls for.
  const textureSize = new Map()
  for (const material of json.materials ?? []) {
    for (const [holder, slot] of textureSlots(material)) {
      const want = largest < SMALL ? 256 : 512
      const index = holder[slot].index
      textureSize.set(index, Math.max(textureSize.get(index) ?? 0, want))
    }
  }
  const prepared = meshes.map((mesh) => mesh.primitives.map((primitive) => simplifyPrimitive(model, primitive, triangles(primitive) * share)))
  const images = json.images ?? []
  const textures = json.textures ?? []
  const sources = new Map([...textureSize.keys()].map((index) => [index, imageBytes(model, images[sourceOf(model, index)])]))
  const writer = new GlbWriter(json)
  const newTextures = []
  const textureMap = new Map()
  const newImages = []
  const imageMap = new Map()
  for (const [index, want] of [...textureSize.entries()].sort((a, b) => a[0] - b[0])) {
    const source = sourceOf(model, index)
    const key = `${source}:${want}`
    if (!imageMap.has(key)) {
      const bytes = sources.get(index)
      const mime = mimeOf(images[source], bytes)
      newImages.push({ bufferView: writer.view(resized(bytes, mime, want)), mimeType: mime })
      imageMap.set(key, newImages.length - 1)
    }
    const texture = { ...textures[index] }
    delete texture.extensions
    texture.source = imageMap.get(key)
    newTextures.push(texture)
    textureMap.set(index, newTextures.length - 1)
  }
  for (const material of json.materials ?? []) for (const [holder, slot] of textureSlots(material)) holder[slot].index = textureMap.get(holder[slot].index)
  meshes.forEach((mesh, m) => mesh.primitives.forEach((primitive, p) => {
    const { attributes, indices, vertices } = prepared[m][p]
    for (const [name, { accessor, data }] of Object.entries(attributes)) primitive.attributes[name] = writer.accessor(accessor, data, vertices, 34962)
    const index = vertices > 65535 ? indices : Uint16Array.from(indices)
    primitive.indices = writer.accessor({ componentType: vertices > 65535 ? 5125 : 5123, type: 'SCALAR' }, index, index.length, 34963)
  }))
  json.images = newImages
  json.textures = newTextures
  if (!newTextures.length) { delete json.images; delete json.textures; delete json.samplers }
  json.extensionsUsed = (json.extensionsUsed ?? []).filter((name) => name === 'EXT_texture_webp' && newImages.some((image) => image.mimeType === 'image/webp'))
  json.extensionsRequired = (json.extensionsRequired ?? []).filter((name) => json.extensionsUsed.includes(name))
  for (const texture of newTextures) {
    if (newImages[texture.source].mimeType === 'image/webp') {
      texture.extensions = { EXT_texture_webp: { source: texture.source } }
      delete texture.source
    }
  }
  if (!json.extensionsUsed.length) delete json.extensionsUsed
  if (!json.extensionsRequired.length) delete json.extensionsRequired
  delete json.extras
  writer.write(out)
  const after = prepared.flat().reduce((sum, p) => sum + p.indices.length / 3, 0)
  return { before: Math.round(total), after: Math.round(after) }
}

await MeshoptSimplifier.ready
const ids = usedIds()
const assets = [...MODELS, ...EXTRA_MODELS].filter((asset) => ids.has(asset.id))
const lite = []
for (const asset of assets) {
  const dir = path.join(PUBLIC, asset.url.split('/')[0], 'lite')
  fs.mkdirSync(dir, { recursive: true })
  const liteUrl = `${asset.url.split('/')[0]}/lite/${asset.id}.glb`
  const result = liteModel(asset.url, asset.size, path.join(PUBLIC, liteUrl))
  const bytes = (file) => fs.statSync(path.join(PUBLIC, file)).size
  console.log(`${asset.id}: ${result.before} -> ${result.after} triangles, ${Math.round(bytes(liteUrl) / 1024)} KB`)
  lite.push([asset.url, liteUrl])
}
const listing = `/** Generated by scripts/liteModels.mjs: light copies of the library models the props use (fewer triangles, smaller and fewer textures, plain materials). */\nexport const LITE_MODELS: ReadonlyMap<string, string> = new Map([\n${lite.sort().map(([from, to]) => `  ['${from}', '${to}'],`).join('\n')}\n])\n`
fs.writeFileSync(path.join(ROOT, 'src/render3d/liteModels.ts'), listing)
fs.rmSync(scratch, { recursive: true })
