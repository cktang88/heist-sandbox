# One art style over mixed 3D: how games and renderers unify, and how to build it in three.js r185

Research for the "amateur 3D slapped together" risk. Goal: one deliberate look over photo-scanned PBR props, hand-built primitives and procedural characters, using a graphics pass.

Written 2026-11-10. Local engine: three 0.185.1 (`node_modules/three`), `PerspectiveCamera`, ACES tone mapping, `EffectComposer` chain `RenderPass -> UnrealBloomPass -> LensShader -> OutputPass` (`src/render3d/post.ts`).

## 0. Evidence labels

Every claim carries a URL and one of these labels. A claim without a label is a plain description of the cited page.

- **[READ]** I opened the page (or fetched the file) and read the passage.
- **[SNIPPET]** I only saw it in a web-search result summary. The page was blocked, empty or not opened. Treat as a lead.
- **[LOCAL]** Checked in the installed three 0.185.1 source on disk.
- **[INFER]** My engineering judgement. All millisecond and cost figures are budgets to measure, not facts.
- **[MINE]** GLSL or JS I wrote for this document. **None of it has been compiled or run** (no GPU or GLSL validator in this sandbox). Treat every snippet as a starting point to test.

## 1. Findings that change the plan

1. **RawConcrete is not a shader look.** Its developer says the graphics are "entirely hand drawn, no downscaling of photos, no photobashing" and that photobashing "doesn't work in practice, too many problems" [READ] https://discussions.unity.com/t/wip-highly-photorealistic-pixelated-2d-3d-side-scroller-called-rawconcrete-update-10/753551.json . The 13-post thread has no technique discussion beyond that. So the owner cannot "get RawConcrete" from a filter. What a filter can give is the same *feel*: muted photo-textured surfaces, a visible pixel grid, big soft light, haze.
2. **This War of Mine is real 3D.** The studio says "everything in This War of Mine is 3D. It just pretends it's a 2D side-scrolling game", made in their own Liquid Engine, with only the far background flat, and the camera locked parallel to the view [READ] https://80.lv/articles/this-war-of-mine-a-game-about-civilians-in-war . The art director combined palette, hand-drawn style and an old sepia-photo feel, and looked at A-ha's "Take On Me" video (real footage mixed with a hand-drawn world) as the model [READ, same page]. The actual charcoal shader method is **not published** anywhere I could open. One search summary says the team "developed shaders to give a sort of hand-drawn charcoal effect" [SNIPPET, Medium repost https://medium.com/@peterwarrior_az/this-war-of-mine-when-games-arent-funny-anymore-2e8b4e5183ac , page blocked]. Everything in section 4.5 about "TWoM-like" sketching is therefore my reconstruction, not their recipe.
3. **The strongest unifiers in shipped games are boring and non-shader**: one palette, one lighting model, one outline rule, plus fog. Sable's creative director says the team needed a style "quick to produce, quick to iterate on, and visually consistent"; lighting and shadows for readability, "distant fog" as "really, really key", outlines that fade with distance [READ] https://www.gamedeveloper.com/marketing/how-shedworks-refined-the-art-of-sable-in-pursuit-of-readability .
4. **A perspective camera makes pixel snapping imperfect.** Snap-and-compensate is exact only under orthographic projection; with perspective "pixels at different depths drift at different rates, and no single snap corrects all depths" [READ] https://arxiv.org/abs/2603.14587 (Texel Splatting, Ebert, 2026). Our camera is `PerspectiveCamera`. See section 5.4 for what that costs and the options.
5. **`MeshNormalMaterial` ignores alpha tests and maps** [LOCAL] (`ShaderLib/meshnormal.glsl.js` contains no `alphatest` or `alphamap`). three's own `RenderPixelatedPass` uses `scene.overrideMaterial = MeshNormalMaterial`, so fences, grates, foliage cut-outs and sprites become solid quads in the normal buffer. Handle this before shipping outlines (section 5.3).
6. **Replaced's developers rejected 3D-sourced sprites**: "Whenever we tried experimenting with 3D models, the result was sub-par and very noisy. We wanted our game's world to be cohesive" [READ] https://news.xbox.com/en-us/?p=219836 . Dead Cells's artist admits the 3D-to-pixel route has unsolved "flickering pixels" and "disappointing level of details" [READ] https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i- . Both are the same risk we carry: raw 3D shading looks noisy once pixelated. Palette, dither and outline rules are the fix.

## 2. How the reference games do it

### 2.1 This War of Mine and other 11 bit work
- See finding 2. Facts: all 3D, Liquid Engine, side camera, flat far background, characters made from 3D scans of the staff cleaned up by artists [READ] https://80.lv/articles/this-war-of-mine-a-game-about-civilians-in-war .
- Marszał's stated goals: "contrasty message with some form of simplification and a bit of washed colors", inspired by 80s/90s music videos and hand-drawn cels over footage [SNIPPET] https://techraptor.net/gaming/interview/art-and-war-mine-interview-11-bit-studios (403 to bots; I did not evade it).
- No talk, postmortem or blog from 11 bit about hatching, paper texture, animated sketch lines or vignetting was found. Their 2016 NDC talk "Hurdles in creating Art for a true game about War" exists [SNIPPET, video only] https://www.youtube.com/watch?v=_TLmyadRaho . I could not read it.
- Frostpunk: no rendering write-up found. Studio later dropped Liquid Engine for Unreal ("Frostpunk 1886" on UE5) [SNIPPET] https://gamedeveloper.com/business/11-bit-makes-moves-to-bring-meaningful-games-into-aaa-realm and https://www.gamingonlinux.com/2025/04/11-bit-studios-are-remaking-the-original-frostpunk-in-unreal-engine-5-with-frostpunk-1886/comment_id=278201 .

### 2.2 3D to pixel-art pipelines
| Game / source | What they do | Status |
|---|---|---|
| **Dead Cells** (Vasseur) | Very basic 3D model + skeleton in 3DS Max; a homebrew tool "renders the mesh in a very small size and without antialiasing"; each frame exported as PNG **with a normal map** so volume is rendered "using a basic toon shader"; shadows are not hand drawn thanks to a lighting system built for it; "cell shading on our models rendered in low resolution, without any anti-aliasing"; flickering pixels unsolved [READ] https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i- . Background artist: "highly saturated color spectrums", chosen for gameplay readability [READ] https://gonintendo.com/archives/280488-dead-cells-dev-blog-art-design-deep-dive-giving-back-colors-to-cryptic-worlds . | read |
| **t3ssel8r** | Original is a YouTube video, not readable here. A Godot port by David Holland documents it: 1px outlines from a 4-neighbour kernel on depth (object outlines) and normals (edge highlights, convex edges only via cross product), toon lighting, **camera snapped to a view-aligned texel grid, then the output shifted back in screen space by the snap error** [READ] https://davidholland.netlify.app/articles/3d-pixel-art-rendering . | port read |
| **Pixel-art rendering write-up** (godot) | Pipeline: low-res render, nearest upscale, orthographic projection ("most pixel art is drawn in orthographic perspective... fixes the wobbly cube"), palette posterise by nearest palette colour, dither (offset before posterise), depth+normal outlines/highlights, cel shading for colour control; snap objects to pixel size in world space; notes bloom makes smooth gradients that break the look [READ] https://thecodecofficial.github.io/Blog/PixelArt/ . | read |
| **Texel Splatting** (2026) | Cubemap-based perspective-stable pixel art, object-ID discontinuities for silhouettes, normal discontinuities for creases [READ abstract] https://arxiv.org/abs/2603.14587 | abstract read |
| **A Short Hike** | Low-res render texture shown with point filtering, quantised to a palette, plus a grading shader [SNIPPET, forum summaries of the dev's GDC talk] https://itch.io/post/2065934 and https://j-red.github.io/arcadeflight . Not verified at source. | snippet |
| **HD-2D (Octopath Traveler)** | UE4; the team added depth and effects to pixel sprites so the pixel demo looked as good on screen as in their heads [SNIPPET] https://www.unrealengine.com/en-US/spotlights/octopath-traveler-s-hd-2d-art-style-and-story-make-for-a-jrpg-dream-come-true (page returned nothing to me). Depth of field, tilt-shift and bloom as components: **not verified** by any page I opened. | snippet |
| **The Last Night** | Unity; 3D camera over 2D art, vertical surfaces are billboards, floors are real 3D so they take lighting and reflections; "low-fi assets, hi-fi rendering" [SNIPPET] https://80.lv/articles/the-last-night-pixel-art-cyberpunk-open-world (page body did not load) and https://oddtales.net/blog . | snippet |
| **Replaced** | Frame-by-frame sprites, "best in class pixel art enhanced by modern depth-of-field, lighting, and cinematic visual effects"; rejected 3D-model-based animation as noisy [READ] https://news.xbox.com/en-us/?p=219836 . How the 2D layers are lit is not stated (one outside article claims baked lightmaps, unverified) [SNIPPET] https://bonus-action.com/feature/replaceds-director-taught-himself-everything-from-scratch-to-make-the-most-beautiful-pixel-art-game-of-the-year-i-just-got-a-keen-eye-on-things/ . | read / snippet |
| **Eastward** | Custom engine "Maoi" with shader textures and lighting for atmosphere, weather, time of day [SNIPPET] https://80.lv/articles/exploring-next-gen-pixel-art-with-real-time-dynamic-lighting . No source says how sprites receive light. | snippet |
| **Signalis** | Pixel backdrops with 3D characters in a PS1 manner [SNIPPET] https://www.pcgamer.com/arctic-horror-signalis-is-oozing-with-retro-anime-chills . No developer breakdown of its dithering/banding found. | snippet |
| **Lethal Company** | Unity HDRP; Acerola's breakdown covers fixed low-resolution rendering, edge detection, posterisation, depth of field and bloom; the game holds 100+ fps on mid hardware largely by rendering low-res [READ summary only, the video is not readable] https://80.lv/articles/how-to-achieve-lethal-company-s-graphics-with-unity-hdrp . | summary read |

### 2.3 Dithering that stays put (Obra Dinn)
- Pope renders internally in 8-bit grey and converts to 1-bit in post; his first stable approach was dither pinned to the player's head sphere: "pinned to the geometry during camera rotation but not during camera translation" [READ] https://runevision.com/tech/dither3d . I could not open the original TIGSource devlog (forum blocked), so the blue-noise-variant detail is [SNIPPET] https://setsideb.com/?p=5672 .
- Random-ish dither compresses better than a regular Bayer pattern on video, and Pope set the game at 640x360 so dithering stays visible [READ] https://www.gamedeveloper.com/design/lucas-pope-and-the-rise-of-the-1-bit-dither-punk-aesthetic .
- Surface-stable fractal dithering (Rune Skovbo Johansen): dots stick to surfaces yet keep constant screen size; open source, **MPL-2.0** [READ page + LICENSE first line] https://runevision.com/tech/dither3d and https://github.com/runevision/Dither3D . It is a material-side Unity shader; porting to three is real work and not needed for a side view (see 4.3 for the cheap world-anchored version).

### 2.4 Painterly and graphic looks
- **Spider-Verse**: the graphic look was built mostly in compositing: "over 25 individual tools", the "Hatcher and Thresher" tools make halftone dots and hatch lines whose weight follows the lighting's shading; accent ink lines, offset colours, smearing [READ] https://colorway.foundry.com/insights/film-tv/graphic-look-in-comp-spiderman . Lesson: halftone and hatching are driven by the *tone* of the shaded image, thick in dark, thin in light.
- **Hi-Fi Rush**: a deferred toon renderer on customised UE4, covering characters and environment, 60 fps native; GDC 2024 talk topics: comic shader, toon light, shadows, static shadow map, GI, face shadows [READ summary] https://80.lv/articles/the-making-of-hi-fi-rush-s-3d-toon-rendering-style ; talk page https://gdcvault.com/play/1034251/3D-Toon-Rendering-in-Hi . Outline method not stated.
- **Borderlands**: style began as a 2D drawing by Scott Kester; cel-shaded look over textures, changed late in development [SNIPPET] https://www.tomshardware.com/reviews/gdc-2010-borderlands,2580-3.html and https://80.lv/articles/how-borderlands-devs-created-franchise-s-signature-art-style (body is a teaser). Texture and ink-line method: not verified.
- **Sable**: see finding 3. The Moebius-style look is reproduced with Sobel on depth and normals in community write-ups [SNIPPET] https://blog.maximeheckel.com/posts/moebius-style-post-processing ; I read that article for the three.js mechanics (section 5).
- **Disco Elysium**: environments are hand painted (193 4K textures with companion height, normal and shadow maps, per one report) in Unity [SNIPPET] https://mcvuk.com/business-news/we-knew-immediately-that-we-needed-to-make-a-game-with-a-striking-and-unique-look-to-accompany-the-writing-a-look-that-would-balance-the-mundane-with-the-unfamiliar-and-strange-the-art/ . Cohesion comes from the painting itself, not a filter. No shader breakdown found.
- **Arcane, Kentucky Route Zero, Inside**: no technical sources opened for the first two. For Inside, the repo already holds notes from Playdead's GDC 2016 deck (grain, fog glow, graded palette) in `docs/research/rendering.md`; I did not re-verify them here.

### 2.5 What the games have in common
[INFER, from the sources above] The consistent pattern is: (a) a restricted, hue-controlled palette; (b) lighting that is simplified or quantised (toon ramp, ordered dither) so scanned and modelled objects respond the same way; (c) one outline convention; (d) fog or haze for depth separation; (e) a texture/grain/paper layer over everything, so every surface shares one "noise floor"; (f) a resolution decision that hides texel-density mismatch.

## 3. Material-side unification (do this regardless of the pass)

These cost nothing at runtime and matter as much as the filter. Numbers are **suggested starting values [INFER]**, not sourced.

1. **One albedo range.** Clamp scanned-texture albedo to roughly 0.04-0.8 linear luminance and cap saturation (about 0.45 HSV) except for declared accent materials (signage, wiring, neon). Photo scans carry baked lighting and wide value spread that the primitives lack; clamping removes it.
2. **Pull photo textures toward the palette.** Multiply or hue-shift scanned albedos by a per-biome tint so concrete, rust and plaster live in the same hue families as the painted primitives.
3. **Shared roughness band.** Remap scanned roughness into e.g. 0.35-0.95 so nothing is mirror-clean next to nothing; primitives use the same band.
4. **One texel density.** Pick a target (for a 1080p side view, something like 128-256 px per metre) and mip-bias scanned 4K textures down to it. A pixel pass hides the mismatch; a painterly pass (look C) does not.
5. **Drop microdetail that fights the style.** In pixel looks, disable detail normals beyond a short distance; in sketch looks, flatten them.
6. **Enforce it in code, once.** Inject a grade after `#include <map_fragment>` (chunk exists, [LOCAL] `ShaderChunk/map_fragment.glsl.js`) via `material.onBeforeCompile`:

```glsl
// [MINE] injected after #include <map_fragment> in MeshStandardMaterial/MeshPhysicalMaterial
// uniforms: uAlbedoMin, uAlbedoMax (float), uSatMax (float), uTint (vec3)
vec3 albedoGrade(vec3 c){
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float l2 = clamp(l, uAlbedoMin, uAlbedoMax);
  c *= l2 / max(l, 1e-4);                 // value clamp, keeps hue
  float g = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(g), c, min(1.0, uSatMax / max(length(c - g) / max(g, 1e-3), 1e-3))); // crude saturation cap
  return c * uTint;
}
// diffuseColor.rgb = albedoGrade(diffuseColor.rgb);
```

## 4. Techniques with GLSL

All snippets target three `ShaderMaterial` under WebGL2 (GLSL ES 3.00 is used by three, so `texelFetch`, integer ops and dynamic loops are available) [INFER]. Uniform names are placeholders.

### 4.1 Low-resolution render, nearest upscale
Render the whole chain into a smaller target, then upscale with nearest sampling. `RenderPixelatedPass` does the first half: it sets render targets to `width/pixelSize | 0` with `NearestFilter` and `HalfFloatType` and a `DepthTexture` [LOCAL; identical to dev `RenderPixelatedPass.js` https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/postprocessing/RenderPixelatedPass.js , MIT]. It does **not** snap the camera and does not quantise colour. EffectComposer targets default to linear mag filtering, so use a manual nearest fetch in the final pass:

```glsl
// [MINE] final upscale pass, runs at full canvas resolution
uniform sampler2D tDiffuse;      // low-res composer buffer
uniform vec2  uLowRes;           // e.g. (640,360)
uniform float uScale;            // canvas px per low-res px (float, e.g. 3.0)
uniform vec2  uResidual;         // camera snap error in low-res px, range (-0.5, 0.5); see 5.4
varying vec2 vUv;
void main(){
  vec2 s = gl_FragCoord.xy / uScale + uResidual;       // sample position in low-res px
  vec2 uv = (floor(s) + 0.5) / uLowRes;                 // nearest
  gl_FragColor = texture2D(tDiffuse, clamp(uv, 0.0, 1.0));
}
```
Make the low-res buffer 1-2 px larger than the viewport on each side if the residual shift would expose a blank edge [INFER].

### 4.2 Outlines from depth and normals (silhouette vs crease)
Method per Holland/t3ssel8r (4-neighbour kernel, depth for outer lines, normals for inner lines/highlights) [READ] https://davidholland.netlify.app/articles/3d-pixel-art-rendering ; three's own version is the `RenderPixelatedPass` fragment shader (depth edge darkens by `depthEdgeStrength`, normal edge brightens by `normalEdgeStrength`, one-pixel kernel) [LOCAL]. Roberts-cross and Sobel variants: Heckel uses Sobel on depth plus normal buffers [READ] https://blog.maximeheckel.com/posts/moebius-style-post-processing . A clean version that outputs a line *mask* you can colour or wobble later:

```glsl
// [MINE] outputs vec4(silhouette, crease, 0, 1). Needs tDepth (beauty depth) and tNormal (MeshNormalMaterial, view space, 0..1)
#include <packing>
uniform sampler2D tDepth, tNormal; uniform vec2 uTexel;       // 1/resolution of these buffers
uniform float uNear, uFar, uDepthK, uNormalK;                  // try uDepthK 0.04, uNormalK 0.35
varying vec2 vUv;
float lin(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
vec3  nrm(vec2 uv){ return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
void main(){
  vec2 o[4] = vec2[4](vec2(1,0), vec2(-1,0), vec2(0,1), vec2(0,-1));
  float d0 = lin(vUv); vec3 n0 = nrm(vUv);
  float sil = 0.0, cre = 0.0;
  for (int i = 0; i < 4; i++){
    vec2 uv = vUv + o[i] * uTexel;
    float d = lin(uv);
    sil = max(sil, smoothstep(uDepthK, uDepthK * 2.0, (d - d0) / d0));   // only the nearer pixel gets the line: d > d0
    cre = max(cre, smoothstep(uNormalK, uNormalK * 1.5, 1.0 - dot(n0, nrm(uv))) * step(abs(d - d0) / d0, uDepthK));
  }
  gl_FragColor = vec4(sil, cre, 0.0, 1.0);
}
```
Tuning notes [INFER]: use relative depth (`(d-d0)/d0`) so thresholds do not change with distance; fade `uDepthK` effect with distance for the Sable-style fading lines [READ] https://www.gamedeveloper.com/marketing/how-shedworks-refined-the-art-of-sable-in-pursuit-of-readability ; normals from `MeshNormalMaterial` ignore normal maps unless the material has one, so scanned props show crease lines from their baked-in micro-normals only if given the same map.

### 4.3 Palette quantisation with ordered or blue-noise dither
Concept as in the Godot write-up: add a small offset before nearest-palette lookup [READ] https://thecodecofficial.github.io/Blog/PixelArt/ . Dither pattern anchored to the world: add the snapped camera position in whole texels to the pixel coordinate, so the pattern pans with the play plane instead of swimming across it [INFER; exact only at the play plane under a perspective camera].

```glsl
// [MINE] palette + Bayer 8x8, runs on the low-res buffer AFTER OutputPass (display-referred sRGB)
uniform sampler2D tDiffuse; uniform vec3 uPalette[48]; uniform int uPaletteN;
uniform float uDither;            // 0.0 .. ~0.08, in linear-ish colour units (tune per palette spacing)
uniform vec2  uCamTexels;         // snapped camera position in integer low-res px (see 5.4)
uniform vec2  uLowRes;
varying vec2 vUv;
float bayer8(vec2 p){
  ivec2 i = ivec2(mod(floor(p), 8.0)); int x = i.x, y = i.y, xy = x ^ y;
  int v = ((xy & 1) << 5) | ((y & 1) << 4) | ((xy & 2) << 2) | ((y & 2) << 1) | ((xy & 4) >> 1) | ((y & 4) >> 2);
  return (float(v) + 0.5) / 64.0;                       // 0..1
}
vec3 nearestPalette(vec3 c){
  float best = 1e9; vec3 bc = uPalette[0];
  for (int i = 0; i < 48; i++){ if (i >= uPaletteN) break;
    vec3 d = c - uPalette[i];
    float e = dot(d * d, vec3(0.30, 0.59, 0.11));       // luma-weighted; swap for OKLab if palette hues are close
    if (e < best){ best = e; bc = uPalette[i]; } }
  return bc;
}
void main(){
  vec2 px = floor(vUv * uLowRes) + uCamTexels;
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  c += (bayer8(px) - 0.5) * uDither;
  gl_FragColor = vec4(nearestPalette(c), 1.0);
}
```
Bit-pattern check: the index formula reproduces the standard 8x8 Bayer first row `0 32 8 40 2 34 10 42` and first column `0 48 12 60...` [MINE, checked by hand]. For blue noise instead of Bayer, sample a 64x64 blue-noise texture (`RepeatWrapping`, `NearestFilter`) at `px / 64.0`; Pope found random-looking dither survives video compression better [READ] https://www.gamedeveloper.com/design/lucas-pope-and-the-rise-of-the-1-bit-dither-punk-aesthetic . Cost grows with palette size (48 taps of arithmetic per pixel on a low-res buffer is cheap); for larger palettes bake a 3D LUT (32x32x32) of "nearest palette colour" and sample it, which `LUTPass` can apply [LOCAL, `examples/jsm/postprocessing/LUTPass.js` exists with `lut`, `lutSize`, `intensity` uniforms].

### 4.4 Toon ramp and rim light (material side, lights stay real)
Dead Cells renders volume with a "basic toon shader" off a normal map [READ, link in 2.2]. For lit 3D in three, quantise the lighting contribution rather than the final colour so hues stay controlled (the Godot write-up's "improved posterisation", [READ] https://thecodecofficial.github.io/Blog/PixelArt/). In three this means `MeshToonMaterial` with a `gradientMap` (3-5 texel `NearestFilter` ramp), or an `onBeforeCompile` patch to `MeshStandardMaterial` that does `floor(NdotL*k)/k`. Keeping PBR for scanned props and quantising only in the post (4.3) is the lower-risk route because the palette pass already collapses the shading. Rim light: `pow(1.0 - dot(N, V), 3.0) * rimColor` added to emissive, restricted to the player and enemies so they separate from the background [INFER].

### 4.5 Sketch / charcoal / hatching (look B)
Not documented for TWoM (finding 2), so this is a design built from documented parts: hatching and halftone weight driven by shaded tone (Spider-Verse's Hatcher/Thresher [READ]), ink lines from depth+normal edges (4.2), paper multiply, desaturation. Existing open code: `spite/sketch` (three.js cross-hatching and engraving explorations, **MIT**) [READ licence line; repo described in search] https://github.com/spite/sketch with a post cross-hatch demo at https://spite.github.io/sketch/post-cross-hatch-i ; `spite/cross-hatching` is a material shader based on the Microsoft real-time hatching paper [SNIPPET] https://kandi.openweaver.com/html/spite/cross-hatching .

```glsl
// [MINE] sketch composite. Inputs: tDiffuse (tone-mapped sRGB scene), tLines (4.2 output), tPaper (tileable greyscale paper, RepeatWrapping)
uniform sampler2D tDiffuse, tLines, tPaper;
uniform vec2 uRes; uniform float uTime;
uniform float uLineWidthPx;        // 1.5-2.5 at 1080p
uniform float uHatchDensity;       // lines per 100 px, ~ 9
uniform vec3  uPaper, uInk;        // e.g. (0.86,0.82,0.72), (0.08,0.07,0.07)
uniform float uKeepColour;         // 0..1 how much lit-source colour survives
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float stripes(vec2 p, float ang, float freq, float w){
  float x = dot(p, vec2(cos(ang), sin(ang))) * freq;
  float f = abs(fract(x) - 0.5) * 2.0;                  // 1 on a line centre, 0 midway
  return smoothstep(1.0 - w - 0.12, 1.0 - w + 0.12, f);
}
void main(){
  vec2 px = vUv * uRes;
  float frame = floor(uTime * 8.0);                      // "boil": re-roll wobble 8 times a second
  vec2 wob = (vec2(hash(floor(px / 24.0) + frame), hash(floor(px / 24.0) + frame + 7.0)) - 0.5) * 2.0;
  vec3 scene = texture2D(tDiffuse, vUv + wob / uRes).rgb;
  vec2 lines = texture2D(tLines, vUv + wob * 1.5 / uRes).rg;     // lines wobble more than fills
  float L = dot(scene, vec3(0.2126, 0.7152, 0.0722));
  float f = uHatchDensity / 100.0;
  float h  = stripes(px,  0.7854, f, 0.35) * smoothstep(0.62, 0.50, L);   // light hatch
        h  = max(h, stripes(px, -0.7854, f, 0.35) * smoothstep(0.42, 0.30, L)); // cross hatch
        h  = max(h, stripes(px,  0.0,   f * 1.3, 0.45) * smoothstep(0.22, 0.12, L)); // dense
        h  = max(h, smoothstep(0.08, 0.03, L));                                   // solid black
  float ink = clamp(max(h, max(lines.x, lines.y * 0.6)), 0.0, 1.0);
  float paper = texture2D(tPaper, px / 512.0).r;
  vec3 base = uPaper * (0.88 + 0.12 * paper);
  vec3 tone = mix(base, base * 0.55, smoothstep(0.7, 0.0, L));          // mid-tone wash under the hatching
  vec3 col = mix(tone, uInk, ink);
  // selective colour: keep source hue where the scene is both bright and saturated (lamps, neon)
  float mx = max(scene.r, max(scene.g, scene.b)), mn = min(scene.r, min(scene.g, scene.b));
  float lamp = smoothstep(0.55, 0.85, mx) * smoothstep(0.25, 0.55, (mx - mn) / max(mx, 1e-3));
  col = mix(col, scene, lamp * uKeepColour * (1.0 - ink * 0.8));
  gl_FragColor = vec4(col, 1.0);
}
```
Stability: the hatching is screen-anchored, so it will shimmer under pan. Anchor `px` to the world instead by adding `camPosPx` (camera x/y times pixels-per-world-unit at the play plane) to `px` for hatch only, leaving the paper screen-anchored; this makes strokes stick to the scenery like a drawing on cel layers [INFER]. Paper texture: any seamless CC0 greyscale paper works; I did not verify a specific source.

### 4.6 Halftone, grain, CRT, chromatic aberration
- three ships `HalftonePass`, `DotScreenPass`, `FilmPass`, `FXAAPass`, `SMAAPass` and `LUTPass` [LOCAL listing of `examples/jsm/postprocessing`].
- pmndrs/postprocessing (licence **Zlib**, v6.39.6, peer `three >=0.168 <0.188`, so compatible with r185) has `PixelationEffect`, `ColorDepthEffect`, `OutlineEffect`, `ScanlineEffect`, `LUT3DEffect`, `DotScreenEffect`, `SepiaEffect`, `NoiseEffect`, `VignetteEffect`, `ChromaticAberrationEffect` [READ package.json; file existence checked by HTTP 200 on raw.githubusercontent.com/pmndrs/postprocessing/main/src/effects/*.js]. It has **no** `KuwaharaEffect` (404 at that path). Using it means replacing `EffectComposer`; the repo's custom passes would need to be ported. Source: https://github.com/pmndrs/postprocessing
- Halftone from tone: `float d = length(fract(rot(px/cell)) - 0.5); ink = step(d, sqrt(1.0 - L) * 0.6);` with `rot` a 45 degree rotation [MINE, trivial].
- The repo's existing `LensShader` already does chromatic fringing, vignette and film grain [LOCAL `src/render3d/post.ts`]. Keep them, but move grain to *after* quantisation or give it low-res cell size, or it breaks the pixel look.

### 4.7 Kuwahara and anisotropic Kuwahara (look C)
Theory: Kuwahara divides a window into sectors and outputs the mean of the lowest-variance sector, so it flattens texture but keeps edges; Papari's 8-sector circular extension and Kyprianidis et al.'s anisotropic version with polynomial weights are the references [READ] https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders . Papers: Kyprianidis, Kang, Döllner 2009 https://umsl.edu/~kangh/Papers/kang_cgf09.pdf (URL from search result; the file returned 404 to me, [SNIPPET]) and the polynomial-weights paper https://www.umsl.edu/~kangh/Papers/kang-tpcg2010.pdf [SNIPPET].

Existing code: Godot port of Acerola's shader, snippets stated MIT in the post, adapted from https://github.com/GarrettGunnell/Post-Processing (licence of that repo **not verified**: `LICENSE` returned 404) [READ] https://godotshaders.com/shader/anisotropic-kuwahara-filter/ . Heckel's R3F implementation is a tutorial with code in the page, **licence not stated** [READ] https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders . TresJS wraps a Kuwahara effect (`KuwaharaPmndrs`) [SNIPPET] https://deploy-preview-1259--postprocessing-tresjs.netlify.app/api/pmndrs/kuwahara . No vanilla-three drop-in found. Blender has an implementation [SNIPPET] https://projects.blender.org/blender/blender/pulls/110786 (GPL, reference only).

Heckel's guidance: circular kernel with 8 sectors balances quality and speed; replace the Gaussian with the polynomial weight, which he found faster and good at a smaller kernel [READ, same page]. Below is my own rewrite of the paper's algorithm (clean structure so you can read it); do not copy the Godot code verbatim without checking its licence chain.

```glsl
// [MINE] pass 1: structure tensor (Sobel on RGB) -> RT (HalfFloat). Then blur with any separable Gaussian, sigma ~2.
uniform sampler2D tDiffuse; uniform vec2 uTexel; varying vec2 vUv;
void main(){
  vec3 gx = ( texture2D(tDiffuse, vUv + uTexel*vec2( 1, 1)).rgb + 2.0*texture2D(tDiffuse, vUv + uTexel*vec2( 1, 0)).rgb + texture2D(tDiffuse, vUv + uTexel*vec2( 1,-1)).rgb
             -texture2D(tDiffuse, vUv + uTexel*vec2(-1, 1)).rgb - 2.0*texture2D(tDiffuse, vUv + uTexel*vec2(-1, 0)).rgb - texture2D(tDiffuse, vUv + uTexel*vec2(-1,-1)).rgb) * 0.25;
  vec3 gy = ( texture2D(tDiffuse, vUv + uTexel*vec2( 1, 1)).rgb + 2.0*texture2D(tDiffuse, vUv + uTexel*vec2( 0, 1)).rgb + texture2D(tDiffuse, vUv + uTexel*vec2(-1, 1)).rgb
             -texture2D(tDiffuse, vUv + uTexel*vec2( 1,-1)).rgb - 2.0*texture2D(tDiffuse, vUv + uTexel*vec2( 0,-1)).rgb - texture2D(tDiffuse, vUv + uTexel*vec2(-1,-1)).rgb) * 0.25;
  gl_FragColor = vec4(dot(gx,gx), dot(gx,gy), dot(gy,gy), 1.0);
}
```
```glsl
// [MINE] pass 2: anisotropic Kuwahara, 8 sectors, polynomial weights.
// Orientation convention is the one thing I could not verify: if strokes run ACROSS edges, swap `dir` and `per`.
uniform sampler2D tDiffuse, tTensor; uniform vec2 uTexel; varying vec2 vUv;
uniform int   uRadius;   // 3..5 at 1080p
uniform float uQ;        // sharpness, 8
uniform float uHard;     // 8 (x1000 below)
uniform float uAlpha;    // 1.0 (anisotropy strength)
uniform float uZeta;     // 0.1
const float ZC = 0.58;
void main(){
  vec3 t = texture2D(tTensor, vUv).xyz;                                   // E, F, G
  float disc = sqrt(max((t.x - t.z)*(t.x - t.z) + 4.0*t.y*t.y, 0.0));
  float l1 = 0.5*(t.x + t.z + disc), l2 = 0.5*(t.x + t.z - disc);
  vec2 v = vec2(l1 - t.x, -t.y);                                          // local orientation: ALONG edges (min change)
  vec2 dir = dot(v,v) > 1e-10 ? normalize(v) : vec2(1.0, 0.0);
  vec2 per = vec2(-dir.y, dir.x);
  float A = (l1 + l2) > 1e-6 ? (l1 - l2)/(l1 + l2) : 0.0;
  float r = float(uRadius);
  float a = r * clamp((uAlpha + A)/uAlpha, 0.1, 2.0);                     // long axis, along edges
  float b = r * clamp(uAlpha/(uAlpha + A), 0.1, 2.0);
  float eta = (uZeta + cos(ZC)) / (sin(ZC)*sin(ZC));
  vec4 m[8]; vec3 s[8];
  for (int k = 0; k < 8; k++){ m[k] = vec4(0.0); s[k] = vec3(0.0); }
  int R = int(ceil(max(a, b)));
  for (int j = -R; j <= R; j++) for (int i = -R; i <= R; i++){
    vec2 p = vec2(float(i), float(j));
    vec2 q = vec2(dot(p, dir)/a, dot(p, per)/b);                           // unit-disc coordinates
    if (dot(q,q) > 1.0) continue;
    vec2 vv = 0.5 * q;                                                     // paper works on radius 0.5
    vec3 c = clamp(texture2D(tDiffuse, vUv + p * uTexel).rgb, 0.0, 1.0);
    float w[8]; float sum = 0.0;
    for (int k = 0; k < 8; k++){
      float th = float(k) * 0.7853982;
      vec2 ax = vec2(cos(th), sin(th)), pp = vec2(-ax.y, ax.x);
      float xl = dot(vv, pp), yl = dot(vv, ax);
      float z = max(0.0, yl + uZeta - eta * xl * xl);
      w[k] = z * z; sum += w[k];
    }
    float g = exp(-3.125 * dot(vv, vv)) / max(sum, 1e-6);
    for (int k = 0; k < 8; k++){ float wk = w[k] * g; m[k] += vec4(c * wk, wk); s[k] += c * c * wk; }
  }
  vec4 outc = vec4(0.0);
  for (int k = 0; k < 8; k++){
    vec3 mean = m[k].rgb / max(m[k].w, 1e-6);
    vec3 var3 = abs(s[k] / max(m[k].w, 1e-6) - mean * mean);
    float wgt = 1.0 / (1.0 + pow(uHard * 1000.0 * (var3.r + var3.g + var3.b), 0.5 * uQ));
    outc += vec4(mean * wgt, wgt);
  }
  gl_FragColor = vec4(outc.rgb / max(outc.w, 1e-6), 1.0);
}
```
Cost [INFER]: window (2R+1)^2 taps times 8 sector weights per tap. R=4 is 81 taps and roughly 650 weight evaluations per pixel; at 1920x1080 this is the most expensive pass in any candidate. Run it at 0.5-0.75 resolution and upscale, or mask it out near the player. The basic 4-sector Kuwahara (Heckel's first version) is far cheaper and looks "blocky" [READ, same page].

### 4.8 LUT grading to force a palette
`LUTPass` (three) applies a 3D LUT with `intensity` [LOCAL]. To force a limited palette, bake a 32^3 LUT offline whose every cell holds the nearest palette colour of the cell's input (or a smooth ramp-based grade for looks B/C), load as `Data3DTexture`. Use it *before* dither for pixel looks only if you want soft palette steering; quantise afterwards with 4.3 [INFER]. Heckel recommends colour correction plus textures for the painterly finish [READ] https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders .

### 4.9 Depth and distance (the cheap unifier)
Sable: distant fog is "really, really key" to readability, and outlines fade with distance [READ] https://www.gamedeveloper.com/marketing/how-shedworks-refined-the-art-of-sable-in-pursuit-of-readability . The scene already uses `FogExp2` [LOCAL `renderer3d.ts`]. Colour the fog to a palette entry, not grey, so far layers collapse into one palette family.

## 5. three.js implementation

### 5.1 Pass order
HDR (linear, `HalfFloatType`) passes first, display-referred passes after `OutputPass`. `OutputPass` is where tone mapping and sRGB conversion happen in a composer chain, using `renderer.toneMapping` and `renderer.toneMappingExposure` [LOCAL `OutputPass.js`]; it passes the alpha channel through [LOCAL `OutputShader.js`: `gl_FragColor = texture2D(...)` then only `.rgb` is tone mapped]. Composer buffers are `HalfFloatType` [LOCAL `EffectComposer.js`].

```
Scene render (HDR, depth texture)  ->  [normal pre-pass]  ->  Bloom (HDR)  ->  (HDR grade / lens)  ->  OutputPass (ACES + sRGB)
  ->  line extract (depth+normal)  ->  look pass (A: palette+dither | B: sketch | C: Kuwahara + grade)  ->  final upscale / grain / vignette
```
Rules [INFER]: bloom before tone mapping so bright sources spread in linear light; **never bloom after palette quantisation** (smooth gradients break the pixel look; the Godot write-up says the same [READ]); Kuwahara, hatching and palette operate on tone-mapped sRGB, because their thresholds are perceptual; outline extraction uses depth/normal buffers so it is independent of order but its *colouring* belongs after tone mapping.

### 5.2 Render target resolution for pixelation
- Pixel size P: low-res size is `round(canvas / P)`. Call `composer.setSize(lowW, lowH)` while `renderer.setSize(canvasW, canvasH, false)` keeps the canvas at full size. The final pass (4.1) writes to the screen. Existing hook: `resize()` in `renderer3d.ts` already scales by a `sharpness` factor [LOCAL]; a `pixelSize` factor goes in the same place.
- Keep HUD, text and any crisp overlays on a separate full-res layer above (the project has a 2D `drawHud`, [LOCAL file list `src/render`]).
- MSAA: with a low-res target, aliasing is the look. Turn MSAA off for look A. For B and C keep SMAA/FXAA or `samples: 4` on the render target [INFER].

### 5.3 Depth and normal buffers
- **Depth**: give the beauty render target a `DepthTexture` (`RenderPixelatedPass` does) and read it with `perspectiveDepthToViewZ` from `<packing>` (Heckel does the same) [LOCAL + READ].
- **Normals, verified route**: second render with `scene.overrideMaterial = new MeshNormalMaterial()` into a `NearestFilter` target (what `RenderPixelatedPass` does, [LOCAL]). Cost: roughly doubles draw-call count for that frame [INFER]. Mitigations [INFER]: render the pre-pass at the same low-res target; hide non-geometry (rain, light cones, sky dome, particles, decals) with a layer or a `userData.noOutline` flag during the pre-pass; for alpha-tested meshes either accept solid-quad creases (depth, which comes from the beauty pass, still honours the cut-out) or give those meshes a per-material normal material with `alphaTest` ported in via `onBeforeCompile`.
- **Normals, MRT route (not verified)**: `WebGLRenderTarget` takes a `count` option for multiple colour attachments [LOCAL `core/RenderTarget.js`], but writing a second output from `MeshStandardMaterial` needs a patched fragment shader per material (`onBeforeCompile`). I did not test it and found no example. It avoids the second geometry pass, but touches every material.
- **Normals from depth** (no extra pass): reconstruct a face normal with `dFdx/dFdy` of view-space position built from the depth buffer. Gives hard geometric creases only (no normal-mapped detail), which suits the primitives and is often *better* for a clean style [INFER].
- Object-ID edges (Texel Splatting's silhouette trick [READ abstract]) are a good alternative: render per-mesh colour IDs; not needed first.

### 5.4 Temporal stability when the camera pans
Method (Holland, t3ssel8r): snap the camera to a texel-sized grid, then shift the presented image back by the snap error [READ] https://davidholland.netlify.app/articles/3d-pixel-art-rendering . Orthographic projection makes this exact; pixel-art pipeline write-ups all use ortho [READ] https://thecodecofficial.github.io/Blog/PixelArt/ . For a perspective camera, snapping is exact only for the plane you size it on [READ abstract] https://arxiv.org/abs/2603.14587 .

```ts
// [MINE] per frame, before post.render(). D = camera distance to the play plane (z=0), fov in radians.
const texel = (2 * D * Math.tan(fov / 2)) / lowH            // world units per low-res px at the play plane
const snapX = Math.round(cam.x / texel) * texel
const snapY = Math.round(cam.y / texel) * texel
camera.position.set(snapX, snapY, D); camera.lookAt(snapX, snapY, 0)
uniforms.uResidual.value.set((cam.x - snapX) / texel, (cam.y - snapY) / texel)   // sample-position shift, 4.1
uniforms.uCamTexels.value.set(Math.round(cam.x / texel), Math.round(cam.y / texel)) // world-anchored dither, 4.3
// derivation: a world point appears at p - S in the render and p - C in the true view, so rendered coords = true coords + (C - S)/texel
```
The existing camera adds random screen shake in world units (`jolt`) [LOCAL `renderer3d.ts`]. For the pixel look, add the shake *before* snapping so it becomes whole-pixel jumps, which is in keeping with the style [INFER].

What still shimmers [INFER]: props off the play plane (foreground fences, background buildings) drift against the grid during pan. Three options: (1) **accept** it for look A and push background layers to low-contrast, fogged tones (cheap, hides most of it); (2) **switch the game camera to orthographic** (exact snapping, true pixel grid; loses perspective parallax, which can be faked by moving background layers at fractional speeds); (3) per-layer separate low-res renders composited (expensive, not recommended). Looks B and C are not pixelated, so they need no snapping at all.

### 5.5 Cost (all [INFER], measure before trusting)
| Pass | Relative cost | Notes |
|---|---|---|
| Low-res render at P=3 | about 1/9 of full-res fragment cost | the biggest single saving; applies to every later pass in look A |
| Normal pre-pass | +1 geometry pass | vertex-bound in a busy scene; mitigate via layers |
| Bloom (`UnrealBloomPass`) | already paid | runs at the composer resolution, so low-res makes it cheaper and the glow larger in screen terms |
| Outline extract | 9-13 texture reads | cheap at low-res |
| Palette + Bayer | 48 palette distance tests | cheap at low-res |
| Hatch/paper composite | 3-5 texture reads | cheap |
| Aniso Kuwahara R=4 | 81 taps x 8 sectors + tensor + blur passes | heaviest; run at 0.5-0.75 scale |

Dynamic resolution, which the repo already plans in `docs/research/rendering.md`, is the fallback lever for everything except the pixel pass (it is already low-res).

## 6. Comparison

| Technique | Look achieved | What it hides / unifies | Cost [INFER] | Risks | Examples |
|---|---|---|---|---|---|
| Low-res render, nearest upscale, snapped camera | chunky visible pixels | texel-density mismatch, noisy scan detail, modelling quality | lowest (cuts pixels) | pixel creep under perspective; thin props vanish; text must be separate | A Short Hike [SNIPPET], Lethal Company [summary], Dead Cells (sprites) [READ] |
| Palette quantise + ordered/blue-noise dither | limited-colour pixel art | wildly different albedos and hues; baked lighting in scans | low | banding on dark gradients; palette must be tuned per biome; dither swims if not world-anchored | Obra Dinn (1-bit) [READ], pixel-art write-ups [READ] |
| Depth+normal outlines | ink or pixel outlines, edge highlights | primitive vs scanned shape language, silhouette clarity | low + normal pre-pass | exposes low-poly primitives; alpha cut-outs break; thickness varies with distance | Sable [READ], t3ssel8r port [READ], Hi-Fi Rush [READ summary] |
| Toon ramp / quantised light | flat banded shading | PBR vs unlit material differences | low | loses the photoreal richness the owner likes in RawConcrete | Dead Cells [READ], Borderlands [SNIPPET], Hi-Fi Rush [READ summary] |
| Kuwahara / anisotropic | oil-paint smoothing, brush-stroke shapes | scan micro-texture, procedural-vs-photo gap | highest | smears small signs, wires, text; shimmer if tensor flickers; kernel too large looks mushy | Heckel demo [READ], Susurrus (Codrops) [SNIPPET https://tympanus.net/codrops/2026/04/24/susurrus-crafting-a-cozy-watercolor-world-with-three-js-and-shaders/] |
| Hatching / sketch + paper | pencil/charcoal graphic-novel | colour mismatch (desaturated), shading differences (re-expressed as strokes) | low-medium | screen-space strokes shimmer on pan; clean lines reveal primitive geometry | Spider-Verse comp [READ], spite/sketch [READ licence], This War of Mine (method unknown) |
| Halftone | printed-comic tone | smooth gradient banding | low | moire when scaled; busy at low contrast | Spider-Verse [READ], `HalftonePass` [LOCAL] |
| Paper / grain / vignette overlay | shared surface noise floor | seams between asset sources | trivial | too strong looks like a filter slapped on | existing `LensShader` [LOCAL] |
| LUT grade | locked palette and mood | colour inconsistency | trivial | clips highlights if baked from sRGB wrongly | `LUTPass` [LOCAL], A Short Hike [SNIPPET] |
| Distance fog + fading lines | depth layering and atmosphere | detail-level mismatch at range | trivial | none significant | Sable [READ], `FogExp2` in repo [LOCAL] |
| DOF / tilt-shift / bloom on sprites (HD-2D) | miniature, cinematic | flat-vs-3D mismatch | medium (DOF) | blur fights pixel crispness; **method unverified** | Octopath Traveler [SNIPPET], Replaced [READ marketing text] |
| CRT / chromatic aberration | retro screen | digital sharpness | trivial | cliche if overused | Signalis (PS1 era) [SNIPPET] |

## 7. Three candidate looks

All three keep real lights, shadows and bloom; they differ in what happens after `OutputPass`. Parameter values are starting points [INFER]; resolutions assume a 1920x1080 canvas.

### Look A, "hi-res crunchy pixel"
Large crisp pixels over lit 3D, limited palette, ink-dark outlines. Closest to the cyberpunk pixel street and RawConcrete's "pixelated" feel.

1. **Camera snap** (5.4): texel at play plane; shake added before snapping. Optionally switch to ortho.
2. **Scene render** into a low-res HDR target, **P = 3** (640x360; use P = 2, 960x540, for "super high res"), `NearestFilter`, `DepthTexture`, MSAA off.
3. **Normal pre-pass** (low-res), noOutline layer for rain, cones, sky, particles.
4. **Bloom**: `UnrealBloomPass` strength 0.35-0.5, radius 0.5, threshold 1.0, at the low-res size (glow reads wide).
5. **Grade (HDR)**: per-biome tint via LUT or `LensShader` colour mix, exposure 1.1.
6. **OutputPass** (ACES, sRGB).
7. **Outline extract + composite** (4.2): silhouette darkens to palette index 0 at 1 low-res px; crease adds +12% lightness; depth K 0.04, normal K 0.35; fade lines with distance beyond about 40 world units.
8. **Palette + dither** (4.3): 24-48 colours, Bayer 8x8 (or blue noise), dither amplitude 0.04-0.07, world-anchored via `uCamTexels`. Starter palette [suggested, my own, not from a source]: neutrals `#07080c #10131b #1a1f2b #262d3c #38415a #525d78 #7a86a0 #aab3c4 #dde2ea`; sodium `#2a1410 #5a2a1c #9a4a22 #d97a2b #f2b050 #ffe08a`; magenta `#3a1040 #7a2a7a #d23fa0 #ff7ac8`; cyan `#0d3a44 #1a7a80 #2fd0c8 #9ff4ea`; green `#1c3a22 #4f8a3a #b4e05a`; red `#5a1018 #c0282c`.
9. **Final upscale** (4.1) with residual shift, then **low-res-cell grain** (amplitude 0.015) and a soft vignette 0.35; no chromatic aberration. HUD on a separate full-res layer.

Material rules: section 3 mandatory; fog colour = a palette blue; no detail normals past 25 units.

### Look B, "graphic-novel grit"
Full resolution, ink lines, hatching in shadow, paper, desaturated world, colour kept only for light sources. TWoM-inspired, not a TWoM copy.

1. **Scene render** full-res HDR, SMAA or MSAA 4, `DepthTexture`.
2. **Depth fog** to a warm grey-brown (colour 0.32, 0.29, 0.26), density a little higher than now.
3. **Normal pre-pass** (full-res or 0.75).
4. **Bloom**: threshold 1.1 so only true lights bloom; strength 0.45.
5. **Grade (HDR)**: desaturate scene to 0.35 before tone mapping, but let emissive and lamp materials keep colour (mask via an `onBeforeCompile` flag or the lamp test in 4.5); split-tone shadows cool, highlights warm.
6. **OutputPass**.
7. **Line extract** (4.2) at full-res, then in 4.5: line width 1.8 px, depth K 0.03, normal K 0.3, wobble 8 fps.
8. **Sketch composite** (4.5): hatch density 9 lines/100 px, thresholds as in the snippet, ink `#141212`, paper `#dbd1b8`, selective colour 0.85 (lamps keep hue).
9. **Paper multiply + grain** (screen-anchored, 512 px tile, amplitude 0.05) and **vignette** 0.5.

Material rules: section 3, plus flatten detail normals; primitives get a subtle noise albedo so clean lines do not make them look like toys.

Risk: ink outlines make primitive geometry more visible, not less. Mitigate with chamfers and mild line fade, and consider turning the crease channel down (silhouette lines only).

### Look C, "painted realism"
Photoreal PBR kept, smoothed into paint, graded and grained.

1. **Scene render** full-res HDR, SMAA.
2. **Bloom** as today (strength 0.4, radius 0.55, threshold 1.4).
3. **OutputPass**.
4. **LUT grade** (`LUTPass`, intensity 0.8): teal shadows, amber highlights, saturation ceiling per section 3.
5. **Structure tensor + blur** at 0.75 res, then **anisotropic Kuwahara** (4.7): R = 3-4, `uQ` 8, `uHard` 8, `uAlpha` 1.0, `uZeta` 0.1, at 0.75 res then bilinear up (the only look where bilinear is right).
6. **Edge darken** (not ink): multiply by `1 - 0.35 * lines` using 4.2.
7. **Canvas/paper overlay** (overlay blend, 6%), **grain** 0.02, vignette 0.4, existing chromatic fringe kept small.

Risk: highest GPU cost; erases small signage and text unless masked; does not hide texel-density or primitive-quality mismatch, it blurs it, so section 3 matters most here.

### Recommendation: **Look A**, with look B's paper/grain rules borrowed
Reasons:
1. **It hides the exact problem the owner fears.** A visible pixel grid plus a fixed palette and a single outline rule collapses scanned PBR, primitives and procedural characters into one surface language; it does not need the assets to be good. Look B's clean lines expose primitives; look C only blurs inconsistency.
2. **Cheapest by a wide margin** (about 1/9 of the pixels at P = 3), so it leaves budget for the real lights and shadows the owner values.
3. **Matches the owner's visual references**: the cyberpunk pixel street, RawConcrete's "pixelated" label, and the rain/fog silhouette scene (fog colour to palette makes silhouettes). TWoM is the odd one out; if its pencil feel matters most, build B instead.
4. **Proven combination**: Dead Cells (low-res, no AA, toon, normal-lit) [READ] and the pixel-art write-ups (low-res, ortho, palette, dither, outlines) [READ]. Their own caveat, flicker, is addressed by the snapping and world-anchored dither in 4.3/5.4.
5. **Modular**: passes 7-9 are independent shader passes, so look B's paper/grain can be added, and a switch between A and B for comparison costs only a different final pass.

Decide first: **orthographic or perspective camera** (5.4). That choice affects every pixel-stability decision.

Build order: material grade (section 3) -> low-res target + nearest upscale + snapping -> outlines -> palette + dither -> grain/vignette. Each step is visible in isolation.

## 8. Could not verify

- **How This War of Mine's charcoal/pencil look is rendered**: no talk, postmortem or blog found. Only the 80.lv interview (all 3D, Liquid Engine) and an unread Medium repost claiming charcoal shaders. TechRaptor's art interview returned 403 and I did not work around it.
- **Frostpunk rendering**: nothing found beyond art-direction quotes and the later move to Unreal.
- **Octopath Traveler's depth of field, tilt-shift and bloom** (HD-2D): Epic's pages returned no text to my fetch; unconfirmed.
- **A Short Hike's actual resolution and palette step**: forum summaries only; Adam Robinson-Yu's GDC talk was not readable.
- **Original Obra Dinn devlog** (TIGSource): forum blocked; blue-noise detail from secondary pages.
- **t3ssel8r's own video and any repository**: not found; Holland's Godot port stands in.
- **Signalis, Eastward, The Last Night, Borderlands, Disco Elysium, Arcane, Kentucky Route Zero, Inside** rendering methods: no developer technical source opened; entries above are snippets or art-direction statements only.
- **Hi-Fi Rush outline technique**: not stated in anything I could open; GDC Vault page needs the talk video.
- **Licence of GarrettGunnell/Post-Processing** (the Acerola Kuwahara source) and of Heckel's article code: not stated on anything I could read. Do not copy their code into the game without checking.
- **All GLSL here** is untested; the Kuwahara orientation sign in particular needs a visual check.
- **MRT normals from standard materials in three r185**: not tested, no example found.
- **Real frame-time numbers**: none measured; section 5.5 is reasoning only.
- **Palette hex values and parameter values** are mine, tuned by nothing.
- **Material-side numeric ranges** (albedo band, texel density) are my suggestions, not sourced.

## 9. Reference links

Grouped; **read** = opened and read, **snippet** = seen only in search results, **blocked** = fetch failed or refused.

### Owner's references (from `docs/REFERENCES.md`, not re-opened here)
- RawConcrete thread (read, JSON): https://discussions.unity.com/t/wip-highly-photorealistic-pixelated-2d-3d-side-scroller-called-rawconcrete-update-10/753551.json
- RawConcrete image: https://europe1.discourse-cdn.com/unity/original/4X/6/a/7/6a7d89a6cbf30d4c70407f12b0b53139d8d4a73e.jpeg
- Cyberpunk pixel-art street image: https://external-preview.redd.it/my-cyberpunk-pixel-art-side-scroller-v0-M3QzcDZqajl1bnZoMYMdp1VeT2f0uDf8BBnUEXGACwiLdsT4-AXmnV_J4ROe.png?width=1080&crop=smart&format=pjpg&auto=webp&s=553ddf2f9c92a3b0c1194ea1f564518d35ce43d2
- Rainy fenced camp image: https://i.redd.it/cva7hwc7q3yh1.jpeg

### This War of Mine / 11 bit / Frostpunk
- 80.lv interview, all-3D, Liquid Engine, A-ha reference (read): https://80.lv/articles/this-war-of-mine-a-game-about-civilians-in-war
- TechRaptor art interview (blocked): https://techraptor.net/content/art-war-mine-interview-11-bit-studios , https://techraptor.net/gaming/interview/art-and-war-mine-interview-11-bit-studios
- Medium interview repost mentioning charcoal shaders (blocked): https://medium.com/@peterwarrior_az/this-war-of-mine-when-games-arent-funny-anymore-2e8b4e5183ac
- VICE interview (snippet): https://www.vice.com/en/article/this-war-of-mine-is-an-almost-too-real-game-of-survival-horror-953/
- NDC 2016 talk, video (snippet): https://www.youtube.com/watch?v=_TLmyadRaho
- Game Developer, IGF interview (snippet): https://www.gamedeveloper.com/design/road-to-the-igf-11bit-studios-i-this-war-of-mine-i-
- Frostpunk engine move (snippet): https://gamedeveloper.com/business/11-bit-makes-moves-to-bring-meaningful-games-into-aaa-realm , https://wnhub.io/news/marketing/item-3890 , https://www.gamingonlinux.com/2025/04/11-bit-studios-are-remaking-the-original-frostpunk-in-unreal-engine-5-with-frostpunk-1886/comment_id=278201
- Frostpunk art notes (snippet): https://techraptor.net/content/how-11-bit-studios-created-society-survival-simulator-frostpunk , https://blog.playstation.com/?p=350772

### Dead Cells, t3ssel8r, 3D-to-pixel pipelines
- Dead Cells, Vasseur deep dive (read): https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-
- Dead Cells backgrounds, Massé (read excerpt): https://gonintendo.com/archives/280488-dead-cells-dev-blog-art-design-deep-dive-giving-back-colors-to-cryptic-worlds
- Dan Moran, normal-mapped sprites video summary (read): https://80.lv/articles/case-study-dead-cells-character-art-pipeline
- JikGuard copy of the Vasseur article (blocked/empty): https://www.jikguard.com/news/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-dead-cells
- Dead Cells lighting summary, third party (read, low authority): https://image-to-pixel-art.pages.dev/blog/dead-cells-pseudo-3d-lighting
- David Holland, 3D pixel art in Godot after t3ssel8r (read): https://davidholland.netlify.app/articles/3d-pixel-art-rendering
- t3ssel8r channel and early video (links from Holland, video not readable): https://www.youtube.com/@t3ssel8r , https://youtu.be/ERA7-I5nPAU , https://imgur.com/gallery/creating-pixel-art-scene-realtime-3d-qwhbHQq
- aarthifical 2D pixel-perfect camera video: https://youtu.be/jguyR4yJb1M ; Holland's 3D adaptation video: https://youtu.be/LQfAGAj9oNQ
- Roystan outline shader: https://roystan.net/articles/outline-shader/ ; toon water: https://roystan.net/articles/toon-water/
- Flexible Toon Shader (Godot): https://github.com/CaptainProton42/FlexibleToonShaderGD
- Rendering pixel art in real time, Godot (read): https://thecodecofficial.github.io/Blog/PixelArt/
- Texel Splatting, perspective-stable 3D pixel art (abstract read): https://arxiv.org/abs/2603.14587 , https://arxiv.org/pdf/2603.14587
- PixelOver 0.8 static 3D devlog (snippet): https://deakcor.itch.io/pixelover/devlog/317241/pixelover-08-static-3d
- Godot Pixel Renderer toolkit (snippet): https://80.lv/articles/free-open-source-3d-to-pixel-art-toolkit-for-godot
- A Short Hike low-res render summaries (snippet): https://itch.io/post/2065934 , https://j-red.github.io/arcadeflight , https://propixelizer.github.io/docs/usage/pixelization , https://medium.com/@elliotbentine/pixelizing-3d-objects-b55ec33328f1
- Slice Back, normal-mapped pixel art in UE4 (snippet): https://atomic-kraken.itch.io/slice-back/devlog/94965/behind-the-scenes-pixel-art-in-unreal-engine-4
- Beyond Authentic Pixel Art in Unreal Engine, talk (snippet): https://www.unrealengine.com/events/unreal-fest-europe-2019/beyond-authentic-pixel-art-in-unreal-engine

### HD-2D, Last Night, Replaced, Eastward, Signalis, Lethal Company
- Octopath Traveler spotlight (blocked/empty): https://www.unrealengine.com/en-US/spotlights/octopath-traveler-s-hd-2d-art-style-and-story-make-for-a-jrpg-dream-come-true , https://www.unrealengine.com/developer-interviews/octopath-traveler-ii-builds-a-bigger-bolder-world-in-its-stunning-hd-2d-style
- The Last Night (snippet): https://80.lv/articles/the-last-night-pixel-art-cyberpunk-open-world , https://oddtales.net/blog , https://medium.com/retronator-magazine/the-future-of-pixel-art-with-the-last-night-a9a4eb61e824 (blocked)
- Replaced, Xbox Wire developer post (read): https://news.xbox.com/en-us/?p=219836
- Replaced director feature (snippet): https://bonus-action.com/feature/replaceds-director-taught-himself-everything-from-scratch-to-make-the-most-beautiful-pixel-art-game-of-the-year-i-just-got-a-keen-eye-on-things/
- Eastward lighting (snippet): https://80.lv/articles/exploring-next-gen-pixel-art-with-real-time-dynamic-lighting , https://www.gamedeveloper.com/art/eastward-s-creators-share-insights-on-making-pixel-art-adventures
- Normal-mapped pixel art, Siege and the Sandfox (snippet): https://gamedeveloper.com/art/adding-depth-to-2d-with-hand-drawn-normal-maps-in-i-the-siege-and-the-sandfox-i-
- Signalis (snippet): https://www.pcgamer.com/arctic-horror-signalis-is-oozing-with-retro-anime-chills , https://www.vice.com/en/article/signalis-game-rose-engine-interview , https://itch.io/devlog/849811/vfx-breakdown-lets-go-retro.amp , https://80.lv/articles/try-this-authentic-ps1-style-rendering-add-on-for-godot
- Lethal Company, Acerola breakdown summary (read): https://80.lv/articles/how-to-achieve-lethal-company-s-graphics-with-unity-hdrp
- Acerola channel: https://www.youtube.com/@Acerola_t

### Return of the Obra Dinn and dithering
- Game Developer, dither-punk (read): https://www.gamedeveloper.com/design/lucas-pope-and-the-rise-of-the-1-bit-dither-punk-aesthetic
- Set Side B, pointer to the TIGSource devlog (read): https://setsideb.com/?p=5672
- Surface-stable fractal dithering page (read): https://runevision.com/tech/dither3d ; repository (MPL-2.0): https://github.com/runevision/Dither3D
- PC Gamer and PlayStation Blog pieces (snippet): https://www.pcgamer.com/lucas-pope-on-the-challenge-of-creating-obra-dinns-1-bit-aesthetic , https://blog.playstation.com/archive/2019/10/17/lucas-pope-on-return-of-the-obra-dinns-art-style
- Alan Zucconi shader showcase (snippet): https://www.alanzucconi.com/?p=10365
- Dithering algorithms primer (snippet): https://datadaily.pages.dev/dithering-algorithms-1bit-graphics

### Painterly, Kuwahara
- Heckel, painterly shaders with Kuwahara in R3F (read): https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders
- Godot anisotropic Kuwahara port (read, MIT per page): https://godotshaders.com/shader/anisotropic-kuwahara-filter/
- Acerola source repo (licence unverified): https://github.com/GarrettGunnell/Post-Processing
- Kyprianidis et al. papers (snippet; first URL 404 to me): https://umsl.edu/~kangh/Papers/kang_cgf09.pdf , https://www.umsl.edu/~kangh/Papers/kang-tpcg2010.pdf
- Susurrus watercolour with three.js (snippet): https://tympanus.net/codrops/2026/04/24/susurrus-crafting-a-cozy-watercolor-world-with-three-js-and-shaders/
- TresJS Kuwahara effect (snippet): https://deploy-preview-1259--postprocessing-tresjs.netlify.app/api/pmndrs/kuwahara
- Blender Kuwahara node (snippet): https://projects.blender.org/blender/blender/pulls/110786
- Godot generalized Kuwahara (snippet): https://godotshaders.com/shader/generalized-kuwahara/

### Outlines, hatching, graphic looks
- Heckel, Moebius-style post-processing in R3F (read): https://blog.maximeheckel.com/posts/moebius-style-post-processing
- Sable, Shedworks GDC 2022 (read): https://www.gamedeveloper.com/marketing/how-shedworks-refined-the-art-of-sable-in-pursuit-of-readability
- Spider-Verse, Foundry Nuke workflow (read): https://colorway.foundry.com/insights/film-tv/graphic-look-in-comp-spiderman
- Spider-Verse SIGGRAPH non-photorealistic compositing (snippet): https://history.siggraph.org/learning/non-photorealistic-compositing-of-the-spider-verse-by-davignon-and-st-clair/
- Hi-Fi Rush toon rendering, 80.lv summary (read): https://80.lv/articles/the-making-of-hi-fi-rush-s-3d-toon-rendering-style ; GDC Vault: https://gdcvault.com/play/1034251/3D-Toon-Rendering-in-Hi
- Borderlands (snippet): https://80.lv/articles/how-borderlands-devs-created-franchise-s-signature-art-style , https://www.tomshardware.com/reviews/gdc-2010-borderlands,2580-3.html , https://www.gamespot.com/articles/behind-borderlands-11th-hour-style-change/1100-6253257/ (blocked)
- Disco Elysium (snippet): https://mcvuk.com/business-news/we-knew-immediately-that-we-needed-to-make-a-game-with-a-striking-and-unique-look-to-accompany-the-writing-a-look-that-would-balance-the-mundane-with-the-unfamiliar-and-strange-the-art/ , https://rpgcodex.net/article.php?id=12760
- spite/sketch (MIT): https://github.com/spite/sketch ; demo https://spite.github.io/sketch/post-cross-hatch-i ; cross-hatching: https://clicktorelease.com/code/cross-hatching
- Moebius shader write-ups (snippet): https://dmtyler.github.io/2024/11/03/Moebius-1 , https://godotshaders.com/?p=8836 , https://80.lv/articles/have-a-look-at-this-bright-godot-shader-inspired-by-sable

### three.js and libraries
- `RenderPixelatedPass` source (read, MIT): https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/postprocessing/RenderPixelatedPass.js (dev is 0.187; the local 0.185.1 copy matches)
- three.js licence (MIT): https://raw.githubusercontent.com/mrdoob/three.js/dev/LICENSE
- three.js post-processing manual (snippet): https://threejs.org/manual/en/post-processing
- pmndrs/postprocessing (Zlib, read package.json): https://github.com/pmndrs/postprocessing , https://raw.githubusercontent.com/pmndrs/postprocessing/main/package.json
- Pixelation / dithering tools for Unity, reference only (snippet): https://github.com/NullTale/DitherFx , https://discussions.unity.com/t/free-retro-inspired-dithering-post-process/834592

### Local files used
- `node_modules/three/examples/jsm/postprocessing/{RenderPixelatedPass,OutputPass,EffectComposer,LUTPass}.js`, `node_modules/three/examples/jsm/shaders/OutputShader.js`, `node_modules/three/src/core/RenderTarget.js`, `node_modules/three/src/renderers/shaders/ShaderLib/meshnormal.glsl.js`, `ShaderChunk/map_fragment.glsl.js`
- `src/render3d/post.ts`, `src/render3d/renderer3d.ts`, `docs/REFERENCES.md`, `docs/research/rendering.md`
