# This War of Mine (11 bit studios, 2014): reference research

Prepared for the Orcfall Command side-view cutaway infiltration game. Research date 2026-11-10. Scope: This War of Mine (TWoM), its DLC (The Little Ones, Stories, War Child, Forget Celebrations) and the Final Cut update (14 Nov 2019).

How to read the evidence labels used below:
- **[read]** I opened the page and read the text.
- **[seen]** I downloaded the image and looked at it.
- **[snippet]** only a search-result snippet, not opened.
- **[player/guide]** community or fan-guide claim, not from the developers.

Key finding up front: the developers have never published a technical breakdown of the sketch shader. What exists is (a) the 80.lv interview confirming "everything is 3D, only the far background is flat, camera locked parallel to the view", in-house Liquid Engine; (b) the Game Developer IGF interview stating the aim "time-lapse pencil-like sketch", references to 80s/90s music videos with hand-drawn cels over footage, and Banksy for colour and mood; (c) my own reading of the screenshots. Anything about how the hatching is implemented is inference and is labelled so.

## 1. Annotated image list (44 images, all viewed by me)

All URLs are Steam store CDN screenshots (1920x1080) of the base game or DLC pages, fetched through the Steam store API (`store.steampowered.com/api/appdetails?appids=...`). I downloaded and looked at each one (resized) and the descriptions below are from what I saw, not from captions. None were copied into the repository. Group A = base game store page (app 282070). Group B = DLC store pages (Stories season pass 750031 / episodes 750030, 974610, 1125630; The Little Ones 481090; Forget Celebrations 3323700; War Child 348040). They are promotional screenshots, so they may be cleaner than average play.

### Group A: base game (https://store.steampowered.com/app/282070/This_War_of_Mine/)

**A1.** <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/282070/ss_9a8e8724d4bc5a1ffc25b5aa52ed0400a856db6b.1920x1080.jpg>  
Base game, Day 1, shelter (a mansard-roofed wooden house in snow). The canonical dolls'-house cutaway: four-plus rooms on three storeys plus attic, front wall simply absent, floors and party walls drawn as thick near-black slabs, so the building reads as a lit diorama against a pale hatched winter sky. Stairs (diagonal, with railing) in the cellar, a landing/balcony with railing in the middle room, a ladder to the attic. Room dressing: hanging bulbs, a washing machine, shelves, a cistern/boiler, planks, a lattice window in the gable, snow on the roof. Round icon discs float over every interactable (door, hand = search/take, magnifier, stairs-up arrow, house-and-arrow = go to different floor, workbench/craft icons). One lone character walks on the central balcony, tiny relative to the room (about one third of storey height). Background: transmission pole, wire, frozen pines and a crane silhouette in hatched grey parallax; front-left foreground fence/car silhouette. HUD: day/clock/temperature plate top-left as torn paper strip, black menu slabs ('Our things', 'End day'), character card as a Polaroid bottom-right.

**A2.** <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/282070/ss_2aebf3f26978369655c9d4316e627b084fa0a69e.1920x1080.jpg>  
Base game, a four-storey tenement pair seen from the courtyard side, night with fire. Two cutaway wings flank a central 'uncut' facade of the courtyard tower (arched windows, brick, fire escapes drawn on the outside, round turrets). Room interiors are cool grey; fires and rubble throw warm orange/pink on the right-hand wing (selective warm light). Stairwells with zig-zag railings stacked on each storey, ladders to the attic, collapsed roof beams and slanting debris, a rubble heap filling the courtyard base. The ground-floor basement darkens to black ('not yet seen' area) under the whole building. Shows how a very tall cutaway is composed: black floor slabs form a regular horizontal rhythm, vertical black party walls break it into rooms, and the background facade supplies depth.

**A3.** <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/282070/ss_b65e44e1c5aa6ac2ea2d2b8f0eb94ff55c3cbd75.1920x1080.jpg>  
Base game, Simple Workshop crafting dialog. UI as torn-paper/pinned-notice objects over a blurred, desaturated game view: a chalkboard-black panel with white category headers (Household Items, Workshops, Consumables), square corner-bracket slots with white pictograms, one selected item in orange outlined with the same bracket, a detail panel with a drop-shadowed white frame, component counters (15/21 etc.), build time ('1.0 h'), and 'Make'/'Exit' on taped paper tabs. A wrench and a nail are pinned as decoration. Orange is the single UI accent colour. Portrait of the crafting survivor is a photo pasted at the top-left.

**A4.** <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/282070/ss_60caf1baf885322cd45c0f6a84a19b112316b04f.1920x1080.jpg>  
Base game, Night 3 scavenging in a multi-storey shop/flat block. Cutaway of four floors: top two floors lit by single pendant bulbs in green-white; mid-level bakery counter (a warm lit room on the left, a pale blue-green kitchen-like tone); basement full of sandbags. Speech/tooltip bubble: 'This door is boarded up.' A door at ground level with diagonal planks nailed across it (barricade) and a heavy wooden table. External stair block at right with railings. Two NPC figures sit/stand in an upstairs room (residents, visible while the player's character is outside their room; their room is lit). The night HUD: 'Backpack', 'Run to exit', 'Scavenge' (orange, active) and the equipped weapon ('Fists'), plus a bullets counter. Rooms the player has not entered are dimmer, and room boundaries are black lines. A character Polaroid at bottom right lists status effects in orange ('Slept poorly', 'Hungry').

**A5.** <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/282070/ss_35f5bbc7b4bcdf0f48c93d055705594ea4749336.1920x1080.jpg>  
Base game, a city street, dusk with fire, a pure 'exterior' background piece with a rubble-strewn road, burning car, bare tree silhouette in front-left (foreground silhouette, almost black), buildings to the right with arch and balcony cut away only at the ground arcade. Smoke/haze gradient from rose/brown at the vanishing point to near-black at the margins; vertical 'HOTEL' sign half-seen in smoke; wall-mounted lamps in the arcade glow warm. Strong atmospheric perspective: three or four layers (foreground tree, midground facades, car, distant glow). Rain drawn as thin diagonal hatching over everything.

**A6.** <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/282070/ss_69d59279fc6ac19a5c30a8209d753b1e8728fa40.1920x1080.jpg>  
Base game, character intro screen: three desaturated, high-contrast portrait photos (real faces, scanned from the dev team) as rotated Polaroids with scratch textures and torn white borders over a dark blurred game view; type is condensed white sans on dark with a short biography. Shows the 'photograph/dossier' language of the UI.

**A7.** <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/282070/ss_d17fe787849891db9b1c7f5c0d1eb079affc6f0f.1920x1080.jpg>  
Base game, Day 2 in a large three-room-wide shelter with cellar. Clean example of mixed interior lighting: a lit kitchen/workshop room in centre with fridge and cooker (cool white), while neighbouring rooms are in grey gloom; a long dark cellar with pallets, crates (the only pink/red accent) and a sagging pallet bed; 'ladder' on the cellar wall and a ladder through a ceiling hatch above the middle room; a wooden balcony/veranda on the left with railings; a hole in the roof at top-right with a charred beam. Speech bubble above the pregnant survivor Livia. Many round door icons everywhere (white disc with a door glyph), a progress ring (orange) at the top shows a timed action. Black slabs separate floors; dark basement strip at the bottom.

**A8.** <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/282070/ss_64243910e65df2963f953baa9d6056283205ea6f.1920x1080.jpg>  
Base game, forest/outskirts location (night, moonlight). A wooded ravine with a stone arch bridge. Cold blue-grey palette with a bright moon-halo behind the pines; heavy hatching in the sky and rock faces; the ground is a flat black silhouette strip that implies a cutaway edge even in an outdoor level. Layers: foreground tree, midground bridge and rock, background pines. A tiny character figure on the right-hand rock gives scale.

**A9.** <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/282070/ss_03f1ffbb3b36999da7ab1305c4a2b6f54b057478.1920x1080.jpg>  
Base game, ending/death card ('We lost Katia / If only we'd had some antibiotics'): a single Polaroid portrait with closed eyes, scratched, over a heavily blurred and darkened game view with red tint. Demonstrates the game's end-card grammar: photo + short, quiet line of text.

**A10.** <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/282070/ss_095feca4f334b0740d52bb3a58fca6d7c624265e.1920x1080.jpg>  
Base game, Night 2 scavenging in a multi-level shop/mall shell. A building with a big skewed roof beam crashing down diagonally into the middle (lit pink/red as the single warm accent), upper floor open to the weather, ground floor with shopping trolleys and stairs, a basement with a mattress and candles. Two NPCs talk on the stairs ('Igor, you take the upstairs and the roof'): residents with dialogue that gives away their patrol plan. Concentric dot icons (the 'investigate' marks) are placed on lootable objects. A hostile walking silhouette stands outside left. Right-hand rooms are partially unlit, showing the 'seen / unseen' split.

**A11.** <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/282070/ss_28b7b1cd18ad4d4be25fef898a359445c0fcc9b2.1920x1080.jpg>  
Base game, a grand ruined mansion/theatre: three-storey cutaway with a central double-height hall, ruined grand staircase with boxes tumbling down it, arched windows lit warm amber at the top, ornamental alcove (statue niche) in the back wall, ladders and half-collapsed stairs; right-hand side has separate rooms with doors and railings. Lower floor rubble heap. Speech bubble: 'I hope the war ends before you're born. You will have no memories of all this.' Shows how a vertical void (hall) connects floors, rubble as a visual and gameplay obstacle, strongly directional window light through dust.

**A12.** <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/282070/ss_93b1ffea395ccc8d6f16dbd5d003efbb66f2f04e.1920x1080.jpg>  
Base game, a survivor's bio dossier (Livia 'Good Cook', trait tag 'ABSTINENT' in orange) as a torn white paper card with rough brush edges, grainy photo cropped on the right, handwritten-looking short bio, close X at top-right.

### Group B: DLC store pages

**B1.** [Forget Celebrations (3323700)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3323700/ss_90678ae85d199a3fe2e639035c516ab6ac9a695a.1920x1080.jpg>  
Forget Celebrations DLC, Day 1: three-floor ruin with a large blast hole at the top-right wall (rubble, a spider-web cracked wall), a character conversation, ruined interior with chandelier, picture frames, balustrade and cellar stair. Rich 'lived-in then wrecked' dressing: wallpaper peeling, scattered chairs, a standing lamp, light shafts through the hole. A thin brown hatch shadow under every floor.

**B2.** [Forget Celebrations (3323700)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3323700/ss_b8ea8f9e4fb90172b73777392838f89c999b55ee.1920x1080.jpg>  
Forget Celebrations: Katia's diary card — orange handwritten text on a black panel on a torn paper card with her photo (eye bandaged). The card pattern repeats for every survivor (portrait, trait line, free text).

**B3.** [Forget Celebrations (3323700)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3323700/ss_f58a48d1956108546fc24458ac204669d44cd40b.1920x1080.jpg>  
Forget Celebrations, Night 6 scavenging. Dark ruin: only the part near the player is lit, a ladder between floors, a beam of cold window light, rubble, a cracked floor. White circle icons on interactables, 'Backpack/Run to exit/Scavenge' HUD. Distant rooms fade to near black.

**B4.** [Forget Celebrations (3323700)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3323700/ss_f73bc47d581c22667b8c6a89076f38187e4a4610.1920x1080.jpg>  
Forget Celebrations: 'Book materials' notebook UI — a binder with paper clips, a list of found documents ('Not Found' slots greyed), a photo on the right, a handwritten-font paragraph. Shows collectible-lore UI language.

**B5.** [Forget Celebrations (3323700)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3323700/ss_580b8f546ea2745502dbd5e797468c9e15b78e69.1920x1080.jpg>  
Forget Celebrations, Night 18 with snowfall: a tram (red, the only strong colour) at a stop in a snowy night street; thin overhead wires, cable bundles; below it a dark basement strip with barrels. Falling snow rendered as streaks, tram interior lit warm.

**B6.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_91feeb58ae1474b8b42e66f8b10e8c78adcdf3a7.1920x1080.jpg>  
Stories menu: 'Choose new story' with three Polaroids (Father's Promise, The Last Broadcast, Fading Embers) over a smoky sepia skyline with burning chimneys. Titling in white paper-cut stencil letters with an orange sub-tag.

**B7.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_df479228edc6f2302780419cd34e8030b7578970.1920x1080.jpg>  
Stories DLC: a burning theatre/cinema interior in warm orange/sepia monochrome — two storeys, a wrecked projector/rafter falling through flames, red cinema seats on the left, hanging lamps, a stairwell with railing. Fire is the light source. A single crouching character.

**B8.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_8fba7899315cd47da3d6c715ac88421dbb3b4c5d.1920x1080.jpg>  
Stories DLC: an artist's workshop/squat in sepia — wide ground-floor room with an easel, hanging fabrics, crates, rafter beams and hanging bulbs, a warm fire/stove glow centre, skylight slits, dark flooded basement reflected below (mirror-like reflection under the floor). Characters tiny.

**B9.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_27602865240013578f28067ff2ff9eea790289e9.1920x1080.jpg>  
Stories DLC: a wide multi-room library/apartment cutaway, warm sepia: bookshelves, a bed, a desk, a radio/ record player, a kitchen with fridge and chequered floor, an arched window room at top-right, stair down. Speech bubble 'We can't keep this a secret. People have a right to know.' Lived-in clutter density is high: small props on every shelf.

**B10.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_46742200ea45ddc43f8efbb1ca3c7b90aa2e460e.1920x1080.jpg>  
Stories DLC: a story-choice screen ('Esma's Dilemma') — two charcoal-style vignette illustrations (soldier silhouette in flames, a pharmacy sign) beside orange-headlined narrative text and a choice button. Illustration style = rough grey hatching with spot-colour glow.

**B11.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_1212231edadbc99142e9423982d154317b49a910.1920x1080.jpg>  
Stories DLC: the same ruined street as base image 4 (HOTEL sign, burning car, arcade).

**B12.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_9b3c704891a9d26079ab82105c97014a650d9953.1920x1080.jpg>  
Stories DLC: night exterior — a moonlit town with a tall pointed corner tower and a lit 'BAR' sign, a garage/carport with a car, tree silhouettes, stairs rising right, green-grey palette with yellow lit windows; rain hatching. A character at a sign post.

**B13.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_681feaeb7e058802f04c005166b37908cdd5e0bf.1920x1080.jpg>  
Stories DLC (The Last Broadcast): the radio broadcast UI — a vintage mixing desk and microphone in photographic grey, a paper notepad of intercepted messages, a 'Recent news' column with two tagged items (one yellow = story-related), orange 'Broadcast' button.

**B14.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_a65b6ae33dc46caa8968c07e6faea227b59610c8.1920x1080.jpg>  
Stories DLC: a family house cutaway with a tall wooden scaffolding on the left foreground, three storeys: warm living room with sofa, chandelier, patterned curtains; upper floor with a clock and cabinets; a damaged cellar with a bathtub-like fixture and rubble. Speech bubble: 'Why don't you take care of him while daddy takes care of you.' Warm interior against cool bare-tree exterior.

**B15.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_1da49851e0599aaf950b38b39367e585e986e982.1920x1080.jpg>  
Stories DLC: a suburban night street. A two-storey house sliced with the roof left intact, a cellar stair, a ladder, red/pink torch beam from a character, a parked car on the road lit by a streetlamp, bare trees and moon-glow clouds. Exterior houses behind are uncut and static.

**B16.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_e5de049e859a1d4e66cb460de51061738c910703.1920x1080.jpg>  
Stories DLC: burned city block as a rubble field — flat black foreground plank walkway, a tank barrel silhouette, street sign for 'TOY STORE' knocked over, twisted girders and fires in the distance. Speech bubble: 'Amelia's favourite store. Another place that is gone forever.'

**B17.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_1971782f6887810ec4755d3fbbe86b9435f9fb7c.1920x1080.jpg>  
Stories DLC: a street junction with a tram on the left, burning buildings, a row of facades at the right with one building cut away (two lit rooms stacked), street lamps. Dense atmosphere: smoke, falling ash, crooked wires.

**B18.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_cddd43d113d7282a3ef18a87fa245707a226b6b9.1920x1080.jpg>  
Stories DLC: a graveyard/chapel exterior at night: carved crypts, a gate, a parked van, a dog, a character; green-teal fog, bare trees, church window glow. Speech: 'I've never thought I will see something like this in my city...'

**B19.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_b50f730871280de663d9b19fdeab6ca3b8754fa3.1920x1080.jpg>  
Stories DLC (same composition as base image 1): the courtyard-tenement night shot, rendered lighter and more contrasted: silver-white sky, red/pink fires, many ladders and zigzag stairs.

**B20.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_6d8dc65e12a0d681be71a9644f2b70fdb771a387.1920x1080.jpg>  
Stories DLC (Fading Embers): a snow-covered underpass/warehouse street: an overpass in the background, snow mounds, concrete blocks; interior of a depot on the right with a bullseye-like red disc sign, a cart, stacked crates, a basement below. Speech bubble: 'The word on the street is that you help with... keeping things hidden.'

**B21.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_3e406260734bb9fd8bd5f0e6cd478d96213d961a.1920x1080.jpg>  
Stories DLC (museum): 'Main collection' UI — a list of exhibits and a card for a framed painting with photo and 'Make fuel' (burn it) action. Moral-choice UI as a paper catalogue.

**B22.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_9024d7a0dad9a27c10b916d0010557b68c0bf091.1920x1080.jpg>  
Stories DLC: a military checkpoint at night — blue-black silhouettes of soldiers with a truck's headlights blooming through haze, snow-laden pines and a bridge-like barrier, nearly all shapes in silhouette; shows pure silhouette staging with a single lit prop.

**B23.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_379d3a388edd93685f0fd74b4f216de510ae5b8c.1920x1080.jpg>  
Stories DLC: a ruined domed hall (museum or station): large dark volume, shafts of dusty light from broken ceiling windows, a collapsed floor over a lower level, rubble piles, a character with a torch beam in the dark. Biggest example of 'big dark room with one pool of light'.

**B24.** [Stories season pass (750031)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/750031/ss_ff253c73c92e15d41b0aa1222e43fa35719e2892.1920x1080.jpg>  
Stories DLC (Day 5, 0 degrees C): the Museum Pogorin frontage — a half-collapsed warehouse-like building with its roof sign visible, burning fire in the middle storey, ladders, a small 'exhibit' interior bottom-left, with orange ring timers over two work-in-progress interactables. Day HUD shown (not night): characters can interact inside.

**B25.** [The Little Ones (481090)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/481090/ss_38b9be5a14a132de7a79f8774e04fcff79ee5db3.1920x1080.jpg>  
The Little Ones DLC: shelter cutaway at day: top-floor loft with a bed and chandelier, a mid-floor with a cracked window and bicycle, a ladder, cellar with workbench; child character in red coat (the only red on screen) talks ('Itsy bitsy spider climbed up the waterspout'). Hanging bulbs, bay window light shafts. Character Polaroid for Arica 'Sneaks Quietly' at bottom right.

**B26.** [The Little Ones (481090)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/481090/ss_e8335cd0ac8303ec34aeb8eb917ba8f920a8179a.1920x1080.jpg>  
The Little Ones: Ivano's diary card (child survivor), same torn-paper dossier with orange handwritten day entries.

**B27.** [The Little Ones (481090)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/481090/ss_f5c8a39acb250a36573fd42dccd9160ee93aaeb1.1920x1080.jpg>  
The Little Ones, Day 1: cutaway of a ruined building with a spotlit room (a straight beam from a hole in the ceiling lighting a basement room), ladders between floors, the child Kalina at the centre ('Do you wanna play a clapping game?'), the many icon types visible: door, hand, up arrow, house-and-arrow, ladder.

**B28.** [The Little Ones (481090)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/481090/ss_0f12bf54728e5d26ffa797aaac6486a365641f25.1920x1080.jpg>  
The Little Ones: Kalina's card with a beanie-clad child portrait; diary entries in orange.

**B29.** [The Little Ones (481090)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/481090/ss_7040cac1feccabb6f4fad67eeb48a44db6cd1f4c.1920x1080.jpg>  
The Little Ones, Day 1: a cottage cut in half — a pitched roof with a TV antenna silhouetted on the sky, an attic room with a washing line, window light cones, lock icon (a padlocked door), hand icons on objects, and a seated old man (Henrik) and child. Lit windows read as soft white blocks.

**B30.** [The Last Broadcast (974610)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/974610/ss_28f4c3855dc0d4b523b0edd9715a995e64334f5b.1920x1080.jpg>  
The Last Broadcast (Steam store): the same moonlit forest ravine and arch bridge as base image 7.

**B31.** [War Child charity (348040)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/348040/ss_0d941e797eddccd646f613b31c808763f18b14f9.1920x1080.jpg>  
War Child charity DLC: a 'street art' gallery on a bullet-pocked concrete wall (grey mortar, pits from bullets), with unlocked artwork thumbnails glowing white and locked ones as pale ghosts; handwritten thank-you text on the wall.

**B32.** [War Child charity (348040)] <https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/348040/ss_d73cbc6118a2e2d3c7c46070ff4d488e260caeb8.1920x1080.jpg>  
War Child DLC: a single piece of street art (an ink-drawn face by an Italian artist) on brick wall in the paper-frame card style, tagged 'Found on Abandoned Cottage'; shows how art is pinned to the in-world location.

Not viewed (listed so they are not lost): 4 further War Child / soundtrack screenshots in `dlcu.txt` indices 32-35 were downloaded but not examined, so they are not described.

## 2. How the look was made (with sources)

### 2.1 Confirmed by developers
1. **Everything is 3D, camera is locked to a side view.** Pawel Miechowski (11 bit): "everything in This War of Mine is 3D. It just pretends it's a 2D side-scrolling game... All the people, buildings, environment, it is all 3-dimensional but the camera is tied to this view and moves left/right and up/down with zooming in and out possible... Just the far background texture is flat." He calls it "more like 2.5D". [read] 80.lv, 29 Jan 2019, https://80.lv/articles/this-war-of-mine-a-game-about-civilians-in-war
2. **Engine: in-house "Liquid Engine"**, built for Anomaly: Warzone Earth and evolved project to project; a 2.0 rewrite was in progress in 2019. Benefit: reliable and easy to adapt to platforms; drawback: "may lack some rapid-development goodies". Biggest tool added for TWoM was a Behaviour Tree Editor, since all AI uses behaviour trees (AI designer's trees were "about 30 LCD screens wide"). [read] 80.lv above and Game Developer, "Road to the IGF: 11bit studios' This War of Mine", https://gamedeveloper.com/design/road-to-the-igf-11bit-studios-i-this-war-of-mine-i-
3. **Why side view with a sliced building.** First-person fails for a group where you switch survivors; top-down fails for multi-storey living; side-scroll "turned out to be the best and natural for playing a group of people in a ruined city". Also "a bit sim-like feel, but that was our intention too". [read] 80.lv.
4. **Visual intent.** Art director Przemysław Marszał: from the first minutes they knew super-realistic art was not an option; "Our game is like a novel, and we wanted to have this novel feel on the visual side". Two inspirations: 80s/90s music videos ("experiments with hand drawn cels over movie footage"), and "after some research, I think we succeeded in achieving this time-lapse pencil-like sketch"; for colour and mood, the works of Banksy. [read] Game Developer IGF interview. Miechowski adds that the palette, hand-drawn style and "old sepia photography" feel were fused by Marszał into "something that could be captured on an old black and white photography, like photos from war from 20 or 50 years ago", and that Marszał looked at a-ha's "Take On Me" video as the model for mixing reality with a hand-drawn world. [read] 80.lv.
5. **Characters are scanned real people.** The team built a home-made turntable rig (a person in T-pose on a rotating wooden platform, several cameras, photogrammetry software), got messy meshes and badly textured models that 3D artists cleaned up; an animator then made walk/run/eat/sleep/fight and "hundreds of other activities". The same people were photographed for the Polaroid portraits ("raw, dirty, footage taken with a camera. There's no clean-up"). They deliberately avoided hi-poly characters and voice-over as wasted effort. [read] 80.lv and Game Developer IGF.
6. **Prototype in about two months** with basic shelter, life and early scavenge locations; development under two years. [read] Game Developer IGF.
7. **Final Cut (14 Nov 2019)**: free update; remastered versions of all classic levels, 4K UI adjustments, 21:9 support, Stories locations folded into the base game, plus a "vanilla" 2014 version selectable via the Steam beta tab. No technical details published in the sources I read. [read] PC Gamer news, https://pcgamer.com/this-war-of-mines-final-update-adds-a-new-character-scenario-and-remastered-graphics ; Steam store text [read] https://store.steampowered.com/api/appdetails?appids=282070

### 2.2 My inference from screenshots (not confirmed by developers)
These are what I can see in the images and are labelled as inference.
- **Hatching is screen-aligned and applied to everything, including the sky and UI backdrops.** The rain in A1, A5, B15 is a layer of thin diagonal strokes that does not move with the geometry, and the sky in A1/A8 shows the same stroke direction as the walls. That suggests a full-screen post-process overlay (strokes whose density follows luminance) rather than per-mesh hatch textures. [seen]
- **Lighting is baked-looking plus a few dynamic lights.** Rooms have a flat base tone from a single colour grade, then local pools from hanging bulbs, windows and fires, with soft falloff and visible light shafts (A11, B1 world images). [seen]
- **Near-monochrome grade with spot colour.** Almost all pixels are grey; colour appears only where it means something: fire/pink-orange glow, a red child's coat (B25), red trams (B5), orange UI accent, the red noise rings. [seen]
- **Heavy dark vignette and black "unseen" areas.** Cutaway edges and unseen rooms fall to near-black (A4 bottom basement, A1 ground floor). [seen]
- **Tiny characters with a hand-animated scale.** Characters are about one-third of a storey high. [seen]
- **Parallax:** the near-uncut facade in the middle of A2 and foreground tree silhouettes in A5/A8 show depth layers; because the 80.lv piece says the camera is locked parallel to the view, the depth impression comes from layering 3D set dressing (perspective-correct facades and silhouettes) rather than a moving camera. [inference]

### 2.3 What I could not find
No GDC/Digital Dragons talk on the shader exists in what I could reach. The GDC 2019 talk "Why Make Games? Lessons from 'Frostpunk' and 'This War Of Mine'" (Marszał and Drozdowski) is about culture and process; I read the GDC Vault abstract only, not the video. [read] https://gdcvault.com/play/1025741. The Designer Notes podcast episode with the same two is audio only; no transcript. [read] https://www.designer-notes.com/?p=1598

## 3. Structure and mechanics

### 3.1 Two-phase loop and how the building is used
- **Day:** snipers outside force you to stay in the shelter (a multi-storey, ruined house shown as a cutaway). You craft, cook, heal, trade and manage mood. At **night** one survivor scavenges a location; the shelter stays visible via a different mode. [read] Steam store text; Wikipedia, https://en.wikipedia.org/api/rest_v1/page/html/This_War_of_Mine
- **Shelter layout.** In A1 and B7, the shelter is 3 storeys + attic/cellar with one stair/ladder connecting each pair of floors; rooms are 1-3 "screens" wide and each one has a function (bedroom, kitchen, workshop). Houses are sliced vertically; the missing wall is not drawn at all, floors/walls are thick dark mass. [seen]
- **Vertical links.** Visible in the images: diagonal stairs with railings (A1, A3, A6, A7, A10), ladders (A1 attic, A7 hatch, B27/B26 cellar), open void/hall (A11), collapsed stairs with rubble (A11), exterior stair blocks (A3), and "house + arrow" icons to move between floors/exits. [seen]
- **Obstacles inside buildings.** Boarded-up doors ("This door is boarded up", A4), rubble that needs a tool, locked doors (padlock icon, B29), sandbag-filled basement (A4). Per the Gamepressure guide: you need crowbars, saws or lockpicks (or a shovel/hatchet) for some of these; items like saw blades and lockpicks are single-use while hatchets, crowbars and shovels double as weapons. [guide] https://gamesfuze.com/guides/this-war-of-mine-where-to-scavenge/ and https://www.gamepressure.com/thiswarofmine/equipment-slection-and-location-types/z06d3c
- **Hiding spots.** "Hiding in shadows in specific places (there are specific action symbols above them)" - i.e. alcoves/corners with their own icon. [guide] Gamepressure good-picker page. Player-reported caveat: hiding does nothing once an enemy has already seen you. [player] Steam thread https://steamcommunity.com/app/282070/discussions/0/1368380934251647511

### 3.2 Stealth and noise (night scavenging)
- PC Gamer review: scavenging "inspiration has been taken from Mark of the Ninja. Everything outside line of sight is enveloped in a fog... Walking is silent but slow, while running comes at the risk of making noise, denoted by emanating circles of sound. Enemies emit these same tells, as do rats scurrying around. NPCs that hear the sounds or spot you in their line of sight will investigate. The defenseless cower, some propose a barter, others respond with deadly force." [read] https://www.pcgamer.com/this-war-of-mine-review
- Gamepressure: "only the nearest surroundings will be completely visible"; avoid running; look through the **keyhole** at a door before entering; "red, pulsating circles" show enemies through walls but the system works both ways. Searching a container while its owner sees you is flagged by a changed icon as **theft**; old residents flee upstairs and beg, armed ones fight. [guide] https://www.gamepressure.com/thiswarofmine/good-picker-tactic-searching-through-location/z16d3d
- Player forum: red indicators are noise through walls; most noise travels about one storey up or down; looting makes a small noise; open doors alert residents; stealth-kill from behind works only for some characters, always from an alcove; a hatchet is loud and a knife quiet; enemies can still shoot you through gaps like stairs if visible; a game-over card ("You are caught") is not stated. [player] same Steam thread. Treat as anecdote.
- Time limit: reaching the exit after 5 AM means the survivor stays out and may be wounded or killed; inventory is a hard cap, so locations get revisited; a percentage of loot taken is shown next to each location name. [guide] gamesfuze above.
- Characters differ in sneak/run/carry stats (Boris/Marko carry more, Arica sneaks, Pavle runs fast). [guide] gamesfuze.

### 3.3 Interaction model
- Every interactable has a round icon disc above it (door, hand = search/take, magnifier, stairs arrow, workbench, ladder, lock). One click; long actions show a progress ring (orange) over the object (A7, B24). Dialogue is in small speech bubbles above heads. [seen]
- HUD: paper strip with day, clock, temperature, and bullets counter at night; menu slabs 'Backpack', 'Run to exit', 'Scavenge' + current weapon; survivor card as Polaroid with conditions in orange. [seen]

### 3.4 Locations (what makes each distinct)
From the Gamepressure location guide [guide] https://www.gamepressure.com/thiswarofmine/equipment-slection-and-location-types/z06d3c unless marked.
| Location | Distinctive trait |
|---|---|
| Abandoned Cottage | Safe from day one, small loot, no one home |
| Quiet House | Two elderly residents; stealing makes them beg and flee upstairs |
| Ruined Villa | Building materials; random occupant: couple or soldiers |
| Decrepit Squat | Homeless man; help him and he reveals hidden storage |
| Shelled School | Barred corridors; homeless group or soldiers; two scenarios |
| City Hospital | Friendly; free bandaging, private and stray lockers, a trading doctor |
| Small Apartment Building | Armed hostile group, damaged armour and rifle |
| Supermarket | Very rich in supplies; assault scene or three armed people who allow looting |
| Sniper Junction | Open crossing under a sniper; hide behind obstacles and sprint between shots; sewer route to unlock a passage |
| St. Mary's Church | Priest and survivors; locked deeper parts; tunnel route; sometimes bandits |
| Garage | Father and son with a gun; trade medicine for tools |
| Hotel | Three variants incl. trading with an armed man for alcohol |
| Shelled Cottage / Ruined Block of Flats | Safe, need crowbar / saw |
| Military Outpost | Soldiers tolerate you until you enter the complex; killing all unlocks advanced weapons |
| Brothel | Neutral bandits, locked basement with prisoners |
| Construction Site | Changes on second visit: snipers then abandoned, basement flooded then dry |
| Central Square | Trading hub, many NPCs |
The ruined block of flats is described as one of the first locations newer players visit because of low danger (search snippet only, from the wiki, not opened): https://thiswarofmine.gamepedia.com/Ruined_Block_Of_Flats [snippet]. Final Cut folded the Stories DLC locations into every scenario (museum, tram yard, cinema, graveyard, checkpoint, as visible in B-group images). [read/seen]

### 3.5 Level variability
Locations are randomly selected per world generation; there are "different layers of randomness" (survivor sets, timelines, events, price changes, visitors) and a pre-set winter schedule. [read] Game Developer IGF interview.

## 4. Reception

**Praise** (all [read] unless noted)
- Atmosphere, restraint and slow pace: PC Gamer calls it "deftly designed stealth survival and resource management. Important, but unrelentingly cruel", and notes the slow, deliberate pacing "accentuates the languishing, oppressive atmosphere". https://www.pcgamer.com/this-war-of-mine-review
- Emotional realism: Vice's Mike Diver ("about as real as survival horror... can get"); the game covered production costs in two days according to Vice. https://www.vice.com/en/article/this-war-of-mine-is-an-almost-too-real-game-of-survival-horror-953/
- Wikipedia summarises: iOS "universal acclaim", PC/console "generally favorable" on Metacritic; 9+ million units sold; reviews cited include The Digital Fix 9/10, Digital Spy 4/5, Metro UK 7/10. https://en.wikipedia.org/api/rest_v1/page/html/This_War_of_Mine
- Visual style, via Critic.co.nz as seen in a snippet only: "rough charcoal-style sketchiness"; "nightmare-like scenes" [snippet].

**Criticism**
- PC Gamer: "It quickly becomes a grind; visiting the same locations over and over"; the survival and morality systems feel unrelenting and fragile characters make it "almost overbearing".
- Vice: on console the game's "many clicks on miniscule icons" and small text were fiddly with a pad. This directly concerns icon size and readability.
- Slant Magazine (2/5, via Wikipedia): "near-pornographic level of human despair". 411Mania: "not much fun to actually play".
- Community, unverified in scale: stealth AI feels opaque (the Steam thread asking "help me understand how the stealth works").

## 5. Twenty things Orcfall Command should take from it

Each point cites the evidence.
1. **Draw the cutaway as black structural mass, not outlined walls.** Floors and party walls are thick near-black slabs with the front wall absent; this makes every room read as a lit box. [A1, A2, A3, A6]
2. **Keep floor-to-floor rhythm regular** (storey height consistent, slabs as a horizontal grid), with the vertical walls varying the rooms. [A2, A6, A10]
3. **Leave one or two big double-height voids** (grand hall, stairwell) so the player sees several floors at once. [A11, B22]
4. **Show an exterior facade slice** in the middle of a cutaway (courtyard tower, fire escapes) for depth. [A2]
5. **Use the same strong direction of rain/hatching strokes over the whole screen** including backgrounds to unify art. Do it as a single post-process pass in three.js, driven by luminance. (Inference from [A1, A5, B15], and the confirmed "pencil-like sketch" aim in the IGF interview.)
6. **Near-monochrome grade plus spot colour only for meaning:** fire, danger, UI accent. [A2, B5, B25, A3]
7. **One light pool per room** (hanging bulb, window shaft or fire) with generous dark margins so props are discovered. [A4, A7, A11, B22]
8. **Unseen rooms go nearly black, seen rooms stay dim-visible**; lighting itself is the fog of war. [PC Gamer review: "Everything outside line of sight is enveloped in a fog"; A10]
9. **Round icon discs over each interactable** with a small vocabulary (door, hand, ladder, stairs, lock, magnifier); a ring for timed actions. [A1, A7, B24, B26]
10. **Noise as expanding red rings visible through walls**, from both the player and enemies; keep it roughly one storey of reach. [PC Gamer review; Steam thread (anecdotal reach)]
11. **Keyhole peek at doors** to see the next room before entering. [Gamepressure good-picker page]
12. **Barricades as visible props with tooltips** (boards across doors, sandbags, rubble) that require a tool or time. [A4; Gamepressure equipment page]
13. **Hiding alcoves carry their own icon**, and fail if the enemy already saw you. [Gamepressure; Steam thread]
14. **Tiny characters (about one third storey)** so rooms can be dense with props without hiding the player. [A1, A3, A10]
15. **Dense lived-in dressing per room:** pendant bulbs, fridge, radiators, wires, cardboard boxes, bikes, washing lines, ladders, chandeliers, rubble heaps. Each room should have a story prop (easel, projector, tram). [A7, B7, B8, B13, B24, B28]
16. **Paper/Polaroid/torn-tape UI** with one accent colour, matching the sketch world. [A3, A6, B20, B4, A12]
17. **Distinct locations by mood and rule**, not just layout: safe cottage, hospital, rich supermarket, sniper junction, military outpost, brothel, construction site that changes on second visit. Give every Orcfall zone one signature rule. [Gamepressure location guide]
18. **Residents and guards show intent in speech bubbles** ("Igor, you take the upstairs and the roof") so patrol plans can be overheard. [A10]
19. **Parallax layers outside the cutaway:** foreground silhouettes (tree, pole), mid facades, flat far background; the camera stays side-on. [A5, A8; 80.lv interview]
20. **Keep icons large and readable**; the one recurring usability complaint was tiny icons and text on console. [Vice review]

## 6. Could not verify
- Exact shader pipeline (hatch textures, edge detection, post-process order), any talk about it, and Final Cut lighting changes. A search result claimed Final Cut "adjusted the lighting engine"; it came from a low-quality copy site and I did not use it.
- The Fandom wiki, 11bitstudios.com press kit (HTTP 403 to my fetch), TechRaptor art interview (bot wall), GamesBeat page beyond the Poland-visit text, GameSpot and Edge ("The Making Of…") pages (empty to bots): I did not read these, only their snippet. The Edge and GameSpot claims in this document are therefore marked [snippet] or omitted.
- ArtStation or art book material: found none.
- Room sizes in metres or pixels, number of floors per location, exact noise radius and the AI state names. The only numbers I have are the 5 AM deadline and the "about one storey" player estimate.
- Whether a keyhole peek is limited to doors only, and the combat/back-stab rules in detail: only player anecdote and guide text.
- That the wiki lists exactly the locations in section 3.4: this list is from Gamepressure, which may be incomplete for Final Cut.
- Search snippets about a 2026 Unreal Engine 5 remake of TWoM by 11 bit came from an aggregator and were not checked.
- Four screenshots were downloaded but not looked at (see section 1).

## 7. Full link list (everything read or seen)
**Read in full or in part**
- https://80.lv/articles/this-war-of-mine-a-game-about-civilians-in-war
- https://gamedeveloper.com/design/road-to-the-igf-11bit-studios-i-this-war-of-mine-i-
- https://gamedeveloper.com/design/-i-this-war-of-mine-i-and-the-challenges-of-making-games-about-war
- https://www.pcgamer.com/this-war-of-mine-review
- https://pcgamer.com/this-war-of-mines-final-update-adds-a-new-character-scenario-and-remastered-graphics
- https://www.vice.com/en/article/this-war-of-mine-is-an-almost-too-real-game-of-survival-horror-953/
- https://en.wikipedia.org/api/rest_v1/page/html/This_War_of_Mine
- https://gamesbeat.com/this-war-of-mine/
- https://gdcvault.com/play/1025741
- https://www.designer-notes.com/?p=1598
- https://www.gamepressure.com/thiswarofmine/equipment-slection-and-location-types/z06d3c
- https://www.gamepressure.com/thiswarofmine/good-picker-tactic-searching-through-location/z16d3d
- https://www.gamepressure.com/thiswarofmine/night-trips/ze6d3a
- https://gamesfuze.com/guides/this-war-of-mine-where-to-scavenge/
- https://steamcommunity.com/app/282070/discussions/0/1368380934251647511
- https://store.steampowered.com/app/282070/This_War_of_Mine/ and the Steam API https://store.steampowered.com/api/appdetails?appids=282070 (also 481090, 750030, 750031, 974610, 1125630, 3323700, 348040, 354350)

**Searched, snippet only (not opened)**
- https://techraptor.net/content/art-war-mine-interview-11-bit-studios
- https://www.gamespot.com/articles/tackling-the-horrors-of-war-from-a-civilian-perspective-in-this-war-of-mine/1100-6418503/
- https://www.pressreader.com/australia/edge/20160526/282531542646677
- https://critic.co.nz/culture/article/5358/this-war-of-mine
- https://gdconf.com/news/frostpunk-war-mine-devs-share-lessons-learned-gdc-2019
- https://www.pcgamer.com/uk/how-the-creators-of-frostpunk-and-this-war-of-mine-embraced-dead-serious-games/
- https://thiswarofmine.gamepedia.com/Ruined_Block_Of_Flats
- https://www.moma.org/collection/works/199235
- https://11bitstudios.com/this-war-of-mine-in-the-museum-of-modern-art/ (opened: empty to my fetch)

**Image URLs:** all listed in section 1.
